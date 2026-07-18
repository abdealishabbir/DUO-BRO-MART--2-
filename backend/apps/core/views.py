"""
Phase 1: a single public health-check endpoint, used to confirm the
Docker Compose stack (Postgres + Redis + Django + React) is wired
correctly end to end before any real feature is built on top of it.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "service": "duobromart-backend",
            "phase": "1 — platform shell, routing & role entry",
        }
    )
