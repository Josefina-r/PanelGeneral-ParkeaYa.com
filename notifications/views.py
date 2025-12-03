# notifications/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Notification
from .serializers import NotificationSerializer, CreateNotificationSerializer, MarkAsReadSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Filtros por query params
        queryset = Notification.objects.filter(
            Q(user=user) | 
            Q(role__in=self._get_user_roles(user)) |
            Q(role='all')
        ).distinct()
        
        # Filtrar por tipo si se especifica
        notification_type = self.request.query_params.get('type', None)
        if notification_type:
            queryset = queryset.filter(type=notification_type)
        
        # Filtrar por no leídas si se especifica
        unread_only = self.request.query_params.get('unread', None)
        if unread_only and unread_only.lower() == 'true':
            queryset = queryset.filter(read=False)
        
        return queryset.order_by('-created_at')
    
    def _get_user_roles(self, user):
        roles = []
        if user.is_staff or user.is_superuser:
            roles.append('admin')
        if hasattr(user, 'owner_profile') and user.owner_profile.is_owner:
            roles.append('owner')
        return roles
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        queryset = self.get_queryset().filter(read=False)
        updated = queryset.update(read=True)
        return Response({'marked_read': updated})
    
    @action(detail=False, methods=['post'])
    def mark_multiple_read(self, request):
        serializer = MarkAsReadSerializer(data=request.data)
        if serializer.is_valid():
            notification_ids = serializer.validated_data.get('notification_ids', [])
            if notification_ids:
                queryset = self.get_queryset().filter(id__in=notification_ids, read=False)
                updated = queryset.update(read=True)
                return Response({'marked_read': updated})
            return Response({'error': 'No notification IDs provided'}, status=400)
        return Response(serializer.errors, status=400)
    
    # Endpoint para crear notificaciones (para uso interno)
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def create_notification(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Solo administradores pueden crear notificaciones'}, status=403)
        
        serializer = CreateNotificationSerializer(data=request.data)
        if serializer.is_valid():
            notification = serializer.save()
            
            # Si es una notificación por rol, asignar a usuarios específicos
            role = serializer.validated_data.get('role')
            if role != 'all':
                users = self._get_users_by_role(role)
                for user in users:
                    Notification.objects.create(
                        user=user,
                        **{k: v for k, v in serializer.validated_data.items() if k != 'role'}
                    )
            else:
                # Notificación global (sin usuario específico)
                notification.save()
            
            return Response(NotificationSerializer(notification).data, status=201)
        return Response(serializer.errors, status=400)
    
    def _get_users_by_role(self, role):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        if role == 'admin':
            return User.objects.filter(is_staff=True, is_active=True)
        elif role == 'owner':
            return User.objects.filter(owner_profile__is_owner=True, is_active=True)
        return User.objects.none()

# Vista para notificaciones del admin
class AdminNotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return Notification.objects.none()
        
        # Admins ven notificaciones de admin y globales
        return Notification.objects.filter(
            Q(role='admin') | Q(role='all') | Q(user=self.request.user)
        ).distinct().order_by('-created_at')

# Vista para notificaciones del owner
class OwnerNotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        # Verificar si el usuario es owner
        if not hasattr(self.request.user, 'owner_profile') or not self.request.user.owner_profile.is_owner:
            return Notification.objects.none()
        
        # Owners ven notificaciones de owner y globales
        return Notification.objects.filter(
            Q(role='owner') | Q(role='all') | Q(user=self.request.user)
        ).distinct().order_by('-created_at')