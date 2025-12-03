from django.db import models
from django.conf import settings
from reservations.models import Reservation
from django.core.files.base import ContentFile
import qrcode
from io import BytesIO
import uuid
import json
from django.utils import timezone
from users.models import User

class Ticket(models.Model):
    ESTADO_CHOICES = (
        ('valido', 'Válido'),
        ('usado', 'Usado'),
        ('expirado', 'Expirado'),
        ('cancelado', 'Cancelado'),
    )

    TIPOS_TICKET = [
        ('reserva', 'Reserva'),
        ('pago_validado', 'Pago Validado por Owner'),
        ('manual', 'Manual'),
    ]
    
    # Identificadores únicos
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo_ticket = models.CharField(max_length=50, unique=True, blank=True)
    
    # Relaciones
    reserva = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='tickets')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tickets')
    
    # Información del ticket
    tipo = models.CharField(max_length=20, choices=TIPOS_TICKET, default='reserva')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    qr_image = models.ImageField(upload_to='tickets/qr/', blank=True, null=True)
    qr_data = models.TextField(null=True, blank=True)  # Datos del QR en texto
    
    # Tiempos
    fecha_emision = models.DateTimeField(auto_now_add=True)
    fecha_validez_desde = models.DateTimeField(null=True, blank=True)
    fecha_validez_hasta = models.DateTimeField(null=True, blank=True)
    fecha_validacion = models.DateTimeField(null=True, blank=True)
    fecha_uso = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    validado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='tickets_validados'
    )
    intentos_validacion = models.PositiveIntegerField(default=0)
    ultimo_error = models.TextField(blank=True, null=True)
    
    # Notas internas
    notas = models.TextField(blank=True, null=True)
    datos_adicionales = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-fecha_emision']
        indexes = [
            models.Index(fields=['codigo_ticket']),
            models.Index(fields=['estado', 'fecha_emision']),
            models.Index(fields=['reserva']),
        ]
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'

    def __str__(self):
        return f"Ticket {self.codigo_ticket} - {self.reserva.codigo_reserva}"

    def save(self, *args, **kwargs):
        # Generar código único al crear
        if not self.codigo_ticket:
            self.codigo_ticket = self.generar_codigo_ticket()
        
        # Establecer fechas de validez basadas en la reserva
        if not self.fecha_validez_desde and self.reserva:
            
            self.fecha_validez_desde = self.reserva.hora_entrada - timezone.timedelta(minutes=15)
        
        if not self.fecha_validez_hasta and self.reserva:
            
            self.fecha_validez_hasta = self.reserva.hora_entrada + timezone.timedelta(minutes=30)
        
        # Generar QR si no existe
        if not self.qr_image:
            self.generar_qr()
        
        super().save(*args, **kwargs)

    def generar_codigo_ticket(self):
        """Genera un código único para el ticket"""
        import random
        import string
        return f"TKT-{''.join(random.choices(string.ascii_uppercase + string.digits, k=12))}"

    def generar_qr(self):
        """Genera el código QR con datos estructurados"""
        payload = {
            "ticket_id": str(self.id),
            "codigo_ticket": self.codigo_ticket,
            "codigo_reserva": str(self.reserva.codigo_reserva),
            "reserva_id": str(self.reserva.id),
            "usuario_id": str(self.reserva.usuario.id),
            "estacionamiento_id": str(self.reserva.estacionamiento.id),
            "estacionamiento_nombre": self.reserva.estacionamiento.nombre,
            "vehiculo_placa": self.reserva.vehiculo.placa if hasattr(self.reserva.vehiculo, 'placa') else "N/A",
            "fecha_entrada": self.reserva.hora_entrada.isoformat() if self.reserva.hora_entrada else None,
            "tipo": "acceso_estacionamiento",
            "version": "1.0"
        }
        
        # Guardar datos en texto para fácil acceso
        self.qr_data = json.dumps(payload, ensure_ascii=False)
        
        # Generar imagen QR
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(self.qr_data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        # Guardar imagen
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        filename = f"ticket_{self.codigo_ticket}_{self.reserva.codigo_reserva}.png"
        self.qr_image.save(filename, ContentFile(buffer.getvalue()), save=False)
        buffer.close()

    @property
    def puede_validar(self):
    
        ahora = timezone.now()
        
        if self.estado != 'valido':
            return False, f"Ticket no está válido. Estado: {self.estado}"
        
        if self.fecha_validez_desde and ahora < self.fecha_validez_desde:
            return False, "El ticket aún no es válido"
        
        if self.fecha_validez_hasta and ahora > self.fecha_validez_hasta:
            return False, "El ticket ha expirado"
        
        if self.fecha_expiracion and ahora > self.fecha_expiracion:
            return False, "El ticket ha expirado"
        
        return True, "Válido"

    @property
    def tiempo_restante_validez(self):
        """Calcula tiempo restante para usar el ticket"""
        if not self.fecha_validez_hasta or self.estado != 'valido':
            return 0
        
        ahora = timezone.now()
        if ahora > self.fecha_validez_hasta:
            return 0
        
        segundos_restantes = (self.fecha_validez_hasta - ahora).total_seconds()
        return max(0, int(segundos_restantes))

    def validar_ticket(self, usuario_validador=None):
        """Valida el ticket (check-in)"""
        puede, mensaje = self.puede_validar
        
        if not puede:
            self.intentos_validacion += 1
            self.ultimo_error = mensaje
            self.save()
            return False, mensaje

        # Marcar como usado
        self.estado = 'usado'
        self.fecha_validacion = timezone.now()
        self.validado_por = usuario_validador
        self.intentos_validacion += 1
        self.save()

        # Registrar en el historial
        TicketHistory.objects.create(
            ticket=self,
            accion='validado',
            detalles=f"Ticket validado por {usuario_validador.username if usuario_validador else 'sistema'}",
            usuario=usuario_validador
        )

        return True, "Ticket validado exitosamente"

    def expirar_ticket(self):
        """Marca el ticket como expirado"""
        if self.estado == 'valido':
            self.estado = 'expirado'
            self.fecha_expiracion = timezone.now()
            self.save()

            # Registrar en historial
            TicketHistory.objects.create(
                ticket=self,
                accion='expirado',
                detalles="Ticket expirado automáticamente",
                usuario=None
            )

    def cancelar_ticket(self, motivo=None):
        """Cancela el ticket"""
        if self.estado == 'valido':
            self.estado = 'cancelado'
            self.save()

            TicketHistory.objects.create(
                ticket=self,
                accion='cancelado',
                detalles=f"Ticket cancelado: {motivo}",
                usuario=None
            )

    def generar_qr_data(self):
        """Genera los datos del QR en formato JSON"""
        import json
        qr_info = {
            'ticket_id': str(self.id),
            'codigo': self.codigo_ticket,
            'reserva_id': str(self.reserva.id),
            'usuario_id': str(self.usuario.id),
            'fecha_validez': self.fecha_validez_hasta.isoformat() if self.fecha_validez_hasta else None,
            'tipo': self.tipo
        }
        self.qr_data = json.dumps(qr_info)
        # evitar recursion en save -> solo actualizar campo qr_data rápidamente
        Ticket.objects.filter(pk=self.pk).update(qr_data=self.qr_data)
        return self.qr_data
    
    @property
    def es_valido(self):
        ahora = timezone.now()
        return (
            self.estado == 'valido' and
            (self.fecha_validez_desde is None or self.fecha_validez_desde <= ahora) and
            (self.fecha_validez_hasta is None or ahora <= self.fecha_validez_hasta)
        )


class TicketHistory(models.Model):
    """Auditoría de cambios en tickets"""
    ACCION_CHOICES = (
        ('creado', 'Creado'),
        ('validado', 'Validado'),
        ('expirado', 'Expirado'),
        ('cancelado', 'Cancelado'),
        ('error_validacion', 'Error Validación'),
    )

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='historial')
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    detalles = models.TextField()
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-fecha_creacion']
        verbose_name = 'Historial de Ticket'
        verbose_name_plural = 'Historial de Tickets'

    def __str__(self):
        return f"{self.ticket.codigo_ticket} - {self.accion}"