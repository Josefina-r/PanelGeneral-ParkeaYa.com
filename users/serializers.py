# users/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Car
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate

User = get_user_model()

class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = ['id', 'placa', 'modelo', 'tipo', 'color', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    cars = CarSerializer(many=True, read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'rol', 'rol_display', 'telefono', 
            'activo', 'fecha_registro', 'cars', 'password',
            'date_joined', 'last_login', 'is_active', 'first_name', 'last_name'
        ]
        read_only_fields = ['fecha_registro', 'date_joined', 'last_login']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class AdminUserSerializer(UserSerializer):
    """Serializer para administradores (pueden ver todo)"""
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ['is_staff', 'is_superuser', 'eliminado']

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