from django.test import TestCase

from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

@shared_task
def enviar_comprobante_pago(payment_id):
    """Envía comprobante de pago al usuario"""
    from .models import Payment
    
    try:
        payment = Payment.objects.get(id=payment_id)
        
        subject = f"✅ Comprobante de Pago - {payment.referencia_pago}"
        context = {
            'payment': payment,
            'reserva': payment.reserva
        }
        
        html_message = render_to_string('emails/comprobante_pago.html', context)
        plain_message = render_to_string('emails/comprobante_pago.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.usuario.email],
            html_message=html_message
        )
        
    except Payment.DoesNotExist:
        print(f"Pago {payment_id} no encontrado")

@shared_task
def enviar_instrucciones_billetera(payment_id):
    """Envía instrucciones para pago con Yape/Plin"""
    from .models import Payment
    
    try:
        payment = Payment.objects.get(id=payment_id)
        
        subject = f"📱 Instrucciones de Pago - {payment.referencia_pago}"
        context = {
            'payment': payment,
            'reserva': payment.reserva
        }
        
        html_message = render_to_string('emails/instrucciones_billetera.html', context)
        plain_message = render_to_string('emails/instrucciones_billetera.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.usuario.email],
            html_message=html_message
        )
        
    except Payment.DoesNotExist:
        print(f"Pago {payment_id} no encontrado")

@shared_task
def notificar_pago_propietario(payment_id):
    """Notifica al propietario sobre un pago recibido"""
    from .models import Payment
    
    try:
        payment = Payment.objects.get(id=payment_id)
        propietario = payment.reserva.estacionamiento.owner
        
        subject = f"💰 Pago Recibido - Reserva {payment.reserva.codigo_reserva}"
        context = {
            'payment': payment,
            'propietario': propietario
        }
        
        html_message = render_to_string('emails/pago_recibido_propietario.html', context)
        plain_message = render_to_string('emails/pago_recibido_propietario.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[propietario.email],
            html_message=html_message
        )
        
    except Payment.DoesNotExist:
        print(f"Pago {payment_id} no encontrado")

@shared_task
def verificar_pago_pendiente(payment_id):
    """Verifica periódicamente pagos pendientes de Yape/Plin"""
    from .models import Payment
    
    try:
        payment = Payment.objects.get(id=payment_id)
        
        if payment.estado == 'pendiente':
            # En un sistema real, aquí verificarías con las APIs de Yape/Plin
            # Por ahora, dejamos como pendiente hasta confirmación manual
            
            # Re-programar verificación si sigue pendiente (máximo 30 minutos)
            if payment.intentos < 6:
                payment.intentos += 1
                payment.save()
                
                verificar_pago_pendiente.apply_async(
                    args=[payment.id], 
                    countdown=300  # 5 minutos
                )
            else:
                # Marcar como fallido después de varios intentos
                payment.estado = 'fallido'
                payment.ultimo_error = "Tiempo de espera agotado para confirmación"
                payment.save()
                
    except Payment.DoesNotExist:
        print(f"Pago {payment_id} no encontrado")

@shared_task
def enviar_notificacion_reembolso(payment_id):
    """Envía notificación de reembolso"""
    from .models import Payment
    
    try:
        payment = Payment.objects.get(id=payment_id)
        
        subject = f"🔄 Reembolso Procesado - {payment.referencia_pago}"
        context = {'payment': payment}
        
        html_message = render_to_string('emails/notificacion_reembolso.html', context)
        plain_message = render_to_string('emails/notificacion_reembolso.txt', context)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.usuario.email],
            html_message=html_message
        )
        
    except Payment.DoesNotExist:
        print(f"Pago {payment_id} no encontrado")