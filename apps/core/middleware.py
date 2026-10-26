class DisableCSRFForAPIMiddleware:
    """
    Exempt /api/ routes from browser CSRF Origin checks.
    GuardRail API uses cryptographic Stellar Ed25519 signatures (SEP-10 challenge-response)
    and SHA-256 API keys (X-Agent-Key). Session CSRF is retained for Django Admin (/admin/).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/"):
            setattr(request, "_dont_enforce_csrf_checks", True)
        return self.get_response(request)
