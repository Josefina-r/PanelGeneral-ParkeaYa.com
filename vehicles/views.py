# vehicles/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
import logging
from django.conf import settings
from .models import Vehicle
from .serializers import VehicleSerializer, CreateVehicleSerializer

class UserVehicleListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateVehicleSerializer
        return VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(usuario=self.request.user, activo=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    # ✅ CORREGIDO: Este método debe estar AL MISMO NIVEL que get_serializer_context
    def create(self, request, *args, **kwargs):
        # Log datos recibidos para debug
        logging.info(f"Intentando registrar vehículo: {request.data}")
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
            return Response(
                e.detail,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logging.exception("Error creating vehicle")
            if getattr(settings, 'DEBUG', False):
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(
                {'error': 'Error interno del servidor al crear el vehículo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserVehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Vehicle.objects.filter(usuario=self.request.user)

    def perform_destroy(self, instance):
        # Soft delete
        instance.activo = False
        instance.save()

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(
                {'message': 'Vehículo eliminado exitosamente'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': 'Error al eliminar el vehículo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except ValidationError as e:
            return Response(
                e.detail,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': 'Error interno del servidor al actualizar el vehículo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Vista adicional para obtener vehículo por ID específico
class UserVehicleByIdView(generics.RetrieveAPIView):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        vehicle_id = self.kwargs.get('vehicle_id')
        return get_object_or_404(
            Vehicle, 
            id=vehicle_id, 
            usuario=self.request.user, 
            activo=True
        )

# Vista para listar todos los vehículos del usuario (incluyendo inactivos si es necesario)
class AllUserVehiclesView(generics.ListAPIView):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Opcional: incluir parámetro para mostrar inactivos
        show_inactive = self.request.query_params.get('show_inactive', 'false').lower() == 'true'
        if show_inactive:
            return Vehicle.objects.filter(usuario=self.request.user)
        return Vehicle.objects.filter(usuario=self.request.user, activo=True)