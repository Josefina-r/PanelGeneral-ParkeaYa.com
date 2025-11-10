# parking/serializers.py
from rest_framework import serializers
from django.core.validators import RegexValidator
from .models import ParkingLot, ParkingImage, ParkingReview, ParkingApprovalRequest
from django.contrib.auth import get_user_model

User = get_user_model()

# ----------------------------
# Serializers Base
# ----------------------------
class ParkingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingImage
        fields = ['id', 'imagen', 'descripcion', 'creado_en']

class ParkingReviewSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = ParkingReview
        fields = ['id', 'usuario', 'usuario_nombre', 'calificacion', 'comentario', 'fecha']
        read_only_fields = ['usuario', 'fecha']

# ----------------------------
# Parking Lots - Por Rol
# ----------------------------
class ParkingLotBaseSerializer(serializers.ModelSerializer):
    esta_abierto = serializers.BooleanField(read_only=True)
    porcentaje_ocupacion = serializers.SerializerMethodField()
    dueno_nombre = serializers.CharField(source='dueno.username', read_only=True)
    
    telefono = serializers.CharField(
        validators=[
            RegexValidator(
                regex=r'^\+?1?\d{9,15}$',
                message="Número de teléfono inválido."
            )
        ]
    )

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'dueno', 'dueno_nombre', 'nombre', 'direccion',
            'tarifa_hora', 'total_plazas', 'plazas_disponibles',
            'nivel_seguridad', 'descripcion', 'coordenadas',
            'horario_apertura', 'horario_cierre', 'telefono',
            'rating_promedio', 'total_reseñas', 'esta_abierto',
            'porcentaje_ocupacion', 'aprobado', 'activo'
        ]

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas == 0:
            return 0
        return round(((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100, 2)

class ParkingLotSerializer(ParkingLotBaseSerializer):
    class Meta(ParkingLotBaseSerializer.Meta):
        model = ParkingLot
    
    telefono = serializers.CharField(
        validators=[
            RegexValidator(
                regex=r'^\+?1?\d{9,15}$',
                message="Número de teléfono inválido."
            )
        ]
    )

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'dueno', 'dueno_nombre', 'nombre', 'direccion',
            'tarifa_hora', 'total_plazas', 'plazas_disponibles',
            'nivel_seguridad', 'descripcion', 'coordenadas',
            'horario_apertura', 'horario_cierre', 'telefono',
            'rating_promedio', 'total_reseñas', 'esta_abierto',
            'porcentaje_ocupacion', 'aprobado', 'activo'
        ]
        read_only_fields = ['rating_promedio', 'total_reseñas']

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

class ParkingLotClientSerializer(ParkingLotBaseSerializer):
    """Serializer para clientes - solo información pública"""
    class Meta(ParkingLotBaseSerializer.Meta):
        fields = [field for field in ParkingLotBaseSerializer.Meta.fields 
                 if field not in ['dueno', 'dueno_nombre']]

class ParkingLotOwnerSerializer(ParkingLotBaseSerializer):
    """Serializer para dueños - información completa de SU estacionamiento"""
    imagenes = ParkingImageSerializer(many=True, read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)

    class Meta(ParkingLotBaseSerializer.Meta):
        fields = ParkingLotBaseSerializer.Meta.fields + ['imagenes', 'reseñas']

class ParkingLotAdminSerializer(ParkingLotBaseSerializer):
    """Serializer para administradores - información completa + gestión"""
    imagenes = ParkingImageSerializer(many=True, read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)
    dueno_email = serializers.CharField(source='dueno.email', read_only=True)
    dueno_telefono = serializers.CharField(source='dueno.telefono', read_only=True)

    class Meta(ParkingLotBaseSerializer.Meta):
        fields = ParkingLotBaseSerializer.Meta.fields + [
            'imagenes', 'reseñas', 'dueno_email', 'dueno_telefono'
        ]

class ParkingLotListSerializer(serializers.ModelSerializer):
    """Serializer para listas - optimizado para performance"""
    esta_abierto = serializers.BooleanField(read_only=True)
    imagen_principal = serializers.SerializerMethodField()
    porcentaje_ocupacion = serializers.SerializerMethodField()

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'plazas_disponibles',
            'nivel_seguridad', 'coordenadas', 'esta_abierto',
            'rating_promedio', 'imagen_principal', 'porcentaje_ocupacion',
            'aprobado', 'activo'
        ]

    def get_imagen_principal(self, obj):
        imagen_principal = obj.imagenes.first()
        if imagen_principal:
            return imagen_principal.imagen.url
        return None

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

# ----------------------------
# Parking Approval System
# ----------------------------
class ParkingApprovalRequestSerializer(serializers.ModelSerializer):
    solicitado_por_nombre = serializers.CharField(source='solicitado_por.username', read_only=True)
    revisado_por_nombre = serializers.CharField(source='revisado_por.username', read_only=True)
    dias_pendiente = serializers.ReadOnlyField()
    estacionamiento_creado_id = serializers.IntegerField(source='estacionamiento_creado.id', read_only=True)

    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'id', 'nombre', 'direccion', 'coordenadas', 'telefono', 'descripcion',
            'horario_apertura', 'horario_cierre', 'nivel_seguridad', 'tarifa_hora',
            'total_plazas', 'plazas_disponibles', 'servicios', 'panel_local_id',
            'notas_aprobacion', 'motivo_rechazo', 'status', 'solicitado_por',
            'solicitado_por_nombre', 'revisado_por', 'revisado_por_nombre',
            'fecha_solicitud', 'fecha_revision', 'estacionamiento_creado',
            'estacionamiento_creado_id', 'dias_pendiente'
        ]
        read_only_fields = ['solicitado_por', 'fecha_solicitud', 'fecha_revision', 'estacionamiento_creado']

class ParkingApprovalActionSerializer(serializers.Serializer):
    motivo = serializers.CharField(required=False, allow_blank=True)

class ParkingApprovalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'nombre', 'direccion', 'coordenadas', 'telefono', 'descripcion',
            'horario_apertura', 'horario_cierre', 'nivel_seguridad', 'tarifa_hora',
            'total_plazas', 'plazas_disponibles', 'servicios', 'panel_local_id',
            'notas_aprobacion'
        ]

class ParkingApprovalDashboardSerializer(serializers.ModelSerializer):
    solicitado_por_nombre = serializers.CharField(source='solicitado_por.username', read_only=True)
    dias_pendiente = serializers.ReadOnlyField()

    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'total_plazas',
            'nivel_seguridad', 'fecha_solicitud', 'status', 'solicitado_por_nombre',
            'dias_pendiente', 'panel_local_id'
        ]

# ----------------------------
# Dashboard Serializers
# ----------------------------
class AdminDashboardStatsSerializer(serializers.Serializer):
    total_parkings = serializers.IntegerField()
    active_parkings = serializers.IntegerField()
    approved_parkings = serializers.IntegerField()
    pending_approvals = serializers.IntegerField()
    total_users = serializers.IntegerField()
    total_spaces = serializers.IntegerField()
    occupied_spaces = serializers.IntegerField()
    available_spaces = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    today_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)

class OwnerDashboardStatsSerializer(serializers.Serializer):
    total_spaces = serializers.IntegerField()
    occupied_spaces = serializers.IntegerField()
    available_spaces = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    today_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    approval_status = serializers.CharField()
    monthly_earnings = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

class ParkingInfoSerializer(serializers.ModelSerializer):
    """Serializer para información básica del parking en dashboard"""
    porcentaje_ocupacion = serializers.SerializerMethodField()
    
    class Meta:
        model = ParkingLot
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'total_plazas',
            'plazas_disponibles', 'aprobado', 'activo', 'porcentaje_ocupacion'
        ]
    
    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

class ApprovalStatisticsSerializer(serializers.Serializer):
    total_solicitudes = serializers.IntegerField()
    pendientes = serializers.IntegerField()
    aprobadas = serializers.IntegerField()
    rechazadas = serializers.IntegerField()
    tasa_aprobacion = serializers.FloatField()