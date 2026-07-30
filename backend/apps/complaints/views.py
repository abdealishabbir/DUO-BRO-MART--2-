"""
Endpoint map:
  POST  /api/complaints/                (submit — logged-in customer only)
  GET   /api/complaints/mine/           (this customer's own complaints)
  GET   /api/complaints/admin/?status=  (§7.4 admin queue)
  PATCH /api/complaints/admin/<id>/     (resolve — status + resolution_notes)
"""

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from .models import Complaint
from .serializers import ComplaintCreateSerializer, ComplaintSerializer


class ComplaintCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplaintCreateSerializer


class MyComplaintsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        return Complaint.objects.filter(customer=self.request.user)


class AdminComplaintsView(generics.ListAPIView):
    """§7.4: admin queue for refund/replacement handling and vendor quality review."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        qs = Complaint.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminComplaintResolveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            complaint = Complaint.objects.get(pk=pk)
        except Complaint.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status and new_status not in Complaint.Status.values:
            return Response({"status": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status:
            complaint.status = new_status
            if new_status != Complaint.Status.OPEN and new_status != Complaint.Status.UNDER_REVIEW:
                complaint.resolved_by = request.user
                complaint.resolved_at = timezone.now()
        complaint.resolution_notes = request.data.get("resolution_notes", complaint.resolution_notes)
        complaint.save()
        return Response(ComplaintSerializer(complaint).data)
