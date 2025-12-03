# notifications/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_registration_notification(sender, instance, created, **kwargs):
    """
    Crear notificación cuando se registra un nuevo usuario
    """
    if created and not instance.is_staff:
        print(f" Señal: Nuevo usuario registrado - {instance.username}")
        
        # Crear notificación para todos los administradores
        admins = User.objects.filter(is_staff=True, is_active=True)
        
        for admin in admins:
            Notification.objects.create(
                user=admin,
                rol='admin',
                type='info',
                title=' Nuevo usuario registrado',
                message=f'El usuario "{instance.username}" ({instance.email}) se ha registrado en Parkeaya.',
                source='system',
                icon='fas fa-user-plus',
                action_url=f'/admin/users/{instance.id}/'
            )

@receiver(post_save, sender=User)
def notify_user_activation_change(sender, instance, **kwargs):
    """
    Notificar cuando cambia el estado de activación de un usuario
    """
    if 'update_fields' in kwargs:
        update_fields = kwargs['update_fields']
        if update_fields and 'is_active' in update_fields:
            print(f"🔔 Señal: Estado de usuario cambiado - {instance.username}")
            
            # Notificar a los admins
            admins = User.objects.filter(is_staff=True, is_active=True)
            
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    rol='admin',
                    type='warning' if not instance.is_active else 'success',
                    title='Estado de usuario actualizado',
                    message=f'El usuario "{instance.username}" ha sido {"activado ✅" if instance.is_active else "desactivado ⚠️"}.',
                    source='system',
                    icon='fas fa-user-check' if instance.is_active else 'fas fa-user-slash',
                    action_url=f'/admin/users/{instance.id}/'
                )

# Señales para reservas (debes importar tu modelo de Reservation)
@receiver(post_save, sender='reservations.Reservation')
def notify_new_reservation(sender, instance, created, **kwargs):
    """
    Notificar nueva reserva al owner del estacionamiento
    """
    if created:
        parking_owner = instance.parking_lot.owner
        Notification.objects.create(
            user=parking_owner,
            rol='owner',
            type='reservation',
            title='📅 Nueva reserva',
            message=f'Tienes una nueva reserva en {instance.parking_lot.nombre} para {instance.vehicle.plate}.',
            source='reservation_system',
            icon='fas fa-calendar-check',
            action_url=f'/owner/reservations/{instance.id}/'
        )

@receiver(post_save, sender='reservations.Reservation')
def notify_reservation_status_change(sender, instance, **kwargs):
    """
    Notificar cambio de estado de reserva
    """
    if 'update_fields' in kwargs:
        update_fields = kwargs['update_fields']
        if update_fields and 'status' in update_fields:
            # Notificar al cliente
            Notification.objects.create(
                user=instance.user,
                type='info',
                title='Estado de reserva actualizado',
                message=f'Tu reserva en {instance.parking_lot.nombre} está ahora: {instance.get_status_display()}.',
                source='reservation_system',
                icon='fas fa-info-circle',
                action_url=f'/reservations/{instance.id}/'
            )

# Señales para pagos (debes importar tu modelo de Payment)
@receiver(post_save, sender='payments.Payment')
def notify_payment_confirmation(sender, instance, created, **kwargs):
    """
    Notificar confirmación de pago
    """
    if created and instance.status == 'completed':
        # Notificar al owner
        parking_owner = instance.reservation.parking_lot.owner
        Notification.objects.create(
            user=parking_owner,
            rol='owner',
            type='payment',
            title='💰 Pago confirmado',
            message=f'Pago de {instance.amount} confirmado para la reserva #{instance.reservation.id}.',
            source='payment_system',
            icon='fas fa-dollar-sign',
            action_url=f'/owner/payments/{instance.id}/'
        )
        
        # Notificar al admin (para pagos grandes)
        if instance.amount > 100:  # Ejemplo: notificar pagos mayores a 100
            admins = User.objects.filter(is_staff=True, is_active=True)
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    rol='admin',
                    type='payment',
                    title='💰 Pago importante confirmado',
                    message=f'Pago de {instance.amount} procesado para reserva #{instance.reservation.id}.',
                    source='payment_system',
                    icon='fas fa-dollar-sign',
                    action_url=f'/admin/payments/{instance.id}/'
                )

# Señales para estacionamientos (debes importar tu modelo de ParkingLot)
@receiver(post_save, sender='parking.ParkingLot')
def notify_parking_approval(sender, instance, **kwargs):
    """
    Notificar cuando un estacionamiento es aprobado/rechazado
    """
    if 'update_fields' in kwargs:
        update_fields = kwargs['update_fields']
        if update_fields and 'aprobado' in update_fields:
            if instance.aprobado:
                # Notificar al owner que fue aprobado
                Notification.objects.create(
                    user=instance.owner,
                    rol='owner',
                    type='success',
                    title=' Estacionamiento aprobado',
                    message=f'Tu estacionamiento "{instance.nombre}" ha sido aprobado y ya está visible.',
                    source='admin_system',
                    icon='fas fa-check-circle',
                    action_url=f'/owner/parking/{instance.id}/'
                )
            else:
                # Notificar al owner que fue rechazado
                Notification.objects.create(
                    user=instance.owner,
                    rol='owner',
                    type='error',
                    title=' Estacionamiento rechazado',
                    message=f'Tu estacionamiento "{instance.nombre}" ha sido rechazado. Contacta al administrador.',
                    source='admin_system',
                    icon='fas fa-times-circle',
                    action_url=f'/owner/parking/{instance.id}/'
                )