from django.db import models
from django.conf import settings
import uuid

User = settings.AUTH_USER_MODEL

class Reservation(models.Model):
    ESTADO_CHOICES = (
        ('activa','Activa'),
        ('finalizada','Finalizada'),
        ('cancelada','Cancelada'),
    )
    
    TIPO_RESERVA_CHOICES = (
        ('hora', 'Por Hora'),
        ('dia', 'Por Día'),
        ('mes', 'Por Mes'),
    )

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reservations')
    vehiculo = models.ForeignKey('users.Car', on_delete=models.CASCADE, related_name='reservations')
    estacionamiento = models.ForeignKey('parking.ParkingLot', on_delete=models.CASCADE, related_name='reservations')
    hora_entrada = models.DateTimeField()
    hora_salida = models.DateTimeField(blank=True, null=True)
    duracion_minutos = models.PositiveIntegerField(blank=True, null=True)
    costo_estimado = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    codigo_reserva = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activa')
    tipo_reserva = models.CharField(max_length=10, choices=TIPO_RESERVA_CHOICES, default='hora')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Reserva {self.codigo_reserva}"

    @property
    def tiempo_restante_minutos(self):
        """Calcula el tiempo restante para la reserva en minutos"""
        from django.utils import timezone
        if self.estado == 'activa' and self.hora_entrada:
            now = timezone.now()
            if self.hora_entrada > now:
                return int((self.hora_entrada - now).total_seconds() / 60)
        return None

    @property
    def puede_cancelar(self):
        """Determina si la reserva puede ser cancelada"""
        from django.utils import timezone
        return (self.estado == 'activa' and 
                self.hora_entrada > timezone.now())

    def calcular_costo_final(self):
        """
        Calcula el costo final basado en el tiempo real de uso
        """
        from django.utils import timezone
        from decimal import Decimal
        
        if self.estado != 'finalizada' or not self.hora_salida:
            return self.costo_estimado
        
        # Calcular tiempo real en minutos
        tiempo_real_minutos = (self.hora_salida - self.hora_entrada).total_seconds() / 60
        
        # Aquí puedes implementar lógica de cálculo de costo real
        # basado en el tipo_reserva y multiplicadores del vehículo
        return self.costo_estimado

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['estado', 'hora_entrada']),
            models.Index(fields=['usuario', 'estado']),
            models.Index(fields=['estacionamiento', 'hora_entrada']),
            models.Index(fields=['codigo_reserva']),
        ]