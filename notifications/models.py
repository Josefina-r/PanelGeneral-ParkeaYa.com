# notifications/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('info', 'Información'),
        ('success', 'Éxito'), 
        ('warning', 'Advertencia'),
        ('error', 'Error'),
        ('reservation', 'Reserva'),
        ('payment', 'Pago'),
        ('user', 'Usuario'),
        ('system', 'Sistema'),
        ('parking', 'Estacionamiento'),
    )
    
    NOTIFICATION_ROL = (
        ('admin', 'Administrador'),
        ('owner', 'Dueño'),
        ('all', 'Todos'),
    )
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='notifications',
        null=True,  # Para notificaciones globales
        blank=True
    )
    rol = models.CharField(max_length=10, choices=NOTIFICATION_ROL, default='all')
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='info')
    title = models.CharField(max_length=200)
    message = models.TextField()
    source = models.CharField(max_length=100, default='system')  # Quién generó la notificación
    icon = models.CharField(max_length=50, default='fas fa-bell')
    action_url = models.URLField(blank=True, null=True)  # URL a donde redirigir
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'read']),
            models.Index(fields=['rol', 'read']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.user.username if self.user else 'Global'}"
    
    def mark_as_read(self):
        self.read = True
        self.save()