from rest_framework import permissions

class IsAdminGeneral(permissions.BasePermission):
    """Solo permite acceso a administradores generales"""
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

class IsOwnerOfParkingReservation(permissions.BasePermission):
    """Verifica que el usuario sea dueño del estacionamiento de la reserva"""
    def has_object_permission(self, request, view, obj):
        return obj.estacionamiento.dueno == request.user

class IsAdminOrOwnerOfReservation(permissions.BasePermission):
    """Permite acceso a admin, dueño del parking o usuario de la reserva"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin_general:
            return True
        if hasattr(obj.estacionamiento, 'dueno') and obj.estacionamiento.dueno == request.user:
            return True
        return obj.usuario == request.user

class CanManageReservations(permissions.BasePermission):
    """Permite gestionar reservas según el rol"""
    def has_permission(self, request, view):
        if view.action in ['create']:
            return request.user.is_authenticated and request.user.is_client
        return True