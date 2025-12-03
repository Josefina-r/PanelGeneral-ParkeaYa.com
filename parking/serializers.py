# parking/serializers.py
from rest_framework import serializers
from django.core.validators import RegexValidator
from .models import ParkingLot, ParkingImage, ParkingReview, ParkingApprovalRequest
from .models import ParkingApprovalImage
from django.contrib.auth import get_user_model

User = get_user_model()

# ----------------------------
# Serializers Base
# ----------------------------
class ParkingImageSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ParkingImage
        fields = ['id', 'imagen', 'imagen_url', 'descripcion', 'creado_en']

    def get_imagen_url(self, obj):
        if obj.imagen:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.imagen.url)
            return obj.imagen.url
        return None


class ParkingApprovalImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingApprovalImage
        fields = ['id', 'imagen', 'descripcion', 'creado_en']

class ParkingReviewSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    # ✅ permitir enviar el id del estacionamiento al crear la reseña
    estacionamiento = serializers.PrimaryKeyRelatedField(queryset=ParkingLot.objects.all(), required=True)

    class Meta:
        model = ParkingReview
        fields = [
            'id', 'usuario', 'usuario_nombre', 'estacionamiento', 'calificacion', 'comentario', 'fecha',
            'activo', 'reportado', 'motivo_reporte'
        ]
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
        read_only_fields = ['dueno']

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas == 0:
            return 0
        return round(((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100, 2)


class ParkingLotSerializer(ParkingLotBaseSerializer):
    imagen_principal = serializers.SerializerMethodField()
    imagenes = serializers.SerializerMethodField(read_only=True)
    
    class Meta(ParkingLotBaseSerializer.Meta):
        model = ParkingLot
        fields = [
            'id', 'dueno', 'dueno_nombre', 'nombre', 'direccion',
            'tarifa_hora', 'total_plazas', 'plazas_disponibles',
            'nivel_seguridad', 'descripcion', 'coordenadas',
            'horario_apertura', 'horario_cierre', 'telefono',
            'rating_promedio', 'imagen_principal','total_reseñas', 'esta_abierto',
            'porcentaje_ocupacion', 'aprobado', 'activo', 'imagenes'
        ]
        read_only_fields = ['rating_promedio', 'total_reseñas', 'imagenes', 'dueno']

    def get_imagen_principal(self, obj):
        """Obtener la primera imagen como imagen principal"""
        imagen_principal = obj.imagenes.first()
        if imagen_principal and imagen_principal.imagen:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(imagen_principal.imagen.url)
            return imagen_principal.imagen.url
        return None

    def get_imagenes(self, obj):
        """Obtener todas las imágenes con URLs absolutas"""
        imagenes = obj.imagenes.all()
        if not imagenes.exists():
            return []
        
        request = self.context.get('request')
        images_data = []
        
        for img in imagenes:
            imagen_url = img.imagen.url
            if request:
                imagen_url = request.build_absolute_uri(imagen_url)
            
            images_data.append({
                'id': img.id,
                'imagen_url': imagen_url,
                'descripcion': img.descripcion,
                'creado_en': img.creado_en
            })
        
        return images_data

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

class ParkingLotClientSerializer(ParkingLotBaseSerializer):
    """Serializer para clientes - solo información pública"""
    imagenes = ParkingImageSerializer(many=True, read_only=True)
    imagen_principal = serializers.SerializerMethodField()
    
    class Meta(ParkingLotBaseSerializer.Meta):
        fields = [field for field in ParkingLotBaseSerializer.Meta.fields 
                 if field not in ['dueno', 'dueno_nombre']] + ['imagenes', 'imagen_principal']

    def get_imagen_principal(self, obj):
        """Obtener la imagen principal del modelo"""
        # PRIMERO: Usar el campo imagen_principal del modelo si existe
        if getattr(obj, 'imagen_principal', None) and hasattr(obj.imagen_principal, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.imagen_principal.url)
            return obj.imagen_principal.url
        
        # SEGUNDO: Fallback a la primera imagen de la galería
        imagen_principal = obj.imagenes.first()
        if imagen_principal and getattr(imagen_principal, 'imagen', None):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(imagen_principal.imagen.url)
            return imagen_principal.imagen.url
        
        return None

class ParkingLotOwnerSerializer(ParkingLotBaseSerializer):
    """Serializer para dueños - información completa de SU estacionamiento"""
    imagenes = serializers.SerializerMethodField(read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)

    class Meta(ParkingLotBaseSerializer.Meta):
        fields = ParkingLotBaseSerializer.Meta.fields + ['imagenes', 'reseñas']

    def get_imagenes(self, obj):
        """Obtener todas las imágenes con URLs absolutas"""
        imagenes = obj.imagenes.all()
        if not imagenes.exists():
            return []
        
        request = self.context.get('request')
        images_data = []
        
        for img in imagenes:
            imagen_url = img.imagen.url
            if request:
                imagen_url = request.build_absolute_uri(imagen_url)
            
            images_data.append({
                'id': img.id,
                'imagen_url': imagen_url,
                'descripcion': img.descripcion,
                'creado_en': img.creado_en
            })
        
        return images_data

class ParkingLotAdminSerializer(ParkingLotBaseSerializer):
    """Serializer para administradores - información completa + gestión"""
    imagenes = serializers.SerializerMethodField(read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)
    dueno_email = serializers.CharField(source='dueno.email', read_only=True)
    dueno_telefono = serializers.CharField(source='dueno.telefono', read_only=True)

    class Meta(ParkingLotBaseSerializer.Meta):
        fields = ParkingLotBaseSerializer.Meta.fields + [
            'imagenes', 'reseñas', 'dueno_email', 'dueno_telefono'
        ]

    def get_imagenes(self, obj):
        """Obtener todas las imágenes con URLs absolutas"""
        imagenes = obj.imagenes.all()
        if not imagenes.exists():
            return []
        
        request = self.context.get('request')
        images_data = []
        
        for img in imagenes:
            imagen_url = img.imagen.url
            if request:
                imagen_url = request.build_absolute_uri(imagen_url)
            
            images_data.append({
                'id': img.id,
                'imagen_url': imagen_url,
                'descripcion': img.descripcion,
                'creado_en': img.creado_en
            })
        
        return images_data

class ParkingLotListSerializer(serializers.ModelSerializer):
    """Serializer para listas - optimizado para performance - INCLUYE IMÁGENES"""
    esta_abierto = serializers.BooleanField(read_only=True)
    imagen_principal = serializers.SerializerMethodField()
    porcentaje_ocupacion = serializers.SerializerMethodField()
    imagenes = serializers.SerializerMethodField()

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'plazas_disponibles',
            'nivel_seguridad', 'coordenadas', 'esta_abierto',
            'rating_promedio', 'imagen_principal', 'porcentaje_ocupacion',
            'aprobado', 'activo', 'imagenes'
        ]

    def get_imagen_principal(self, obj):
        """Obtener la imagen principal del modelo"""
        # PRIMERO: Usar el campo imagen_principal del modelo
        if getattr(obj, 'imagen_principal', None) and hasattr(obj.imagen_principal, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.imagen_principal.url)
            return obj.imagen_principal.url
        
        # SEGUNDO: Fallback a la primera imagen de la galería
        imagen_principal = obj.imagenes.first()
        if imagen_principal and getattr(imagen_principal, 'imagen', None):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(imagen_principal.imagen.url)
            return imagen_principal.imagen.url
        
        return None

    def get_imagenes(self, obj):
        """Obtener todas las imágenes del parking"""
        imagenes = obj.imagenes.all()
        if not imagenes.exists():
            return []
        
        request = self.context.get('request')
        images_data = []
        
        for img in imagenes:
            # Usar img.imagen.url en lugar de img.imagen.name
            if getattr(img, 'imagen', None) and hasattr(img.imagen, 'url'):
                imagen_url = img.imagen.url
                if request:
                    imagen_url = request.build_absolute_uri(imagen_url)
                
                images_data.append({
                    'id': img.id,
                    'imagen': img.imagen.name if img.imagen else None,
                    'imagen_url': imagen_url,
                    'descripcion': img.descripcion,
                    'creado_en': img.creado_en.strftime('%Y-%m-%d %H:%M:%S') if img.creado_en else None
                })
        
        return images_data

    def get_porcentaje_ocupacion(self, obj):
        """Calcular porcentaje de ocupación"""
        if obj.total_plazas > 0:
            return round(((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100, 2)
        return 0


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
            'estacionamiento_creado_id', 'dias_pendiente', 'imagenes_solicitud'
        ]
        read_only_fields = ['solicitado_por', 'fecha_solicitud', 'fecha_revision', 'estacionamiento_creado']

    imagenes_solicitud = serializers.SerializerMethodField()

    def get_imagenes_solicitud(self, obj):
        images = obj.imagenes_solicitud.all()
        return ParkingApprovalImageSerializer(images, many=True).data

class ParkingApprovalActionSerializer(serializers.Serializer):
    motivo = serializers.CharField(required=False, allow_blank=True)

class ParkingApprovalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'nombre', 'direccion', 'coordenadas', 'telefono', 'descripcion',
            'horario_apertura', 'horario_cierre', 'nivel_seguridad', 'tarifa_hora',
            'total_plazas', 'plazas_disponibles', 'servicios', 'panel_local_id',
            'notas_aprobacion', 'imagenes'
        ]

    # Permitir subir múltiples imágenes en la creación (write-only)
    imagenes = serializers.ListField(
        child=serializers.ImageField(max_length=None, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )

    def create(self, validated_data):
        # Extraer imágenes antes de crear la instancia para que no se pasen
        # como kwargs al modelo (causaría TypeError)
        images = validated_data.pop('imagenes', []) if 'imagenes' in validated_data else []
        solicitud = super().create(validated_data)

        # Crear registros ParkingApprovalImage para cada archivo
        from .models import ParkingApprovalImage
        for img in images:
            try:
                ParkingApprovalImage.objects.create(solicitud=solicitud, imagen=img)
            except Exception:
                # No queremos que la creación de una imagen falle toda la solicitud
                continue

        return solicitud

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

# Agrega esto a tu parking/serializers.py

class ParkingImageUploadSerializer(serializers.Serializer):
    """Serializer específico para subir imágenes al parking"""
    imagenes = serializers.ListField(
        child=serializers.ImageField(
            max_length=100000,
            allow_empty_file=False,
            use_url=False
        ),
        write_only=True,
        required=True
    )

    def create(self, validated_data):
        # Este método no se usa directamente, las imágenes se crean en la view
        return validated_data