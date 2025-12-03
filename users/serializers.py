# users/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Car
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
import re
from .models import SolicitudAccesoOwner

User = get_user_model()

# Mapeo tolerante para tipo_documento: acepta tanto el código interno
# ('dni','pasaporte','carnet_extranjeria') como las etiquetas visibles
# ('DNI','Pasaporte','Carnet de Extranjería'), en mayúsculas/minúsculas.
_TIPO_DOC_MAP = {}
for _code, _label in getattr(User, 'TIPO_DOCUMENTO_CHOICES', []):
    _TIPO_DOC_MAP[_code.lower()] = _code
    _TIPO_DOC_MAP[_label.lower()] = _code

class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = ['id', 'placa', 'modelo', 'tipo', 'color', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    cars = CarSerializer(many=True, read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    
    # NUEVO: Campos de solo lectura para las propiedades del modelo
    telefono_formateado = serializers.CharField(read_only=True)
    edad = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'rol', 'rol_display', 'telefono', 
            'telefono_formateado', 'activo', 'fecha_registro', 'cars', 'password',
            'date_joined', 'last_login', 'is_active', 'first_name', 'last_name',
            'tipo_documento', 'numero_documento', 'fecha_nacimiento', 'edad',
            'direccion', 'codigo_postal', 'pais'
        ]
        read_only_fields = [
            'fecha_registro', 'date_joined', 'last_login', 'rol', 
            'activo', 'is_active', 'edad', 'telefono_formateado'  #  username removido de readonly
        ]

    def validate_telefono(self, value):
        """Validación personalizada para teléfono peruano"""
        if value and value.strip():
            telefono_limpio = value.strip()
            # Remover prefijos internacionales
            if telefono_limpio.startswith('+51'):
                telefono_limpio = telefono_limpio[3:].strip()
            elif telefono_limpio.startswith('51'):
                telefono_limpio = telefono_limpio[2:].strip()
            
            # Validar que tenga 9 dígitos y empiece con 9
            if not re.match(r'^9\d{8}$', telefono_limpio):
                raise serializers.ValidationError(
                    'El número de celular debe tener 9 dígitos y comenzar con 9 (Ej: 987654321)'
                )
            
            return telefono_limpio
        return value

    def validate(self, data):
        """Validación cruzada entre tipo_documento y numero_documento"""
        # Normalizar entradas tolerantes para tipo_documento (acepta 'DNI'/'dni'/'Pasaporte', etc.)
        tipo_documento = data.get('tipo_documento')
        if tipo_documento:
            try:
                mapped = _TIPO_DOC_MAP.get(str(tipo_documento).strip().lower())
                if mapped:
                    data['tipo_documento'] = mapped
                    tipo_documento = mapped
            except Exception:
                # si algo falla, dejamos el valor original para que la validación
                # normal reporte errores apropiadamente
                tipo_documento = data.get('tipo_documento')
        numero_documento = data.get('numero_documento')

        if tipo_documento and numero_documento:
            numero_limpio = numero_documento.strip().upper()
            
            if tipo_documento == 'dni':
                if not re.match(r'^\d{8}$', numero_limpio):
                    raise serializers.ValidationError({
                        'numero_documento': 'El DNI debe tener exactamente 8 dígitos numéricos'
                    })
            
            elif tipo_documento == 'pasaporte':
                if not re.match(r'^[A-Z0-9]{6,12}$', numero_limpio):
                    raise serializers.ValidationError({
                        'numero_documento': 'El pasaporte debe tener entre 6 y 12 caracteres alfanuméricos'
                    })
            
            elif tipo_documento == 'carnet_extranjeria':
                if not re.match(r'^[A-Z0-9]{9,12}$', numero_limpio):
                    raise serializers.ValidationError({
                        'numero_documento': 'El carnet de extranjería debe tener entre 9 y 12 caracteres alfanuméricos'
                    })
            
            data['numero_documento'] = numero_limpio

        return data

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        
        #  PERMITIR ACTUALIZACIÓN DE TODOS LOS CAMPOS INCLUIDOS LOS NUEVOS
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password:
            instance.set_password(password)
            
        instance.save()
        return instance

class AdminUserSerializer(UserSerializer):
    """Serializer para administradores (pueden ver todo)"""
    class Meta(UserSerializer.Meta):
        # Administradores pueden modificar estados y permisos
        fields = UserSerializer.Meta.fields + ['is_staff', 'is_superuser', 'eliminado']
        # Permitir que el admin actualice `is_active`, `activo`, `rol` y permisos.
        read_only_fields = [
            'fecha_registro', 'date_joined', 'last_login', 'edad', 'telefono_formateado'
        ]

class OwnerRegistrationSerializer(serializers.ModelSerializer):
    """Serializer específico para registro de dueños"""
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'telefono', 'first_name', 'last_name']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Las contraseñas no coinciden")
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data['rol'] = 'owner'
        user = User.objects.create_user(**validated_data)
        return user

class ClientRegistrationSerializer(serializers.ModelSerializer):
    """Serializer específico para registro de clientes"""
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'telefono']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Las contraseñas no coinciden")
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data['rol'] = 'client'
        user = User.objects.create_user(**validated_data)
        return user

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_email = attrs.get("username")
        password = attrs.get("password")

        # Permitir login con email o username
        user = authenticate(
            request=self.context.get("request"),
            username=username_or_email,
            password=password
        )

        if user is None:
            try:
                user_obj = User.objects.get(email=username_or_email)
                user = authenticate(
                    request=self.context.get("request"),
                    username=user_obj.username,
                    password=password
                )
            except User.DoesNotExist:
                pass

        if user is None:
            raise serializers.ValidationError("Credenciales inválidas")

        if not user.is_active or user.eliminado:
            raise serializers.ValidationError("Cuenta desactivada o eliminada")

        data = super().validate({"username": user.username, "password": password})
        
        # Agregar información del usuario a la respuesta
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'rol': user.rol,
            'rol_display': user.get_rol_display(),
            'first_name': user.first_name,
            'last_name': user.last_name
        }
        return data
    
class SolicitudAccesoOwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitudAccesoOwner
        fields = [
            'id', 'nombre', 'email', 'telefono', 'empresa', 'mensaje',
            'estado', 'fecha_solicitud', 'fecha_revision', 'comentarios_rechazo'
        ]
        read_only_fields = ['id', 'fecha_solicitud', 'fecha_revision', 'estado', 'comentarios_rechazo']

class SolicitudRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitudAccesoOwner
        fields = ['estado', 'comentarios_rechazo']