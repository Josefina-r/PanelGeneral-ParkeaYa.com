from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail

from .models import Payment


@shared_task
def verificar_pago_pendiente(payment_id):
    """Verifica el estado de un pago pendiente y lo marca como pagado si procede.
    Actualmente simula la verificación y marca el pago como 'pagado'.
    Después de marcar, dispara el envío del comprobante y la notificación al propietario.
    """
    try:
        payment = Payment.objects.select_related('reserva__estacionamiento', 'usuario').get(id=payment_id)
    except Payment.DoesNotExist:
        return False

    # Aquí podrías integrar con la pasarela de pago real (Yape/Plin)
    # Por ahora asumimos que la verificación externa fue exitosa.
    payment.estado = 'pagado'
    payment.fecha_pago = timezone.now()
    payment.save()

    # Disparar tareas auxiliares
    enviar_comprobante_pago.delay(payment_id)
    notificar_pago_propietario.delay(payment_id)
    return True


@shared_task
def enviar_comprobante_pago(payment_id):
    """Envía un comprobante por email al usuario que realizó el pago.
    Si no hay email configurado, la tarea falla silenciosamente (no interrumpe el flujo).
    """
    try:
        payment = Payment.objects.select_related('usuario', 'reserva').get(id=payment_id)
    except Payment.DoesNotExist:
        return False

    user = payment.usuario
    if not user or not getattr(user, 'email', None):
        # No hay email para enviar
        return False

    subject = f"Comprobante de pago - Reserva {payment.reserva.codigo_reserva}"
    message = (
        f"Hola {user.get_full_name() or user.username},\n\n"
        f"Gracias por tu pago. Aquí están los detalles:\n"
        f"Monto: {payment.monto}\n"
        f"Método: {payment.metodo}\n"
        f"Fecha: {payment.fecha_pago or payment.fecha_creacion}\n\n"
        "Saludos,\nEl equipo de Parkeaya"
    )

    try:
        send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [user.email], fail_silently=True)
    except Exception:
        # No queremos que el fallo del email impida que la tarea principal se complete
        pass

    return True


@shared_task
def notificar_pago_propietario(payment_id):
    """Notifica al propietario del estacionamiento que se realizó un pago.
    Intenta enviar un email al propietario si tiene configurado uno.
    """
    try:
        payment = Payment.objects.select_related('reserva__estacionamiento__owner').get(id=payment_id)
    except Payment.DoesNotExist:
        return False

    owner = getattr(payment.reserva.estacionamiento, 'owner', None)
    if not owner or not getattr(owner, 'email', None):
        return False

    subject = f"Pago recibido - Reserva {payment.reserva.codigo_reserva}"
    message = (
        f"Hola {owner.get_full_name() or owner.username},\n\n"
        f"Se ha registrado un pago para la reserva {payment.reserva.codigo_reserva}.\n"
        f"Usuario: {payment.usuario.get_full_name() or payment.usuario.username}\n"
        f"Monto: {payment.monto}\n"
        f"Método: {payment.metodo}\n\n"
        "Puedes verificar los detalles en el panel de administración.\n\n"
        "Saludos,\nEl equipo de Parkeaya"
    )

    try:
        send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [owner.email], fail_silently=True)
    except Exception:
        pass

    return True
