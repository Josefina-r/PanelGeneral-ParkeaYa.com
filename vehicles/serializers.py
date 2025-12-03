from rest_framework import serializers
from django.db import IntegrityError
from .models import Vehicle

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            'id', 'placa', 'marca', 'modelo', 'color',
            'activo', 'fecha_creacion', 'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion']

class CreateVehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['placa', 'marca', 'modelo', 'color']

    def create(self, validated_data):
        try:
            user = self.context['request'].user
            return Vehicle.objects.create(usuario=user, **validated_data)
        except IntegrityError as e:
            if 'vehicles_placa_key' in str(e) or 'duplicate key value' in str(e).lower():
                raise serializers.ValidationError({
                    'placa': 'Ya existe un vehículo con esta placa. Por favor, use una placa diferente.'
                })
            # Para otros errores de integridad
            raise serializers.ValidationError({
                'error': 'Error al crear el vehículo. Verifique los datos.'
            })

    def validate_placa(self, value):
        # Validar formato de placa de automóvil
        value = value.upper().strip().replace(" ", "").replace("-", "")
        
        if len(value) < 6 or len(value) > 8:
            raise serializers.ValidationError("La placa debe tener entre 6 y 8 caracteres")
        
        # Validar formato común de placas (ejemplo: ABC123, ABC12D, AB123C)
        import re
        placa_pattern = re.compile(r'^[A-Z]{2,3}[0-9]{3,4}[A-Z]?$')
        if not placa_pattern.match(value):
            raise serializers.ValidationError("Formato de placa inválido. Use formato: ABC123 o similar")
        
        return value

    def validate(self, data):
        # Validaciones adicionales a nivel de objeto
        placa = data.get('placa', '').upper().strip()
        
        # Verificar si ya existe un vehículo con esta placa para el usuario actual
        user = self.context['request'].user
        if Vehicle.objects.filter(usuario=user, placa=placa).exists():
            raise serializers.ValidationError({
                'placa': 'Ya tienes un vehículo registrado con esta placa'
            })
            
        return data