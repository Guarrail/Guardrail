from rest_framework import serializers, viewsets
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    stellar_explorer_url = serializers.CharField(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "event_type",
            "actor_type",
            "actor_id",
            "request_id",
            "permit_id",
            "stellar_tx_hash",
            "stellar_explorer_url",
            "details",
            "created_at",
        ]
        read_only_fields = fields


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log viewset. Provides transparency and compliance reporting.
    """

    queryset = AuditLog.objects.all().order_by("-created_at")
    serializer_class = AuditLogSerializer
    filterset_fields = ["event_type", "actor_id", "request_id", "permit_id"]

    def get_queryset(self):
        qs = super().get_queryset()
        req_id = self.request.query_params.get("request_id")
        if req_id:
            qs = qs.filter(request_id=req_id)
        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)
        return qs
