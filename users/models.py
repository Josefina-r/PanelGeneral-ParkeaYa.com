# users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
import re

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrador General'),
        ('owner', 'Dueño de Estacionamiento'), 
        ('client', 'Cliente'),
    )
    
    #  NUEVO: Definir choices para tipo de documento
    TIPO_DOCUMENTO_CHOICES = (
        ('dni', 'DNI'),
        ('pasaporte', 'Pasaporte'),
        ('carnet_extranjeria', 'Carnet de Extranjería'),
    )
    
    # Campos existentes
    telefono = models.CharField(max_length=20, blank=True, null=True)
    rol = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    
    #  NUEVOS CAMPOS PARA EL FORMULARIO
    tipo_documento = models.CharField(
        max_length=20, 
        choices=TIPO_DOCUMENTO_CHOICES, 
        blank=True, 
        null=True
    )
    numero_documento = models.CharField(max_length=20, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    codigo_postal = models.CharField(max_length=10, blank=True, null=True)
    pais = models.CharField(max_length=50, default='Perú', blank=True, null=True)
    
    # Campos para eliminación suave (NO DUPLICAR)
    eliminado = models.BooleanField(default=False)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.get_rol_display()})"

    #  NUEVO: Método para obtener datos completos del perfil
    def obtener_perfil_completo(self):
        """Retorna todos los datos del perfil en formato diccionario"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'telefono': self.telefono,
            'rol': self.rol,
            'rol_display': self.get_rol_display(),
            'tipo_documento': self.tipo_documento,
            'numero_documento': self.numero_documento,
            'fecha_nacimiento': self.fecha_nacimiento.isoformat() if self.fecha_nacimiento else None,
            'direccion': self.direccion,
            'codigo_postal': self.codigo_postal,
            'pais': self.pais,
            'fecha_registro': self.fecha_registro.isoformat(),
            'is_admin': self.is_admin_general,
            'is_owner': self.is_owner,
            'is_client': self.is_client
        }

    #  NUEVO: Propiedad para teléfono formateado
    @property
    def telefono_formateado(self):
        if self.telefono and len(self.telefono) == 9:
            return f"+51 {self.telefono}"
        return self.telefono

    #  NUEVO: Propiedad para edad
    @property
    def edad(self):
        if self.fecha_nacimiento:
            today = timezone.now().date()
            return today.year - self.fecha_nacimiento.year - (
                (today.month, today.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day)
            )
        return None

    # Propiedades para verificar roles (EXISTENTES)
    @property
    def is_admin_general(self):
        return self.rol == 'admin'
    
    @property
    def is_owner(self):
        return self.rol == 'owner'
    
    @property
    def is_client(self):
        return self.rol == 'client'

    def soft_delete(self):
        """Marca el usuario como eliminado sin borrarlo de la BD"""
        self.eliminado = True
        self.activo = False
        self.is_active = False
        self.fecha_eliminacion = timezone.now()
        # Cambiar username y email para evitar conflictos
        self.username = f"deleted_{self.id}_{self.username}"[:150]
        if self.email:
            self.email = f"deleted_{self.id}_{self.email}"[:254]
        self.save()

    class Meta:
        db_table = 'auth_user'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

class Car(models.Model):
    TIPO_CHOICES = (
        ('auto', 'Auto'),
        ('moto', 'Moto'),
        ('camioneta', 'Camioneta'),
    )
    
    usuario = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,
        related_name='cars',
        null=True,
        blank=True
    )
    placa = models.CharField(max_length=20, unique=True)
    marca = models.CharField(max_length=50, blank=True)
    modelo = models.CharField(max_length=80, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='auto')
    color = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.placa}"

    class Meta:
        verbose_name = 'Vehículo'
        verbose_name_plural = 'Vehículos'


#solicitud
class SolicitudAccesoOwner(models.Model):
    ESTADO_CHOICES = (
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
    )
    #campos del formulario
    nombre = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    telefono = models.CharField(max_length=20)
    empresa = models.CharField(max_length=200)  # nombre del estacionamiento
    mensaje = models.TextField(blank=True)
    
    # Metadatos
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_revision = models.DateTimeField(null=True, blank=True)
    revisado_por = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='solicitudes_acceso_owner_revisadas'  
    )
    comentarios_rechazo = models.TextField(blank=True)
    
    # Usuario creado (si se aprueba)
    usuario_creado = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitud_origen')
    
    def __str__(self):
        return f"{self.empresa} - {self.email}"
    
    class Meta:
        verbose_name = 'Solicitud de Acceso Owner'
        verbose_name_plural = 'Solicitudes de Acceso Owner'
        ordering = ['-fecha_solicitud']