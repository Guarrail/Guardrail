from rest_framework import serializers
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
