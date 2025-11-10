# users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrador General'),
        ('owner', 'Dueño de Estacionamiento'), 
        ('client', 'Cliente'),
    )
    
    telefono = models.CharField(max_length=20, blank=True, null=True)
    rol = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    
    # Campos para eliminación suave
    eliminado = models.BooleanField(default=False)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.get_rol_display()})"

    # Propiedades para verificar roles
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
    modelo = models.CharField(max_length=80, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='auto')
    color = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.placa}"

    class Meta:
        verbose_name = 'Vehículo'
        verbose_name_plural = 'Vehículos'