from rest_framework import permissions

class IsAdminGeneral(permissions.BasePermission):
    """Solo permite acceso a administradores generales"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin_general

class IsOwner(permissions.BasePermission):
    """Solo permite acceso a dueños de estacionamientos"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_owner

class IsAdminOrOwner(permissions.BasePermission):
    """Permite acceso a administradores y dueños"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_admin_general or request.user.is_owner
        )

class IsOwnerOfParking(permissions.BasePermission):
    """Verifica que el usuario sea dueño del estacionamiento específico"""
    def has_object_permission(self, request, view, obj):
        return obj.dueno == request.user

class IsAdminOrOwnerOfParking(permissions.BasePermission):
    """Permite acceso a admin o dueño del estacionamiento"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin_general:
            return True
        return obj.dueno == request.user

class CanManageParkingApprovals(permissions.BasePermission):
    """Solo admin puede gestionar aprobaciones"""
    def has_permission(self, request, view):
        if view.action in ['pendientes', 'aprobar', 'rechazar', 'estadisticas']:
            return request.user.is_authenticated and request.user.is_admin_general
        return True