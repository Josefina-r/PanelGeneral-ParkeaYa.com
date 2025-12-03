from django.utils import timezone
from django.conf import settings


class PaymentService:
    """Servicio para procesar pagos y reembolsos"""
    
    @staticmethod
    def procesar_pago(payment, token_pago=None):
        """Procesa el pago a través del gateway correspondiente"""
        try:
            payment.estado = 'procesando'
            payment.save()
            
            # Lógica según el método de pago
            if payment.metodo == 'yape':
                resultado = PaymentService._procesar_yape(payment, token_pago)
            elif payment.metodo == 'plin':
                resultado = PaymentService._procesar_plin(payment, token_pago)
            elif payment.metodo == 'cash':
                resultado = PaymentService._procesar_cash(payment)
            else:
                raise ValueError(f"Método de pago no soportado: {payment.metodo}")
            
            return resultado
        except Exception as e:
            payment.estado = 'fallido'
            payment.ultimo_error = str(e)
            payment.intentos += 1
            payment.save()
            raise
    
    @staticmethod
    def _procesar_yape(payment, token_pago):
        """Procesa pago mediante Yape"""
        # TODO: Implementar integración con API de Yape
        payment.estado = 'pagado'
        payment.fecha_pago = timezone.now()
        payment.save()
        return {'exito': True, 'mensaje': 'Pago procesado en Yape'}
    
    @staticmethod
    def _procesar_plin(payment, token_pago):
        """Procesa pago mediante Plin"""
        # TODO: Implementar integración con API de Plin
        payment.estado = 'pagado'
        payment.fecha_pago = timezone.now()
        payment.save()
        return {'exito': True, 'mensaje': 'Pago procesado en Plin'}
    
    @staticmethod
    def _procesar_cash(payment):
        """Procesa pago en efectivo"""
        payment.estado = 'pendiente'
        payment.save()
        return {'exito': True, 'mensaje': 'Pago en efectivo registrado, pendiente confirmación'}
    
    @staticmethod
    def reembolsar_pago(payment, monto_parcial=None):
        """Inicia proceso de reembolso"""
        if not payment.puede_reembolsar:
            raise ValueError("Este pago no puede ser reembolsado")
        
        monto_reembolso = monto_parcial or payment.monto
        
        try:
            # TODO: Procesar reembolso con gateway correspondiente
            payment.estado = 'reembolsado'
            payment.fecha_reembolso = timezone.now()
            payment.save()
            return {'exito': True, 'monto_reembolsado': monto_reembolso}
        except Exception as e:
            payment.ultimo_error = f"Error en reembolso: {str(e)}"
            payment.save()
            raise
