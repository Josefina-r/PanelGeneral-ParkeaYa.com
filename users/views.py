# users/views.py
from django.shortcuts import render
from rest_framework import viewsets, permissions, generics, status
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, CarSerializer, AdminUserSerializer, 
    OwnerRegistrationSerializer, ClientRegistrationSerializer,
    MyTokenObtainPairSerializer
)
from .models import Car
from .permissions import IsAdminGeneral, IsOwner, IsClient, IsOwnerOfObject
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes, action
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import datetime

from .models import SolicitudAccesoOwner
from .serializers import SolicitudAccesoOwnerSerializer, SolicitudRevisionSerializer
from django.core.mail import send_mail
from django.conf import settings
import secrets
import string
import logging
import traceback
import unicodedata

from django.db.models import Q  

User = get_user_model()
logger = logging.getLogger(__name__)

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

class RegisterClientView(generics.CreateAPIView):
    """Registro para clientes normales"""
    queryset = User.objects.all()
    serializer_class = ClientRegistrationSerializer
    permission_classes = [permissions.AllowAny]

class RegisterOwnerView(generics.CreateAPIView):
    """Registro para dueños de estacionamientos"""
    queryset = User.objects.all()
    serializer_class = OwnerRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class UserViewSet(viewsets.ModelViewSet):
    """Vista general para usuarios - Acceso limitado según rol"""
    queryset = User.objects.filter(eliminado=False)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

class AdminUserViewSet(UserViewSet):
    """Vista para administradores - Acceso total a usuarios"""
    permission_classes = [permissions.IsAuthenticated, IsAdminGeneral]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.all()

class OwnerUserViewSet(UserViewSet):
    """Vista para dueños de estacionamientos"""
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return User.objects.filter(Q(id=self.request.user.id) | Q(rol='client'))
    
    @action(detail=False, methods=['get', 'put'])
    def me(self, request):
        """Endpoint para obtener y actualizar el perfil del owner actual"""
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        elif request.method == 'PUT':
            serializer = self.get_serializer(request.user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ClientUserViewSet(UserViewSet):
    """Vista para clientes - Solo acceso a su propio perfil"""
    permission_classes = [permissions.IsAuthenticated, IsClient]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.rol == 'admin':
            return User.objects.filter(eliminado=False)
        elif user.rol == 'owner':
            return User.objects.filter(eliminado=False).filter(
                Q(id=user.id) | Q(reservations__estacionamiento__dueno=user)
            ).distinct()
        else:
            return User.objects.filter(id=user.id, eliminado=False)

    def get_serializer_class(self):
        if self.request.user.is_superuser or self.request.user.rol == 'admin':
            return AdminUserSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Endpoint para obtener datos del usuario actual"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        if not self.request.user.is_superuser and not self.request.user.rol == 'admin':
            allowed_fields = {
                'first_name', 'last_name', 'email', 'telefono',
                'tipo_documento', 'numero_documento', 'fecha_nacimiento',
                'direccion', 'codigo_postal', 'pais'
            }
            for field in serializer.validated_data.copy():
                if field not in allowed_fields:
                    serializer.validated_data.pop(field)
        serializer.save()

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """Permite a admins cambiar la contraseña de cualquier usuario"""
        user = self.get_object()
        
        # Solo admins pueden cambiar contraseñas de otros usuarios
        if not (request.user.is_superuser or request.user.rol == 'admin'):
            return Response(
                {'error': 'No tienes permiso para cambiar esta contraseña'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        if not new_password:
            return Response(
                {'error': 'Se requiere la nueva contraseña'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if confirm_password and new_password != confirm_password:
            return Response(
                {'error': 'Las contraseñas no coinciden'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Contraseña actualizada correctamente'})

    @action(detail=True, methods=['post'])
    def soft_delete(self, request, pk=None):
        """Eliminación suave de usuario"""
        user = self.get_object()
        if not request.user.is_superuser and not request.user.rol == 'admin':
            return Response(
                {'error': 'No tienes permiso para realizar esta acción'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user.eliminado = True
        user.activo = False
        user.fecha_eliminacion = timezone.now()
        user.save()
        
        return Response({'message': 'Usuario eliminado correctamente'})


class CarViewSet(viewsets.ModelViewSet):
    queryset = Car.objects.all().order_by('-created_at')
    serializer_class = CarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        if user.is_admin_general:
            return Car.objects.all()
        elif user.is_owner:
            return Car.objects.all()
        else:
            return Car.objects.filter(usuario=user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

# =============================================================================
# VISTAS ESPECÍFICAS PARA EL PANEL WEB
# =============================================================================

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def admin_panel_login(request):
    """
    Login específico para el panel administrativo web
    Solo permite acceso a administradores y dueños
    """
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    
    if user is not None and user.is_active and not user.eliminado:
        if not user.is_admin_general and not user.is_owner:
            return Response(
                {'error': 'Acceso solo para administradores y dueños'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'rol': user.rol,
                'rol_display': user.get_rol_display(),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_admin': user.is_admin_general,
                'is_owner': user.is_owner
            }
        })
    else:
        return Response(
            {'error': 'Credenciales inválidas o cuenta desactivada'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_user_profile(request):
    """Vista específica para actualizar el perfil del usuario"""
    user = request.user
    
    allowed_fields = {
        'first_name', 'last_name', 'email', 'telefono',
        'tipo_documento', 'numero_documento', 'fecha_nacimiento',
        'direccion', 'codigo_postal', 'pais'
    }
    
    data = {k: v for k, v in request.data.items() if k in allowed_fields}
    
    if 'fecha_nacimiento' in data and data['fecha_nacimiento']:
        try:
            fecha_str = data['fecha_nacimiento']
            if '/' in fecha_str:
                fecha_obj = datetime.strptime(fecha_str, '%d/%m/%Y').date()
                data['fecha_nacimiento'] = fecha_obj
            elif '-' in fecha_str:
                data['fecha_nacimiento'] = fecha_str
        except ValueError as e:
            return Response(
                {'error': f'Formato de fecha inválido: {str(e)}. Use dd/mm/yyyy'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    serializer = UserSerializer(user, data=data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_profile(request):
    """Obtener perfil del usuario actual - SOLO GET"""
    user = request.user
    return Response(user.obtener_perfil_completo())

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_panel_access(request):
    """Verificar si el usuario tiene acceso al panel administrativo"""
    user = request.user
    has_panel_access = user.is_admin_general or user.is_owner
    
    return Response({
        'has_panel_access': has_panel_access,
        'is_admin': user.is_admin_general,
        'is_owner': user.is_owner,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'rol': user.rol,
            'rol_display': user.get_rol_display()
        }
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminGeneral])
def admin_dashboard_stats(request):
    """Estadísticas para el dashboard del administrador general"""
    total_users = User.objects.filter(eliminado=False).count()
    total_owners = User.objects.filter(rol='owner', eliminado=False).count()
    total_clients = User.objects.filter(rol='client', eliminado=False).count()
    active_users = User.objects.filter(activo=True, eliminado=False).count()
    
    return Response({
        'total_users': total_users,
        'total_owners': total_owners,
        'total_clients': total_clients,
        'active_users': active_users,
        'users_by_role': {
            'admin': User.objects.filter(rol='admin', eliminado=False).count(),
            'owner': total_owners,
            'client': total_clients
        }
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsOwner])
def owner_dashboard_stats(request):
    """Estadísticas para el dashboard del dueño"""
    user = request.user
    
    return Response({
        'user_info': {
            'username': user.username,
            'email': user.email,
            'rol': user.rol
        },
        'parking_stats': {
            'total_spots': 0,
            'available_spots': 0,
            'reserved_spots': 0
        },
        'revenue_stats': {
            'today': 0,
            'this_week': 0,
            'this_month': 0
        }
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def client_dashboard_stats(request):
    """Estadísticas para el dashboard del cliente"""
    user = request.user
    
    return Response({
        'user_info': {
            'username': user.username,
            'email': user.email,
            'telefono': user.telefono
        },
        'stats': {
            'total_parkings': 0,  
            'active_reservations': 0,
            'monthly_earnings': 0
        }
    })

@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request, pk=None):
    """
    Cambio de contraseña más tolerante a distintos nombres de campo y a PUT con body no parseado.
    - Cambio propio: requiere old/current/password actual.
    - Cambio a otro usuario: solo admins (is_superuser / rol=='admin' / is_admin_general).
    Acepta: old_password, current_password, password  (actual)
            new_password, password, newPassword        (nueva)
            confirm_password, confirmPassword         (confirmación)
            user_id, target_id                         (objetivo)
    """
    requester = request.user

    # Helper para obtener datos de request con nombres alternativos
    def _get_from_request(keys):
        # revisar request.data y request.POST y query params
        for k in keys:
            v = request.data.get(k)
            if v is not None:
                return v
            v = request.POST.get(k)
            if v is not None:
                return v
            v = request.query_params.get(k)
            if v is not None:
                return v
        # intentar parsear body si data está vacío
        try:
            if not request.data and request.body:
                import json
                body_json = json.loads(request.body.decode('utf-8'))
                for k in keys:
                    if k in body_json:
                        return body_json.get(k)
        except Exception:
            pass
        return None

    # Normalizar campos
    target_id = pk or _get_from_request(['user_id', 'target_id', 'id'])
    old_password = _get_from_request(['old_password', 'current_password', 'password'])
    new_password = _get_from_request(['new_password', 'password', 'newPassword'])
    confirm_password = _get_from_request(['confirm_password', 'confirmPassword'])

    # Strip y normalización Unicode para evitar problemas de encoding / caracteres invisibles
    def _clean_pwd(p):
        if p is None:
            return None
        if isinstance(p, bytes):
            try:
                p = p.decode('utf-8')
            except Exception:
                try:
                    p = p.decode('latin-1')
                except Exception:
                    p = str(p)
        if isinstance(p, str):
            p = p.strip()
            # Normalizar unicode (NFKC) y eliminar BOM/zero-width spaces comunes
            p = unicodedata.normalize('NFKC', p)
            for ch in ['\ufeff', '\u200b', '\u200c', '\u200d', '\u2060']:
                p = p.replace(ch, '')
        return p

    old_password = _clean_pwd(old_password)
    new_password = _clean_pwd(new_password)
    confirm_password = _clean_pwd(confirm_password)

    logger.info(f"🔍 [CHANGE_PASSWORD] requester id={getattr(requester,'id',None)} target_id={target_id} request_data_keys={list(request.data.keys())}")
    logger.info(f"🔍 [CHANGE_PASSWORD] old_password repr: {repr(old_password)} new_password length: {len(new_password) if new_password else 0}")

    # Si objetivo es propio usuario (o no indicado): exige contraseña actual
    if target_id is None or str(target_id) == str(getattr(requester, 'id', None)):
        if not old_password:
            return Response(
                {'error': 'Se requiere la contraseña actual. Campos aceptados: old_password, current_password, password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not new_password:
            return Response(
                {'error': 'Se requiere la nueva contraseña. Campos aceptados: new_password, password, newPassword'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if confirm_password and new_password != confirm_password:
            return Response({'error': 'La nueva contraseña y la confirmación no coinciden.'}, status=status.HTTP_400_BAD_REQUEST)

        # Comprobar contraseña actual
        # Log extra para depuración en caso de fallo
        try:
            password_correct = requester.check_password(old_password)
        except Exception as e:
            logger.exception(f"❌ [CHANGE_PASSWORD] Excepción en check_password: {e}")
            return Response({'error': 'Error interno al verificar la contraseña.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info(f"🔍 [CHANGE_PASSWORD] check_password result: {password_correct}")
        # Información adicional del usuario (hash prefix y si tiene usable password)
        try:
            user_hash_prefix = getattr(requester, 'password', '')[:50]
            logger.info(f"🔍 [CHANGE_PASSWORD] user.password prefix: {user_hash_prefix}")
            logger.info(f"🔍 [CHANGE_PASSWORD] has_usable_password: {requester.has_usable_password()}")
        except Exception:
            logger.exception("🔍 [CHANGE_PASSWORD] Error al acceder a password del usuario")

        if not password_correct:
            logger.warning(f"❌ [CHANGE_PASSWORD] check_password False requester_id={getattr(requester,'id',None)}")
            # Responder con mensaje claro; logs contienen detalles de depuración
            return Response({'error': 'Contraseña actual incorrecta. Verifica el valor enviado y el usuario autenticado.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'error': 'La nueva contraseña debe tener al menos 6 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        requester.set_password(new_password)
        requester.save()
        return Response({'message': 'Contraseña actualizada correctamente'})

    # Cambio de otro usuario -> requiere permisos de admin
    is_admin = getattr(requester, 'is_superuser', False) or getattr(requester, 'rol', None) == 'admin' or getattr(requester, 'is_admin_general', False)
    if not is_admin:
        return Response({'error': 'No tienes permiso para cambiar la contraseña de otro usuario.'}, status=status.HTTP_403_FORBIDDEN)

    if not new_password:
        return Response({'error': 'Se requiere la nueva contraseña para el usuario objetivo.'}, status=status.HTTP_400_BAD_REQUEST)
    if confirm_password and new_password != confirm_password:
        return Response({'error': 'La nueva contraseña y la confirmación no coinciden.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response({'error': 'La nueva contraseña debe tener al menos 6 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.get(id=target_id)
    except Exception:
        return Response({'error': 'Usuario objetivo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    target_user.set_password(new_password)
    target_user.save()
    return Response({'message': f"Contraseña del usuario id={target_user.id} actualizada correctamente"})

# Vista de emergencia para resetear contraseña (temporal)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reset_own_password(request):
    """
    Emergencia: resetea la contraseña del propio usuario sin verificar old_password.
    Usar solo temporalmente y remover cuando ya no sea necesario.
    Body: { "new_password": "...", "confirm_password": "..." }
    """
    user = request.user
    new_password = request.data.get('new_password', '')
    confirm_password = request.data.get('confirm_password', '')

    if isinstance(new_password, str):
        new_password = new_password.strip()
    if isinstance(confirm_password, str):
        confirm_password = confirm_password.strip()

    logger.warning(f"⚠️ [RESET_PASSWORD_EMERGENCY] Solicitud de reset por usuario id={getattr(user,'id',None)} username={getattr(user,'username',None)}")

    if not new_password:
        logger.error("❌ [RESET_PASSWORD_EMERGENCY] Falta new_password")
        return Response({'error': 'Se requiere la nueva contraseña'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        logger.error("❌ [RESET_PASSWORD_EMERGENCY] Las contraseñas no coinciden")
        return Response({'error': 'Las contraseñas no coinciden'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 6:
        logger.error("❌ [RESET_PASSWORD_EMERGENCY] Nueva contraseña muy corta")
        return Response({'error': 'La contraseña debe tener al menos 6 caracteres'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    logger.warning(f"✅ [RESET_PASSWORD_EMERGENCY] Contraseña reseteada para usuario id={getattr(user,'id',None)}")
    return Response({'message': 'Contraseña reseteada exitosamente'})