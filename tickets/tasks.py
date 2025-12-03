from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from .models import Ticket


@shared_task
def enviar_ticket_usuario(ticket_id):
    """Envía el ticket por email al usuario que lo generó.
    No hace fallar el flujo si el email no está configurado.
    """
    try:
        ticket = Ticket.objects.select_related('reserva__usuario', 'reserva__estacionamiento').get(id=ticket_id)
    except Ticket.DoesNotExist:
        return False

    usuario = getattr(ticket.reserva, 'usuario', None)
    if not usuario or not getattr(usuario, 'email', None):
        return False

    subject = f"Tu ticket - Reserva {ticket.reserva.codigo_reserva}"
    message = (
        f"Hola {usuario.get_full_name() or usuario.username},\n\n"
        f"Adjunto encontrarás los detalles de tu ticket para la reserva {ticket.reserva.codigo_reserva}.\n"
        f"Estacionamiento: {ticket.reserva.estacionamiento.nombre}\n"
        f"Fecha emisión: {ticket.fecha_emision or timezone.now()}\n"
        f"Código ticket: {ticket.codigo_ticket}\n\n"
        "Gracias por usar Parkeaya.\n"
    )

    try:
        send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [usuario.email], fail_silently=True)
    except Exception:
        # No queremos que un error en el envío de correo rompa la creación del ticket
        pass

    return True


@shared_task
def notificar_validacion_propietario(ticket_id):
    """Notifica al propietario del estacionamiento cuando se valida un ticket."""
    try:
        ticket = Ticket.objects.select_related('reserva__estacionamiento__owner', 'reserva__usuario').get(id=ticket_id)
    except Ticket.DoesNotExist:
        return False

    owner = getattr(ticket.reserva.estacionamiento, 'owner', None)
    if not owner or not getattr(owner, 'email', None):
        return False

    subject = f"Ticket validado - Reserva {ticket.reserva.codigo_reserva}"
    message = (
        f"Hola {owner.get_full_name() or owner.username},\n\n"
        f"El ticket {ticket.codigo_ticket} de la reserva {ticket.reserva.codigo_reserva} ha sido validado.\n"
        f"Usuario: {ticket.reserva.usuario.get_full_name() or ticket.reserva.usuario.username}\n"
        f"Hora de validación: {timezone.now()}\n\n"
        "Saludos,\nEl equipo de Parkeaya"
    )

    try:
        send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'), [owner.email], fail_silently=True)
    except Exception:
        pass

    return True
