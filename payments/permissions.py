# permissions.py - Necesitas crear este archivo
from rest_framework import permissions

class IsAdminOrOwnerOrReadOnly(permissions.BasePermission):
 
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
       
        if request.user.is_staff or getattr(request.user, 'rol', None) == 'admin':
            return True
        
        if hasattr(obj, 'reserva') and hasattr(obj.reserva, 'estacionamiento'):
            if obj.reserva.estacionamiento.owner == request.user:
                return True
        
        # Usuarios solo pueden ver sus propios pagos
        if hasattr(obj, 'usuario'):
            return obj.usuario == request.user
        
        return False

class IsAdminOrOwner(permissions.BasePermission):
   
    def has_permission(self, request, view):
        user = request.user
        return (user.is_authenticated and 
                (user.is_staff or 
                 getattr(user, 'rol', None) in ['admin', 'owner']))