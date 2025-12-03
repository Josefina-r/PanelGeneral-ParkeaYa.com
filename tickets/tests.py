from django.test import TestCase
from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

@shared_task
def enviar_ticket_usuario(ticket_id):
    """Envía ticket por email al usuario"""
    from .models import Ticket
    
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        usuario = ticket.reserva.usuario
        
        subject = f"Tu Ticket - {ticket.codigo_ticket}"
        context = {
            'ticket': ticket,
            'reserva': ticket.reserva,
            'usuario': usuario
        }
        
        html_message = render_to_string('emails/ticket_usuario.html', context)
        plain_message = render_to_string('emails/ticket_usuario.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[usuario.email],
            html_message=html_message
        )
        
    except Ticket.DoesNotExist:
        print(f"Ticket {ticket_id} no encontrado")

@shared_task
def notificar_validacion_propietario(ticket_id):
    #"""Notifica al propietario del estacionamiento que un ticket fue validado"""
    from .models import Ticket
    
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        propietario = ticket.reserva.estacionamiento.owner
        
        subject = f"✅ Ticket Validado - {ticket.codigo_ticket}"
        context = {
            'ticket': ticket,
            'reserva': ticket.reserva
        }
        
        html_message = render_to_string('emails/ticket_validado_propietario.html', context)
        plain_message = render_to_string('emails/ticket_validado_propietario.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[propietario.email],
            html_message=html_message
        )
        
    except Ticket.DoesNotExist:
        print(f"Ticket {ticket_id} no encontrado")

@shared_task
def expirar_tickets_automaticamente():
    """Expira tickets automáticamente después de su tiempo de validez"""
    from .models import Ticket
    from django.utils import timezone
    
    tickets_expirados = Ticket.objects.filter(
        estado='valido',
        fecha_validez_hasta__lt=timezone.now()
    )
    
    for ticket in tickets_expirados:
        ticket.expirar_ticket()
    
    return f"Tickets expirados: {tickets_expirados.count()}"