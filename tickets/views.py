# tickets/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction, DatabaseError
import logging

from .models import Ticket, TicketHistory
from .serializers import (
    TicketSerializer, ValidateTicketSerializer, 
    TicketValidationResponseSerializer
)
from .tasks import enviar_ticket_usuario, notificar_validacion_propietario

class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """
        Wrapper seguro para evitar 500 si la tabla/columna no existe (p.e. migraciones pendientes).
        Retorna queryset real o queryset vacío si hay error de DB.
        """
        user = self.request.user
        try:
            if user.is_staff or getattr(user, 'rol', None) == 'admin':
                return Ticket.objects.all().select_related('reserva', 'usuario')
            
            if getattr(user, 'rol', None) == 'owner':
                return Ticket.objects.filter(
                    reserva__estacionamiento__dueno=user
                ).select_related('reserva', 'usuario')
            
            return Ticket.objects.filter(usuario=user).select_related('reserva', 'usuario')
        except DatabaseError as e:
            # Loguear para diagnóstico, devolver queryset vacío para evitar 500
            logging.getLogger(__name__).warning("Error DB en TicketViewSet.get_queryset: %s", str(e))
            # Evitar acceder a Ticket si la tabla/columna no existe
            return Ticket.objects.none()
    
    def get_serializer_class(self):
        return TicketSerializer

    def perform_create(self, serializer):
        """Sobrescribir para agregar lógica personalizada"""
        ticket = serializer.save()
        
        # Enviar ticket por email
        enviar_ticket_usuario.delay(ticket.id)

    @action(detail=True, methods=['post'])
    def validate_ticket(self, request, pk=None):
        """Validar ticket (check-in)"""
        ticket = self.get_object()
        user = request.user
        
        # Verificar permisos (solo dueños o admin pueden validar)
        if not (user.is_staff or 
                getattr(user, 'rol', None) in ['admin', 'owner'] or
                ticket.reserva.estacionamiento.dueno == user):
            return Response(
                {'detail': 'No tiene permisos para validar tickets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar ticket
        success, mensaje = ticket.validar_ticket(user)
        
        if success:
            # Notificar al propietario y usuario
            notificar_validacion_propietario.delay(ticket.id)
            
            return Response(
                TicketValidationResponseSerializer({
                    'valido': True,
                    'mensaje': mensaje,
                    'ticket': ticket,
                    'reserva': ticket.reserva
                }).data,
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                TicketValidationResponseSerializer({
                    'valido': False,
                    'mensaje': mensaje
                }).data,
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar ticket"""
        ticket = self.get_object()
        user = request.user
        
        # Verificar permisos
        if ticket.reserva.usuario != user and not user.is_staff:
            return Response(
                {'detail': 'No tiene permisos para cancelar este ticket.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        motivo = request.data.get('motivo', 'Cancelado por el usuario')
        ticket.cancelar_ticket(motivo)
        
        return Response(
            {'detail': 'Ticket cancelado exitosamente.'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def validos(self, request):
        """Obtener tickets válidos del usuario"""
        tickets = self.get_queryset().filter(
            estado='valido',
            fecha_validez_hasta__gt=timezone.now()
        )
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_parking(self, request, parking_id=None):
        """Obtener tickets por estacionamiento (para dueños)"""
        if not request.user.is_staff and getattr(request.user, 'rol', None) != 'owner':
            return Response(
                {'detail': 'No autorizado.'},
                status=status.HTTP_403_FORBIDDEN
            )

        tickets = self.get_queryset().filter(
            reserva__estacionamiento_id=parking_id
        )
        
        # Filtros
        estado = request.GET.get('estado')
        fecha = request.GET.get('fecha')
        
        if estado:
            tickets = tickets.filter(estado=estado)
        if fecha:
            tickets = tickets.filter(fecha_emision__date=fecha)
            
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='create-for-reservation')
    def create_for_reservation(self, request):
        reserva_id = request.data.get('reserva')
        usuario_id = request.data.get('usuario')
        
        if not reserva_id:
            return Response({'detail': 'Se requiere ID de reserva'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from reservations.models import Reservation
            from users.models import User
            
            reserva = Reservation.objects.get(id=reserva_id)
            
            if usuario_id:
                usuario = User.objects.get(id=usuario_id)
            else:
                usuario = reserva.usuario
            
            user = request.user
            if not (user.is_staff or (getattr(user, 'rol', None) in ['admin', 'owner'] and hasattr(reserva, 'estacionamiento') and reserva.estacionamiento.dueno == user)):
                return Response({'detail': 'No tiene permisos para crear tickets para esta reserva'}, status=status.HTTP_403_FORBIDDEN)
            
            ticket_data = {
                'reserva': reserva,
                'usuario': usuario,
                'tipo': request.data.get('tipo', 'pago_validado'),
                'estado': request.data.get('estado', 'valido'),
                'datos_adicionales': request.data.get('datos_adicionales', {}),
                'notas': request.data.get('notas', f'Ticket creado automáticamente por {user}')
            }
            
            ticket = Ticket.objects.create(**ticket_data)
            ticket.generar_qr_data()
            
            serializer = self.get_serializer(ticket)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Reservation.DoesNotExist:
            return Response({'detail': 'Reserva no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({'detail': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'], url_path='by-reservation/(?P<reservation_id>[^/.]+)')
    def by_reservation(self, request, reservation_id=None):
        tickets = self.get_queryset().filter(reserva_id=reservation_id)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        ticket = self.get_object()
        
        if ticket.estado != 'valido':
            return Response({'detail': 'Ticket no está en estado válido'}, status=status.HTTP_400_BAD_REQUEST)
        
        ticket.estado = 'usado'
        ticket.fecha_uso = timezone.now()
        ticket.save()
        
        serializer = self.get_serializer(ticket)
        return Response({'detail': 'Ticket validado exitosamente', 'ticket': serializer.data})


class TicketValidationAPIView(APIView):
    """API pública para validación de tickets via QR"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Validar ticket usando código o QR data"""
        serializer = ValidateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        codigo_ticket = serializer.validated_data.get('codigo_ticket')
        qr_data = serializer.validated_data.get('qr_data')
        
        # Buscar ticket
        try:
            if codigo_ticket:
                ticket = Ticket.objects.get(codigo_ticket=codigo_ticket)
            else:
                # Parsear QR data
                import json
                qr_json = json.loads(qr_data)
                ticket_id = qr_json.get('ticket_id')
                ticket = Ticket.objects.get(id=ticket_id)
                
        except Ticket.DoesNotExist:
            return Response(
                {'valido': False, 'mensaje': 'Ticket no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except (json.JSONDecodeError, KeyError):
            return Response(
                {'valido': False, 'mensaje': 'Datos QR inválidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que el usuario tenga permisos para validar este ticket
        user = request.user
        if not (user.is_staff or 
                getattr(user, 'rol', None) in ['admin', 'owner'] or
                ticket.reserva.estacionamiento.dueno == user):
            return Response(
                {'valido': False, 'mensaje': 'No autorizado para validar este ticket.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar ticket
        success, mensaje = ticket.validar_ticket(user)
        
        response_data = {
            'valido': success,
            'mensaje': mensaje,
            'ticket': TicketSerializer(ticket).data if success else None
        }
        
        status_code = status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST
        return Response(response_data, status=status_code)