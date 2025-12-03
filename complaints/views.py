from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions
from .models import Complaint
from .serializers import ComplaintSerializer

class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all().order_by('-created_at')
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Complaint.objects.all()
        # Si el usuario es propietario, debe ver las quejas de sus estacionamientos
        elif getattr(user, 'rol', None) == 'owner' or hasattr(user, 'parking_owner'):
            return Complaint.objects.filter(parking__dueno=user)
        else:
            # Muestra solo las quejas que él mismo envió
            return Complaint.objects.filter(user=user)
