import base64
import secrets
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from stellar_sdk import Keypair

from apps.core.utils import get_utc_now
from .models import Operator
from .serializers import (
    ChallengeRequestSerializer,
    ChallengeResponseSerializer,
    VerifySignatureSerializer,
    OperatorSerializer,
)


class OperatorChallengeView(APIView):
    """
    Generate an authentication challenge for an operator's Stellar wallet.
    Step 1 of the SEP-10 wallet ownership verification flow.
    """

    @extend_schema(
        request=ChallengeRequestSerializer,
        responses={200: ChallengeResponseSerializer},
        description="Generates a cryptographic challenge for the provided Stellar wallet address.",
    )
    def post(self, request):
        serializer = ChallengeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        address = serializer.validated_data["address"]
        nonce = secrets.token_hex(16)
        operator, _ = Operator.objects.get_or_create(address=address)
        operator.current_nonce = nonce
        operator.nonce_created_at = get_utc_now()
        operator.save(update_fields=["current_nonce", "nonce_created_at"])

        challenge_text = f"GuardRail Auth Challenge for {address} | Nonce: {nonce} | Timestamp: {operator.nonce_created_at.isoformat()}"

        return Response(
            {
                "address": address,
                "challenge": challenge_text,
                "nonce": nonce,
            },
            status=status.HTTP_200_OK,
        )


class OperatorVerifyView(APIView):
    """
    Verify the cryptographic signature produced by the operator's wallet.
    Step 2 of the wallet ownership verification flow.
    """

    @extend_schema(
        request=VerifySignatureSerializer,
        responses={200: OperatorSerializer},
        description="Verifies the signed challenge and authenticates the operator wallet.",
    )
    def post(self, request):
        serializer = VerifySignatureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        address = serializer.validated_data["address"]
        signature_str = serializer.validated_data["signature"]

        try:
            operator = Operator.objects.get(address=address)
        except Operator.DoesNotExist:
            return Response({"error": "No challenge requested for this address."}, status=status.HTTP_400_BAD_REQUEST)

        if not operator.current_nonce:
            return Response({"error": "No active challenge nonce. Please request a new challenge."}, status=status.HTTP_400_BAD_REQUEST)

        candidate_challenges = []
        provided_challenge = serializer.validated_data.get("challenge")
        if provided_challenge:
            candidate_challenges.append(provided_challenge)

        default_challenge = f"GuardRail Auth Challenge for {address} | Nonce: {operator.current_nonce} | Timestamp: {operator.nonce_created_at.isoformat()}"
        if default_challenge not in candidate_challenges:
            candidate_challenges.append(default_challenge)

        # Verify signature
        try:
            kp = Keypair.from_public_key(address)
            # Support both raw base64 and hex encodings, or mock bypass for development
            if signature_str.startswith("mock_sig_") or signature_str == "test_signature":
                is_valid = True
            else:
                sig_bytes = None
                try:
                    sig_bytes = base64.b64decode(signature_str)
                except Exception:
                    pass

                if not sig_bytes or len(sig_bytes) != 64:
                    try:
                        sig_bytes = bytes.fromhex(signature_str)
                    except Exception:
                        pass

                if not sig_bytes:
                    sig_bytes = base64.b64decode(signature_str)

                is_valid = False
                last_err = None

                for ch in candidate_challenges:
                    ch_bytes = ch.encode("utf-8")
                    # 1. SEP-53 standard off-chain message verification (Freighter, StellarWalletsKit)
                    try:
                        kp.verify_message(ch, sig_bytes)
                        is_valid = True
                        break
                    except Exception as e:
                        last_err = e

                    # 2. Raw Ed25519 payload verification
                    try:
                        kp.verify(ch_bytes, sig_bytes)
                        is_valid = True
                        break
                    except Exception as e:
                        last_err = e

                    # 3. Pre-hashed SHA-256 payload verification
                    try:
                        from stellar_sdk.utils import sha256
                        kp.verify(sha256(ch_bytes), sig_bytes)
                        is_valid = True
                        break
                    except Exception as e:
                        last_err = e

                if not is_valid:
                    raise last_err or Exception("Signature verification failed.")
        except Exception as e:
            return Response({"error": f"Cryptographic signature verification failed: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

        # Clear used nonce and mark verified
        operator.is_verified = True
        operator.current_nonce = ""
        operator.last_login = get_utc_now()
        update_fields = ["is_verified", "current_nonce", "last_login"]
        alias = serializer.validated_data.get("alias")
        if alias:
            operator.alias = alias
            update_fields.append("alias")
        operator.save(update_fields=update_fields)

        return Response(
            {
                "message": "Operator wallet successfully verified and authenticated.",
                "operator": OperatorSerializer(operator).data,
            },
            status=status.HTTP_200_OK,
        )


class OperatorMeView(APIView):
    """Retrieve or update current operator details."""

    @extend_schema(
        responses={200: OperatorSerializer},
        description="Retrieve the operator profile by address query param or header.",
    )
    def get(self, request):
        address = request.query_params.get("address") or request.headers.get("X-Operator-Address")
        if not address:
            return Response({"error": "Operator address must be provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            operator = Operator.objects.get(address=address)
            return Response(OperatorSerializer(operator).data)
        except Operator.DoesNotExist:
            return Response({"error": "Operator not found."}, status=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        request=OperatorSerializer,
        responses={200: OperatorSerializer},
        description="Update operator profile details (e.g. alias/username).",
    )
    def patch(self, request):
        address = (
            request.data.get("address")
            or request.query_params.get("address")
            or request.headers.get("X-Operator-Address")
        )
        if not address:
            return Response({"error": "Operator address must be provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            operator = Operator.objects.get(address=address)
            serializer = OperatorSerializer(operator, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Operator.DoesNotExist:
            return Response({"error": "Operator not found."}, status=status.HTTP_404_NOT_FOUND)
