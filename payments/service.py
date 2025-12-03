from django.conf import settings
from django.utils import timezone
import requests
import json

class PaymentService:
    """Servicio para manejar integraciones con gateways de pago"""
    
    @staticmethod
    def procesar_pago(payment, token_pago=None):
        """Procesa el pago según el método seleccionado"""
        try:
            payment.estado = 'procesando'
            payment.intentos += 1
            payment.save()

            if payment.metodo == 'tarjeta':
                return PaymentService._procesar_tarjeta(payment, token_pago)
            elif payment.metodo in ['yape', 'plin']:
                return PaymentService._procesar_billetera_digital(payment)
            else:
                raise ValueError(f"Método de pago no soportado: {payment.metodo}")
                
        except Exception as e:
            payment.estado = 'fallido'
            payment.ultimo_error = str(e)
            payment.save()
            return False

    @staticmethod
    def _procesar_tarjeta(payment, token_pago):
        """Integración con gateway de tarjetas (Culqi)"""
        try:
            # Configuración para Culqi
            headers = {
                'Authorization': f'Bearer {settings.CULQI_SECRET_KEY}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'amount': int(payment.monto * 100),  # Convertir a centavos
                'currency_code': payment.moneda,
                'email': payment.usuario.email,
                'source_id': token_pago,
                'description': f'Reserva {payment.reserva.codigo_reserva}',
                'capture': True,
                'metadata': {
                    'reserva_id': str(payment.reserva.id),
                    'user_id': str(payment.usuario.id)
                }
            }
            
            # En producción, descomentar:
            # response = requests.post('https://api.culqi.com/v2/charges', 
            #                        headers=headers, json=payload, timeout=30)
            # response_data = response.json()
            
            # Simulación de respuesta exitosa para desarrollo
            response_data = {
                'id': f'ch_sim_{payment.referencia_pago}',
                'outcome': {'type': 'venta_exitosa'},
                'paid': True,
                'amount': int(payment.monto * 100)
            }
            
            if response_data.get('id') and response_data.get('paid', False):
                payment.estado = 'pagado'
                payment.id_transaccion = response_data['id']
                payment.datos_gateway = response_data
                payment.fecha_pago = timezone.now()
                payment.calcular_comisiones()
                payment.save()
                
                # Acciones post-pago exitoso
                PaymentService._post_pago_exitoso(payment)
                return True
            else:
                error_msg = response_data.get('merchant_message', 'Error en el procesamiento de tarjeta')
                raise Exception(error_msg)
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error de conexión con gateway: {str(e)}")
        except Exception as e:
            raise Exception(f"Error procesando tarjeta: {str(e)}")

    @staticmethod
    def _procesar_billetera_digital(payment):
        """Para Yape/Plin - marcamos como pendiente de confirmación"""
        # En un sistema real, integrarías con:
        # - API de Yape (si está disponible)
        # - API de Plin (si está disponible)
        # Por ahora queda pendiente hasta confirmación manual
        
        payment.estado = 'pendiente'
        payment.save()
        
        # Enviar notificación con datos para pago
        from .tasks import enviar_instrucciones_billetera
        enviar_instrucciones_billetera.delay(payment.id)
        
        return True

    @staticmethod
    def _post_pago_exitoso(payment):
        """Acciones después de un pago exitoso"""
        from tickets.models import Ticket
        from .tasks import enviar_comprobante_pago, notificar_pago_propietario
        
        # Crear ticket automáticamente
        Ticket.objects.get_or_create(
            reserva=payment.reserva,
            defaults={
                'codigo_ticket': f"TKT-{payment.referencia_pago}",
                'estado': 'activo'
            }
        )
        
        # Enviar notificaciones
        enviar_comprobante_pago.delay(payment.id)
        notificar_pago_propietario.delay(payment.id)

    @staticmethod
    def confirmar_pago_billetera(payment_id, comprobante=None):
        """Confirma manualmente un pago de Yape/Plin"""
        from .models import Payment
        
        try:
            payment = Payment.objects.get(id=payment_id)
            
            if payment.estado != 'pendiente':
                return False, "El pago ya fue procesado"
            
            payment.estado = 'pagado'
            payment.fecha_pago = timezone.now()
            payment.datos_gateway['comprobante_manual'] = comprobante
            payment.datos_gateway['confirmado_por'] = 'admin'
            payment.calcular_comisiones()
            payment.save()
            
            PaymentService._post_pago_exitoso(payment)
            return True, "Pago confirmado exitosamente"
            
        except Payment.DoesNotExist:
            return False, "Pago no encontrado"

    @staticmethod
    def reembolsar_pago(payment, monto_parcial=None):
        """Procesa reembolso del pago"""
        try:
            monto_reembolso = monto_parcial or payment.monto
            
            # Lógica de reembolso según el método
            if payment.metodo == 'tarjeta':
                success = PaymentService._reembolsar_tarjeta(payment, monto_reembolso)
            else:
                # Para Yape/Plin, marcamos como reembolsado internamente
                # En producción, integrar con APIs de reembolso
                success = True
            
            if success:
                payment.estado = 'reembolsado'
                payment.fecha_reembolso = timezone.now()
                if monto_parcial:
                    payment.datos_gateway['reembolso_parcial'] = float(monto_parcial)
                payment.save()
                
                # Notificar reembolso
                from .tasks import enviar_notificacion_reembolso
                enviar_notificacion_reembolso.delay(payment.id)
                
                return True
            else:
                return False
                
        except Exception as e:
            payment.ultimo_error = f"Error reembolso: {str(e)}"
            payment.save()
            return False

    @staticmethod
    def _reembolsar_tarjeta(payment, monto):
        """Reembolso en gateway de tarjetas"""
        try:
            headers = {
                'Authorization': f'Bearer {settings.CULQI_SECRET_KEY}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'amount': int(monto * 100),
                'reason': 'solicitud_cliente'
            }
            
            # En producción:
            # response = requests.post(f'https://api.culqi.com/v2/charges/{payment.id_transaccion}/refunds',
            #                        headers=headers, json=payload)
            # response_data = response.json()
            
            # Simulación
            response_data = {'id': f'ref_sim_{payment.id_transaccion}', 'object': 'refund'}
            
            if response_data.get('id'):
                payment.datos_gateway['reembolso_id'] = response_data['id']
                return True
            else:
                return False
                
        except Exception:
            return False