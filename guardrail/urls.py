from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from django.views.static import serve
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from apps.accounts.views import (
    OperatorChallengeView,
    OperatorVerifyView,
    OperatorMeView,
    OperatorViewSet,
    PrivilegeEscalationViewSet,
)

from apps.wallets.views import ControlledWalletViewSet
from apps.policies.views import PolicyViewSet, AllowedRecipientViewSet, AllowedAssetViewSet
from apps.agents.views import AIAgentViewSet
from apps.coordinator.views import (
    AgentSubmitRequestView,
    AgentSwapView,
    AgentRequestDetailView,
    AgentPolicySummaryView,
    OperatorRequestViewSet,
    OperatorPermitViewSet,
    DashboardStatsView,
)
from apps.audit.views import AuditLogViewSet
from apps.smart_contracts.views import SorobanContractStatusView, SorobanSimulateView


from rest_framework import serializers
from drf_spectacular.utils import extend_schema


class HealthCheckResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
    version = serializers.CharField()
    stellar_network = serializers.CharField()
    multisig_model = serializers.CharField()


class HealthCheckView(APIView):
    """Health check probe endpoint for Docker and monitoring infrastructure."""

    @extend_schema(
        responses={200: HealthCheckResponseSerializer},
        description="Check health status of the GuardRail coordinator service.",
    )
    def get(self, request):
        return Response(
            {
                "status": "healthy",
                "service": "GuardRail Policy Coordinator",
                "version": "1.0.0",
                "stellar_network": "TESTNET",
                "multisig_model": "Agent(1) + CoSigner(1) = MedThreshold(2)",
            }
        )


router = DefaultRouter()
router.register(r"accounts/operators", OperatorViewSet, basename="operator")
router.register(r"accounts/escalations", PrivilegeEscalationViewSet, basename="escalation")
router.register(r"wallets", ControlledWalletViewSet, basename="wallet")
router.register(r"policies", PolicyViewSet, basename="policy")
router.register(r"recipients", AllowedRecipientViewSet, basename="recipient")
router.register(r"assets", AllowedAssetViewSet, basename="asset")
router.register(r"agents", AIAgentViewSet, basename="agent")
router.register(r"coordinator/requests", OperatorRequestViewSet, basename="coordinator-request")
router.register(r"coordinator/permits", OperatorPermitViewSet, basename="coordinator-permit")
router.register(r"audit/logs", AuditLogViewSet, basename="audit-log")


urlpatterns = [
    # Root redirect to Swagger Docs
    path("", RedirectView.as_view(url="/api/docs/", permanent=False), name="root-redirect"),

    # Admin Panel
    path("admin/", admin.site.urls),

    # Health Check
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("api/health/", HealthCheckView.as_view(), name="api-health-check"),

    # Interactive OpenAPI / Swagger Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui-alias"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Operator Wallet Ownership & Authentication (SEP-10 style)
    path("api/v1/auth/challenge/", OperatorChallengeView.as_view(), name="auth-challenge"),
    path("api/v1/auth/verify/", OperatorVerifyView.as_view(), name="auth-verify"),
    path("api/v1/auth/me/", OperatorMeView.as_view(), name="auth-me"),
    path("api/v1/accounts/me/", OperatorMeView.as_view(), name="accounts-me"),

    # AI Agent Payment Proposal Endpoints (Authenticated via X-Agent-Key)
    path("api/v1/agent/requests/", AgentSubmitRequestView.as_view(), name="agent-submit-request"),
    path("api/v1/agent/requests/<str:request_id>/", AgentRequestDetailView.as_view(), name="agent-request-detail"),
    path("api/v1/agent/policy-summary/", AgentPolicySummaryView.as_view(), name="agent-policy-summary"),
    path("api/v1/agent/swap/", AgentSwapView.as_view(), name="agent-swap"),
    path("api/v1/agent/trade/", AgentSwapView.as_view(), name="agent-trade"),

    # Operator Coordinator & Dashboard Stats
    path("api/v1/coordinator/dashboard-stats/", DashboardStatsView.as_view(), name="coordinator-dashboard-stats"),

    # Soroban Smart Contract Simulator & Status
    path("api/v1/smart-contract/status/", SorobanContractStatusView.as_view(), name="smart-contract-status"),
    path("api/v1/smart-contract/simulate/", SorobanSimulateView.as_view(), name="smart-contract-simulate"),

    # ViewSets Router
    path("api/v1/", include(router.urls)),

    # Serve static assets (Admin panel, Swagger UI, static assets)
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
]
