from rest_framework import permissions

class IsAdminGeneral(permissions.BasePermission):
  
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin_general

class IsOwner(permissions.BasePermission):
    """Solo permite acceso a dueños de estacionamientos"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_owner

class IsClient(permissions.BasePermission):
    """Solo permite acceso a clientes normales"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_client

class IsAdminOrOwner(permissions.BasePermission):
    """Permite acceso a administradores y dueños"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_admin_general or request.user.is_owner
        )

class IsAdminOrReadOnly(permissions.BasePermission):
    """Permite acceso completo a admin, solo lectura a otros"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.is_admin_general

class IsOwnerOfObject(permissions.BasePermission):
    """Verifica que el usuario sea dueño del objeto"""
    def has_object_permission(self, request, view, obj):
        # Para objetos que tienen relación directa con usuario
        if hasattr(obj, 'usuario'):
            return obj.usuario == request.user
        # Para el usuario mismo
        elif isinstance(obj, User):
            return obj == request.user
        return False