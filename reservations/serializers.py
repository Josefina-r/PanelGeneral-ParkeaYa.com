# reservations/serializers.py
from django.utils import timezone
from rest_framework import serializers
from datetime import timedelta
from decimal import Decimal

from .models import Reservation
from users.models import Car
from parking.models import ParkingLot
from users.serializers import CarSerializer, UserSerializer
from parking.serializers import ParkingLotSerializer
from payments.serializers import PaymentSerializer  # ✅ AGREGAR esta importación

# ----------------------------
# Serializers Base
# ----------------------------
class ReservationBaseSerializer(serializers.ModelSerializer):
    tiempo_restante = serializers.SerializerMethodField()
    puede_cancelar = serializers.SerializerMethodField()
    tipo_reserva = serializers.ChoiceField(
        choices=Reservation.TIPO_RESERVA_CHOICES, 
        default='hora'
    )
    
    # ✅ AGREGAR: Campo para username en todas las respuestas
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    
    # ✅ AGREGAR: Información del pago
    payment = PaymentSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'codigo_reserva', 'usuario', 'usuario_nombre', 'vehiculo', 'estacionamiento',
            'hora_entrada', 'hora_salida', 'duracion_minutos', 'costo_estimado',
            'estado', 'tipo_reserva', 'created_at', 'tiempo_restante', 'puede_cancelar',
            'payment'  # ✅ AGREGAR este campo
        ]
        read_only_fields = [
            'codigo_reserva', 'created_at', 'estado', 'costo_estimado', 
            'usuario', 'hora_salida', 'usuario_nombre', 'payment'
        ]

    def get_tiempo_restante(self, obj):
        if obj.estado == 'activa' and obj.hora_entrada:
            now = timezone.now()
            if obj.hora_entrada > now:
                return int((obj.hora_entrada - now).total_seconds() / 60)
        return None

    def get_puede_cancelar(self, obj):
        return (obj.estado == 'activa' and 
                obj.hora_entrada > timezone.now())

# ----------------------------
# Serializers por Rol
# ----------------------------
class ReservationClientSerializer(ReservationBaseSerializer):
    """Serializer para clientes - creación y vista de sus reservas"""
    vehiculo = serializers.PrimaryKeyRelatedField(queryset=Car.objects.all())
    estacionamiento = serializers.PrimaryKeyRelatedField(queryset=ParkingLot.objects.filter(aprobado=True, activo=True))

    class Meta(ReservationBaseSerializer.Meta):
        pass

    def validate(self, data):
        """Validaciones específicas para clientes"""
        tipo_reserva = data.get('tipo_reserva', 'hora')
        duracion_minutos = data.get('duracion_minutos', 0)
        hora_entrada = data.get('hora_entrada')
        estacionamiento = data.get('estacionamiento')
        vehiculo = data.get('vehiculo')

        # Validaciones de tipo de reserva
        if estacionamiento:
            if tipo_reserva == 'dia' and not estacionamiento.precio_dia:
                raise serializers.ValidationError({
                    'tipo_reserva': 'Este estacionamiento no acepta reservas por día.'
                })
            elif tipo_reserva == 'mes' and not estacionamiento.precio_mes:
                raise serializers.ValidationError({
                    'tipo_reserva': 'Este estacionamiento no acepta reservas por mes.'
                })

        # Validaciones de duración mínima
        if tipo_reserva == 'hora' and duracion_minutos < 60:
            raise serializers.ValidationError({
                'duracion_minutos': 'La duración mínima para reserva por hora es 60 minutos.'
            })
        elif tipo_reserva == 'dia' and duracion_minutos < 1440:
            raise serializers.ValidationError({
                'duracion_minutos': 'La duración mínima para reserva por día es 24 horas.'
            })
        elif tipo_reserva == 'mes' and duracion_minutos < 43200:
            raise serializers.ValidationError({
                'duracion_minutos': 'La duración mínima para reserva por mes es 30 días.'
            })

        # Validar que la hora de entrada no sea en el pasado
        if hora_entrada and hora_entrada < timezone.now():
            raise serializers.ValidationError({
                'hora_entrada': 'No se pueden hacer reservas en el pasado.'
            })

        # Validar que el vehículo pertenece al usuario
        request = self.context.get('request')
        if request and vehiculo and vehiculo.usuario != request.user:
            raise serializers.ValidationError({
                'vehiculo': 'Este vehículo no pertenece al usuario.'
            })

        return data

    def create(self, validated_data):
        """Crear reserva con cálculo automático"""
        hora_entrada = validated_data['hora_entrada']
        duracion_minutos = validated_data['duracion_minutos']
        tipo_reserva = validated_data['tipo_reserva']
        estacionamiento = validated_data['estacionamiento']
        vehiculo = validated_data['vehiculo']

        # Calcular hora de salida
        hora_salida = hora_entrada + timedelta(minutes=duracion_minutos)
        validated_data['hora_salida'] = hora_salida

        # Calcular costo estimado
        costo_estimado = estacionamiento.calcular_costo_reserva(
            tipo_reserva=tipo_reserva,
            duracion_minutos=duracion_minutos,
            tipo_vehiculo=vehiculo.tipo
        )
        validated_data['costo_estimado'] = costo_estimado

        # Asignar usuario
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['usuario'] = request.user

        return super().create(validated_data)

class ReservationOwnerSerializer(ReservationBaseSerializer):
    """Serializer para dueños - vista de reservas de sus estacionamientos"""
    usuario_info = UserSerializer(source='usuario', read_only=True)
    vehiculo_info = CarSerializer(source='vehiculo', read_only=True)
    estacionamiento_info = ParkingLotSerializer(source='estacionamiento', read_only=True)
    
    # ✅ AGREGAR: Campos específicos que necesita el frontend
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    telefono_formateado = serializers.CharField(source='usuario.telefono_formateado', read_only=True)
    
    # ✅ AGREGAR: Campos de vehículo en formato plano para el frontend
    placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    modelo = serializers.CharField(source='vehiculo.modelo', read_only=True)
    
    # ✅ AGREGAR: Campo de spot/espacio de estacionamiento
    spot_number = serializers.SerializerMethodField(read_only=True)
    
    class Meta(ReservationBaseSerializer.Meta):
        fields = ReservationBaseSerializer.Meta.fields + [
            'usuario_info', 'vehiculo_info', 'estacionamiento_info',
            'usuario_nombre', 'telefono_formateado', 'placa', 'modelo',
            'spot_number'
        ]
    
    def get_spot_number(self, obj):
        """Obtener número de spot asignado"""
        if hasattr(obj, 'spot') and obj.spot:
            # Si la reserva tiene referencia directa al spot
            try:
                return obj.spot.number
            except Exception:
                return None
        # Si el estacionamiento gestiona spots mediante un método
        if hasattr(obj.estacionamiento, 'get_assigned_spot'):
            try:
                assigned = obj.estacionamiento.get_assigned_spot(obj)
                return getattr(assigned, 'number', None)
            except Exception:
                return None
        return None

class ReservationAdminSerializer(ReservationBaseSerializer):
    """Serializer para administradores - información completa"""
    usuario_info = UserSerializer(source='usuario', read_only=True)
    vehiculo_info = CarSerializer(source='vehiculo', read_only=True)
    estacionamiento_info = ParkingLotSerializer(source='estacionamiento', read_only=True)

    class Meta(ReservationBaseSerializer.Meta):
        fields = ReservationBaseSerializer.Meta.fields + [
            'usuario_info', 'vehiculo_info', 'estacionamiento_info'
        ]

class ReservationDetailSerializer(ReservationBaseSerializer):
    """Serializer para detalles - común a todos los roles"""
    usuario = UserSerializer(read_only=True)
    vehiculo = CarSerializer(read_only=True)
    estacionamiento = ParkingLotSerializer(read_only=True)

    class Meta(ReservationBaseSerializer.Meta):
        read_only_fields = ReservationBaseSerializer.Meta.fields

# ----------------------------
# Serializers para Actions
# ----------------------------
class ExtendReservationSerializer(serializers.Serializer):
    minutos_extra = serializers.IntegerField(min_value=1)
    tipo_reserva = serializers.ChoiceField(
        choices=Reservation.TIPO_RESERVA_CHOICES, 
        required=False
    )

class CheckInResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    reserva = ReservationDetailSerializer()

class CheckOutResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    costo_final = serializers.DecimalField(max_digits=8, decimal_places=2)
    tiempo_estacionado_minutos = serializers.FloatField()
    tipo_reserva = serializers.CharField()
    reserva = ReservationDetailSerializer()

# ----------------------------
# Serializers para Stats
# ----------------------------
class ReservationStatsSerializer(serializers.Serializer):
    total_reservas = serializers.IntegerField()
    reservas_activas = serializers.IntegerField()
    por_tipo_reserva = serializers.DictField()
    por_tipo_vehiculo = serializers.ListField()

class ParkingReservationsResponseSerializer(serializers.Serializer):
    estacionamiento = serializers.CharField()
    total_reservas = serializers.IntegerField()
    reservas = ReservationDetailSerializer(many=True)