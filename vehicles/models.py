from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Vehicle(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehiculos')
    placa = models.CharField(max_length=10, unique=True)
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)
    color = models.CharField(max_length=30)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicles'
        verbose_name = 'Vehículo'
        verbose_name_plural = 'Vehículos'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.marca} {self.modelo} - {self.placa}"
    