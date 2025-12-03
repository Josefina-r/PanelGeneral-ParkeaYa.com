from django.db import models
from django.conf import settings
from parking.models import ParkingLot
from django.utils import timezone

class Complaint(models.Model):
    CATEGORY_CHOICES = [
        ('APP', 'Problema con la App'),
        ('PARKING', 'Problema con un Estacionamiento'),
        ('PAYMENT', 'Problema con un Pago'),
        ('OTHER', 'Otro'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('IN_REVIEW', 'En revisión'),
        ('RESOLVED', 'Resuelto'),
        ('REJECTED', 'Rechazado'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='complaints')
    parking = models.ForeignKey(ParkingLot, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=150)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    response = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title} - {self.user.username}"
