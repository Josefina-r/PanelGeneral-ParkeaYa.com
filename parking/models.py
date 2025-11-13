# models.py - SOLO CAMBIOS SOLICITADOS
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from decimal import Decimal


class ParkingLot(models.Model):
    # Opciones para nivel de seguridad - NUEVO
    NIVEL_SEGURIDAD_CHOICES = [
        ('Básico', 'Básico'),
        ('Estándar', 'Estándar'),
        ('Premium', 'Premium'),
        ('Alto', 'Alto'),
    ]
    
    dueno = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parkings')
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    coordenadas = models.CharField(max_length=100)
    telefono = models.CharField(
        max_length=15,
        validators=[RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Número de teléfono inválido.")]
    )
    descripcion = models.TextField(blank=True)
    
    # CAMBIO: Eliminar valores por defecto, permitir null para 24 horas
    horario_apertura = models.TimeField(null=True, blank=True)
    horario_cierre = models.TimeField(null=True, blank=True)
    
    # CAMBIO: Agregar choices para nivel de seguridad
    nivel_seguridad = models.CharField(
        max_length=20, 
        choices=NIVEL_SEGURIDAD_CHOICES, 
        default='Estándar'
    )
    
    tarifa_hora = models.DecimalField(max_digits=6, decimal_places=2)
    total_plazas = models.PositiveIntegerField()
    plazas_disponibles = models.PositiveIntegerField()
    rating_promedio = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    total_reseñas = models.PositiveIntegerField(default=0)
    aprobado = models.BooleanField(default=False) 
    activo = models.BooleanField(default=False)  

    class Meta:
        indexes = [
            models.Index(fields=['direccion']),
            models.Index(fields=['nivel_seguridad']),
        ]
        ordering = ['-rating_promedio']

    def __str__(self):
        return f"{self.nombre} ({self.direccion})"

    def save(self, *args, **kwargs):
        if self.plazas_disponibles > self.total_plazas:
            raise ValueError("Las plazas disponibles no pueden exceder el total.")
        super().save(*args, **kwargs)

    def esta_abierto(self):
        """Verifica si el estacionamiento está abierto según su horario configurado"""
        if not self.horario_apertura or not self.horario_cierre:
            return True  # 24 horas
        ahora = timezone.localtime().time()
        if self.horario_apertura < self.horario_cierre:
            return self.horario_apertura <= ahora <= self.horario_cierre
        else:
            return ahora >= self.horario_apertura or ahora <= self.horario_cierre

    def calcular_costo_reserva(self, tipo_reserva, duracion_minutos, tipo_vehiculo):
        precio_base_por_minuto = float(self.tarifa_hora) / 60.0

        multiplicadores = {
            'auto': 1.0,
            'moto': 0.7,
            'camioneta': 1.3
        }

        multiplicador = multiplicadores.get(tipo_vehiculo, 1.0)

        if tipo_reserva == 'hora':
            costo = precio_base_por_minuto * duracion_minutos * multiplicador
        elif tipo_reserva == 'dia':
            costo = float(self.tarifa_hora) * 24 * (duracion_minutos / 1440) * multiplicador
        elif tipo_reserva == 'mes':
            costo = float(self.tarifa_hora) * 24 * 30 * (duracion_minutos / 43200) * multiplicador
        else:
            costo = precio_base_por_minuto * duracion_minutos * multiplicador

        return Decimal(str(round(costo, 2)))


class ParkingImage(models.Model):
    # DEJAR EXACTAMENTE IGUAL - NO CAMBIAR NADA
    estacionamiento = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='imagenes')
    imagen = models.ImageField(upload_to='parking_images/')
    descripcion = models.CharField(max_length=100, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"Imagen de {self.estacionamiento.nombre}"


class ParkingReview(models.Model):
    # DEJAR EXACTAMENTE IGUAL - NO CAMBIAR NADA
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    estacionamiento = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='reseñas')
    comentario = models.TextField(blank=True)
    calificacion = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('usuario', 'estacionamiento')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        estacionamiento = self.estacionamiento
        reseñas = estacionamiento.reseñas.all()
        if reseñas:
            estacionamiento.rating_promedio = sum(r.calificacion for r in reseñas) / len(reseñas)
            estacionamiento.total_reseñas = len(reseñas)
            estacionamiento.save()


class ParkingApprovalRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('APPROVED', 'Aprobado'),
        ('REJECTED', 'Rechazado'),
    ]

    # Información del estacionamiento
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    coordenadas = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(
        max_length=15,
        validators=[RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Número de teléfono inválido.")],
        blank=True
    )
    descripcion = models.TextField(blank=True)
    
    # CAMBIO: Eliminar valores por defecto aquí también
    horario_apertura = models.TimeField(null=True, blank=True)
    horario_cierre = models.TimeField(null=True, blank=True)
    
    # CAMBIO: Usar las mismas choices
    nivel_seguridad = models.CharField(
        max_length=20, 
        choices=ParkingLot.NIVEL_SEGURIDAD_CHOICES, 
        default='Estándar'
    )
    
    tarifa_hora = models.DecimalField(max_digits=6, decimal_places=2)
    total_plazas = models.PositiveIntegerField()
    plazas_disponibles = models.PositiveIntegerField()

    # Servicios adicionales
    servicios = models.JSONField(default=list, blank=True)

    # Información de la solicitud
    panel_local_id = models.CharField(max_length=100)
    notas_aprobacion = models.TextField(blank=True)
    motivo_rechazo = models.TextField(blank=True)

    # Estado y auditoría
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='solicitudes_aprobacion'
    )
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes_revisadas'
    )

    # Timestamps
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_revision = models.DateTimeField(null=True, blank=True)

    # Relación con el estacionamiento creado
    estacionamiento_creado = models.OneToOneField(
        ParkingLot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitud_aprobacion'
    )

    class Meta:
        ordering = ['-fecha_solicitud']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['panel_local_id']),
            models.Index(fields=['fecha_solicitud']),
        ]

    def __str__(self):
        return f"Solicitud: {self.nombre} - {self.get_status_display()}"

    def save(self, *args, **kwargs):
        if self.status == 'APPROVED' and not self.estacionamiento_creado:
            self.crear_estacionamiento()
        if self.status in ['APPROVED', 'REJECTED'] and not self.fecha_revision:
            self.fecha_revision = timezone.now()
        super().save(*args, **kwargs)

    def crear_estacionamiento(self):
        try:
            parking = ParkingLot.objects.create(
                dueno=self.solicitado_por,
                nombre=self.nombre,
                direccion=self.direccion,
                coordenadas=self.coordenadas,
                telefono=self.telefono,
                descripcion=self.descripcion,
                horario_apertura=self.horario_apertura,
                horario_cierre=self.horario_cierre,
                nivel_seguridad=self.nivel_seguridad,
                tarifa_hora=self.tarifa_hora,
                total_plazas=self.total_plazas,
                plazas_disponibles=self.plazas_disponibles,
                aprobado=True,
                activo=True
            )
            self.estacionamiento_creado = parking
            super().save(update_fields=['estacionamiento_creado'])
            return parking
        except Exception as e:
            print(f"Error creando estacionamiento: {e}")
            return None

    def aprobar(self, usuario_revisor):
        self.status = 'APPROVED'
        self.revisado_por = usuario_revisor
        self.fecha_revision = timezone.now()
        self.save()

    def rechazar(self, usuario_revisor, motivo=""):
        self.status = 'REJECTED'
        self.revisado_por = usuario_revisor
        self.motivo_rechazo = motivo
        self.fecha_revision = timezone.now()
        self.save()

    @property
    def dias_pendiente(self):
        if self.status == 'PENDING':
            return (timezone.now() - self.fecha_solicitud).days
        return 0