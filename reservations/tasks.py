from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Reservation

@shared_task
def cancel_unused_reservations():
    
    now = timezone.now()
    grace_period = timedelta(minutes=15)
    
    # Buscar reservas que deberían haber iniciado hace más de 15 minutos
    unused_reservations = Reservation.objects.filter(
        estado='pendiente',
        hora_entrada__lt=now - grace_period
    )
    
    for reservation in unused_reservations:
        reservation.estado = 'cancelada'
        reservation.save()
        

@shared_task
def cleanup_expired_reservations():
    
    now = timezone.now()
    
    # Buscar reservas que ya deberían haber terminado
    expired_reservations = Reservation.objects.filter(
        estado='activa',
        hora_salida__lt=now
    )
    
    for reservation in expired_reservations:
        reservation.estado = 'completada'
        reservation.save()
        
        # Aquí podrías agregar notificación al usuario