# parking/views.py
from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Sum, F, Q
from django.db.models.functions import TruncDate
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.contrib.auth import get_user_model
from datetime import timedelta, datetime
import logging

from .permissions import (
    IsAdminGeneral, IsOwner, IsAdminOrOwner, 
    IsOwnerOfParking, IsAdminOrOwnerOfParking, CanManageParkingApprovals
)
from .models import ParkingLot, ParkingReview, ParkingApprovalRequest, ParkingImage
from .serializers import (
    ParkingLotClientSerializer, ParkingLotOwnerSerializer, ParkingLotAdminSerializer,
    ParkingLotListSerializer, ParkingReviewSerializer,
    ParkingApprovalRequestSerializer, ParkingApprovalActionSerializer,
    ParkingApprovalCreateSerializer, ParkingApprovalDashboardSerializer,
    AdminDashboardStatsSerializer, OwnerDashboardStatsSerializer,
    ParkingInfoSerializer, ApprovalStatisticsSerializer
)
from reservations.models import Reservation
from payments.models import Payment

User = get_user_model()
logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_data(request):
    """Vista general del dashboard - Redirige según el rol"""
    user = request.user
    
    if user.rol == 'admin':
        return admin_dashboard_data(request)
    elif user.rol == 'owner':
        return owner_dashboard_data(request)
    else:
        return Response({
            'error': 'Rol no autorizado para ver el dashboard'
        }, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET'])
@permission_classes([IsAdminGeneral])
def admin_dashboard_data(request):
    """Dashboard data para administradores"""
    try:
        total_parkings = ParkingLot.objects.count()
        total_users = User.objects.count()
        total_reservations = Reservation.objects.count()
        
        # Estadísticas de aprobación
        pending_approvals = ParkingApprovalRequest.objects.filter(status='PENDING').count()
        
        # Ingresos totales
        total_income = Payment.objects.aggregate(total=Sum('monto'))['total'] or 0
        
        return Response({
            'stats': {
                'total_parkings': total_parkings,
                'total_users': total_users,
                'total_reservations': total_reservations,
                'pending_approvals': pending_approvals,
                'total_income': float(total_income)
            }
        })
    except Exception as e:
        logger.error(f"Error en admin_dashboard_data: {str(e)}")
        return Response({
            'error': 'Error al obtener datos del dashboard'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsOwner])
def owner_dashboard_data(request):
    """Dashboard data para dueños de estacionamientos"""
    try:
        user_parkings = ParkingLot.objects.filter(dueno=request.user)
        total_parkings = user_parkings.count()
        
        # Reservaciones en los estacionamientos del dueño
        total_reservations = Reservation.objects.filter(estacionamiento__in=user_parkings).count()
        
        # Ingresos del dueño
        total_income = Payment.objects.filter(
            reserva__estacionamiento__in=user_parkings
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        return Response({
            'stats': {
                'total_parkings': total_parkings,
                'total_reservations': total_reservations,
                'total_income': float(total_income)
            }
        })
    except Exception as e:
        logger.error(f"Error en owner_dashboard_data: {str(e)}")
        return Response({
            'error': 'Error al obtener datos del dashboard'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Estadísticas generales del dashboard"""
    try:
        return Response({
            'stats': {
                'total_parkings': ParkingLot.objects.count(),
                'total_reservations': Reservation.objects.count()
            }
        })
    except Exception as e:
        logger.error(f"Error en dashboard_stats: {str(e)}")
        return Response({
            'error': 'Error al obtener estadísticas'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# NUEVOS ENDPOINTS PARA ADMIN PARKING MANAGEMENT
@api_view(['GET'])
@permission_classes([IsAdminGeneral])
def admin_pending_parkings(request):
    """Obtener parkings pendientes de aprobación"""
    try:
        # Parkings que NO están aprobados
        pending_parkings = ParkingLot.objects.filter(aprobado=False)
        
        pending_data = []
        for parking in pending_parkings:
            pending_data.append({
                'id': parking.id,
                'nombre': parking.nombre,
                'direccion': parking.direccion,
                'telefono': parking.telefono,
                'descripcion': parking.descripcion,
                'tarifa_hora': float(parking.tarifa_hora),
                'total_plazas': parking.total_plazas,
                'plazas_disponibles': parking.plazas_disponibles,
                'horario_apertura': parking.horario_apertura,
                'horario_cierre': parking.horario_cierre,
                'nivel_seguridad': parking.nivel_seguridad,
                'propietario': {
                    'id': parking.dueno.id,
                    'username': parking.dueno.username,
                    'email': parking.dueno.email,
                    'first_name': parking.dueno.first_name,
                    'last_name': parking.dueno.last_name,
                },
                'status': 'pending',
                'is_approval_request': True,
                'aprobado': parking.aprobado,
                'activo': parking.activo
            })
        
        return Response(pending_data)
    except Exception as e:
        logger.error(f"Error en admin_pending_parkings: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminGeneral])
def admin_approved_parkings(request):
    """Obtener parkings aprobados"""
    try:
        approved_parkings = ParkingLot.objects.filter(aprobado=True)
        
        approved_data = []
        for parking in approved_parkings:
            approved_data.append({
                'id': parking.id,
                'nombre': parking.nombre,
                'direccion': parking.direccion,
                'tarifa_hora': float(parking.tarifa_hora),
                'total_plazas': parking.total_plazas,
                'plazas_disponibles': parking.plazas_disponibles,
                'propietario': {
                    'username': parking.dueno.username,
                    'email': parking.dueno.email,
                },
                'status': 'active' if parking.activo else 'suspended',
                'is_approval_request': False,
                'aprobado': parking.aprobado,
                'activo': parking.activo
            })
        
        return Response(approved_data)
    except Exception as e:
        logger.error(f"Error en admin_approved_parkings: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ParkingLotViewSet(viewsets.ModelViewSet):
    """Vista base para estacionamientos - Se especializa por rol"""
    queryset = ParkingLot.objects.all().select_related('dueno').prefetch_related('imagenes', 'reseñas')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'direccion', 'nivel_seguridad']
    ordering_fields = ['tarifa_hora', 'rating_promedio', 'fecha_creacion']
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        """Selecciona serializer según el rol del usuario"""
        user = self.request.user
        
        if not user.is_authenticated:
            return ParkingLotClientSerializer
            
        if user.is_admin_general:
            return ParkingLotAdminSerializer
        elif user.is_owner:
            return ParkingLotOwnerSerializer
        else:
            return ParkingLotClientSerializer

    def get_queryset(self):
        """Filtra los estacionamientos según el rol - CORREGIDO"""
        user = self.request.user
        qs = super().get_queryset()
        
        # Filtros comunes
        seguridad = self.request.query_params.getlist('nivel_seguridad')  
        if seguridad:
            qs = qs.filter(nivel_seguridad__in=seguridad)
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        if self.request.query_params.get('aprobado') == 'true':
            qs = qs.filter(aprobado=True)
        if self.request.query_params.get('activo') == 'true':
            qs = qs.filter(activo=True)

        # Filtros por rol
        if user.is_authenticated:
            if user.is_admin_general:
                # Admin ve todos
                return qs
            elif user.is_owner:
                # Owner solo ve sus estacionamientos
                return qs.filter(dueno=user)
            else:
                # Client solo ve estacionamientos aprobados y activos
                return qs.filter(aprobado=True, activo=True)
        else:
            # Usuario no autenticado solo ve estacionamientos públicos
            return qs.filter(aprobado=True, activo=True)

    def perform_create(self, serializer):
        """Asigna el dueño al crear estacionamiento - CORREGIDO"""
        # Crear parking como NO aprobado por defecto
        parking = serializer.save(
            dueno=self.request.user,
            aprobado=False,  # ← NO aprobado por defecto
            activo=False     # ← NO activo hasta ser aprobado
        )

        # Crear solicitud de aprobación automáticamente
        if self.request.user.is_owner:
            ParkingApprovalRequest.objects.create(
                solicitado_por=self.request.user,
                estacionamiento_creado=parking,
                status='PENDING'
            )

    @action(detail=False, methods=['get'])
    def mis_estacionamientos(self, request):
        """Endpoint específico para dueños - sus estacionamientos"""
        if not request.user.is_owner:
            return Response(
                {'error': 'Solo los dueños pueden acceder a esta función'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        parkings = self.get_queryset().filter(dueno=request.user)
        serializer = self.get_serializer(parkings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mapa(self, request):
        """Estacionamientos disponibles para mapa interactivo - devuelve array sin paginar"""
        # Solo estacionamientos aprobados y activos
        parkings = self.get_queryset().filter(aprobado=True, activo=True)
        
        # Opcional: filtro por disponibilidad
        if request.query_params.get('disponibles') == 'true':
            parkings = parkings.filter(plazas_disponibles__gt=0)
        
        # Opcional: ordenar por rating
        if request.query_params.get('ordenar') == 'rating':
            parkings = parkings.order_by('-rating_promedio')
        
        serializer = self.get_serializer(parkings, many=True)
        # IMPORTANTE: Retorna directamente el array, sin paginación
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_activation(self, request, pk=None):
        """Activar/desactivar estacionamiento (admin y owner)"""
        parking = self.get_object()
        
        # Verificar permisos
        if not request.user.is_admin_general and parking.dueno != request.user:
            return Response(
                {'error': 'No tienes permisos para esta acción'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        parking.activo = not parking.activo
        parking.save()
        
        return Response({
            'message': f'Estacionamiento {"activado" if parking.activo else "desactivado"}',
            'activo': parking.activo
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Aprobar estacionamiento (solo admin)"""
        if not request.user.is_admin_general:
            return Response(
                {'error': 'Solo administradores pueden aprobar estacionamientos'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        parking = self.get_object()
        parking.aprobado = True
        parking.activo = True  # Activar al aprobar
        parking.save()
        
        # Actualizar la solicitud de aprobación si existe
        try:
            approval_request = ParkingApprovalRequest.objects.get(estacionamiento_creado=parking)
            approval_request.status = 'APPROVED'
            approval_request.revisado_por = request.user
            approval_request.fecha_revision = timezone.now()
            approval_request.save()
        except ParkingApprovalRequest.DoesNotExist:
            pass  # No hay solicitud asociada
        
        return Response({
            'message': 'Estacionamiento aprobado exitosamente',
            'aprobado': parking.aprobado
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rechazar estacionamiento (solo admin)"""
        if not request.user.is_admin_general:
            return Response(
                {'error': 'Solo administradores pueden rechazar estacionamientos'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        parking = self.get_object()
        
        # Actualizar la solicitud de aprobación si existe
        try:
            approval_request = ParkingApprovalRequest.objects.get(estacionamiento_creado=parking)
            approval_request.status = 'REJECTED'
            approval_request.revisado_por = request.user
            approval_request.fecha_revision = timezone.now()
            approval_request.motivo_rechazo = request.data.get('motivo', '')
            approval_request.save()
        except ParkingApprovalRequest.DoesNotExist:
            pass  # No hay solicitud asociada
        
        # Eliminar el parking rechazado
        parking.delete()
        
        return Response({
            'message': 'Estacionamiento rechazado y eliminado exitosamente'
        })


class ParkingReviewViewSet(viewsets.ModelViewSet):
    queryset = ParkingReview.objects.select_related('usuario', 'estacionamiento')
    serializer_class = ParkingReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        if user.is_admin_general:
            return self.queryset
        elif user.is_owner:
            # Dueños ven reviews de sus estacionamientos
            return self.queryset.filter(estacionamiento__dueno=user)
        else:
            # Clientes solo ven sus propios reviews
            return self.queryset.filter(usuario=user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class ParkingApprovalViewSet(viewsets.ModelViewSet):
    serializer_class = ParkingApprovalRequestSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageParkingApprovals]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.is_admin_general:
            return ParkingApprovalRequest.objects.all().select_related(
                'solicitado_por', 'revisado_por', 'estacionamiento_creado'
            )
        elif user.is_owner:
            # Dueños ven solo sus solicitudes
            return ParkingApprovalRequest.objects.filter(solicitado_por=user).select_related(
                'solicitado_por', 'revisado_por', 'estacionamiento_creado'
            )
        else:
            return ParkingApprovalRequest.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return ParkingApprovalCreateSerializer
        elif self.action in ['pendientes', 'estadisticas']:
            return ParkingApprovalDashboardSerializer
        return ParkingApprovalRequestSerializer

    def perform_create(self, serializer):
        """Solo owners pueden crear solicitudes"""
        if not self.request.user.is_owner:
            raise serializers.ValidationError("Solo los dueños pueden crear solicitudes de aprobación")
        serializer.save(solicitado_por=self.request.user)

    @action(detail=False, methods=['get'])
    def pendientes(self, request):
        """Solicitudes pendientes (solo admin)"""
        pendientes = self.get_queryset().filter(status='PENDING')
        serializer = self.get_serializer(pendientes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        """Aprobar solicitud (solo admin)"""
        solicitud = self.get_object()
        if solicitud.status != 'PENDING':
            return Response(
                {'error': 'Esta solicitud ya fue procesada'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        solicitud.aprobar(request.user)
        serializer = ParkingApprovalRequestSerializer(solicitud)
        return Response({
            'message': 'Solicitud aprobada exitosamente', 
            'solicitud': serializer.data,
            'estacionamiento_creado_id': solicitud.estacionamiento_creado.id if solicitud.estacionamiento_creado else None
        })

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        """Rechazar solicitud (solo admin)"""
        solicitud = self.get_object()
        if solicitud.status != 'PENDING':
            return Response(
                {'error': 'Esta solicitud ya fue procesada'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ParkingApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud.rechazar(request.user, serializer.validated_data.get('motivo', ''))
        resp_serializer = ParkingApprovalRequestSerializer(solicitud)
        return Response({
            'message': 'Solicitud rechazada', 
            'solicitud': resp_serializer.data
        })

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Estadísticas de aprobaciones (solo admin)"""
        total = ParkingApprovalRequest.objects.count()
        pendientes = ParkingApprovalRequest.objects.filter(status='PENDING').count()
        aprobadas = ParkingApprovalRequest.objects.filter(status='APPROVED').count()
        rechazadas = ParkingApprovalRequest.objects.filter(status='REJECTED').count()
        
        stats = {
            'total_solicitudes': total,
            'pendientes': pendientes,
            'aprobadas': aprobadas,
            'rechazadas': rechazadas,
            'tasa_aprobacion': (aprobadas / total * 100) if total > 0 else 0
        }
        serializer = ApprovalStatisticsSerializer(stats)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mis_solicitudes(self, request):
        """Solicitudes del usuario actual (para owners)"""
        if not request.user.is_owner:
            return Response(
                {'error': 'Solo los dueños pueden ver sus solicitudes'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        solicitudes = self.get_queryset().filter(solicitado_por=request.user)
        serializer = self.get_serializer(solicitudes, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminGeneral])
def admin_dashboard_complete(request):
    """Dashboard completo para administradores generales"""
    try:
        # Estadísticas básicas
        total_parkings = ParkingLot.objects.count()
        active_parkings = ParkingLot.objects.filter(activo=True).count()
        approved_parkings = ParkingLot.objects.filter(aprobado=True).count()
        total_users = User.objects.count()
        
        # Solicitudes de aprobación
        approval_stats = ParkingApprovalRequest.objects.aggregate(
            total=Count('id'),
            pendientes=Count('id', filter=Q(status='PENDING')),
            aprobadas=Count('id', filter=Q(status='APPROVED')),
            rechazadas=Count('id', filter=Q(status='REJECTED'))
        )
        
        # Espacios y ocupación
        spaces_agg = ParkingLot.objects.aggregate(
            total=Sum('total_plazas'), 
            available=Sum('plazas_disponibles')
        )
        total_spaces = spaces_agg['total'] or 0
        available_spaces = spaces_agg['available'] or 0
        occupied_spaces = total_spaces - available_spaces
        
        # Reservas y ingresos
        today = timezone.now().date()
        active_reservations = Reservation.objects.filter(
            hora_entrada__date=today, 
            estado__in=['activa','confirmada']
        ).count()
        
        today_revenue = Payment.objects.filter(
            fecha_pago__date=today, 
            estado='completado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        # Datos para gráficos
        last_7_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        daily_revenue = []
        daily_reservations = []
        
        for day in last_7_days:
            revenue = Payment.objects.filter(
                fecha_pago__date=day, 
                estado='completado'
            ).aggregate(total=Sum('monto'))['total'] or 0
            
            reservations = Reservation.objects.filter(
                hora_entrada__date=day
            ).count()
            
            daily_revenue.append({
                'fecha': day.strftime('%Y-%m-%d'),
                'ingresos': float(revenue)
            })
            daily_reservations.append({
                'fecha': day.strftime('%Y-%m-%d'),
                'reservas': reservations
            })
        
        data = {
            'user': {
                'name': request.user.get_full_name() or request.user.username,
                'role': 'Administrador General',
                'email': request.user.email
            },
            'stats': {
                'total_parkings': total_parkings,
                'active_parkings': active_parkings,
                'approved_parkings': approved_parkings,
                'pending_approvals': approval_stats['pendientes'],
                'total_users': total_users,
                'total_spaces': total_spaces,
                'occupied_spaces': occupied_spaces,
                'available_spaces': available_spaces,
                'active_reservations': active_reservations,
                'today_revenue': float(today_revenue)
            },
            'charts': {
                'daily_revenue': daily_revenue,
                'daily_reservations': daily_reservations
            },
            'recent_activity': {
                'pending_approvals': ParkingApprovalRequest.objects.filter(
                    status='PENDING'
                ).order_by('-fecha_solicitud')[:5].values(
                    'id', 'nombre', 'fecha_solicitud', 'solicitado_por__username'
                ),
                'recent_parkings': ParkingLot.objects.filter(
                    aprobado=True
                ).order_by('-id')[:5].values(
                    'id', 'nombre', 'direccion', 'tarifa_hora'
                )
            }
        }
        
        return Response(data)
        
    except Exception as e:
        logger.error(f"Error en admin_dashboard_complete: {str(e)}")
        return Response(
            {'error': f'Error al cargar datos del dashboard: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsOwner])
def owner_dashboard_complete(request):
    """Dashboard completo para dueños de estacionamientos"""
    try:
        user = request.user
        
        # Obtener los estacionamientos del dueño
        user_parkings = ParkingLot.objects.filter(dueno=user)
        
        if not user_parkings.exists():
            return Response({
                'user': {
                    'name': user.get_full_name() or user.username,
                    'role': 'Propietario',
                    'email': user.email
                },
                'message': 'No tienes estacionamientos registrados. Puedes solicitar la aprobación de uno nuevo.'
            })
        
        # Estadísticas agregadas de todos sus estacionamientos
        parking_stats = user_parkings.aggregate(
            total_spaces=Sum('total_plazas'),
            available_spaces=Sum('plazas_disponibles'),
            total_parkings=Count('id'),
            approved_parkings=Count('id', filter=Q(aprobado=True)),
            active_parkings=Count('id', filter=Q(activo=True))
        )
        
        total_spaces = parking_stats['total_spaces'] or 0
        available_spaces = parking_stats['available_spaces'] or 0
        occupied_spaces = total_spaces - available_spaces
        
        # Reservas e ingresos
        today = timezone.now().date()
        active_reservations = Reservation.objects.filter(
            estacionamiento__in=user_parkings,
            hora_entrada__date=today, 
            estado__in=['activa','confirmada']
        ).count()
        
        # Ingresos de hoy
        today_revenue = Payment.objects.filter(
            reserva__estacionamiento__in=user_parkings,
            fecha_pago__date=today, 
            estado='completado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        # Ingresos del mes actual
        current_month = timezone.now().replace(day=1)
        monthly_revenue = Payment.objects.filter(
            reserva__estacionamiento__in=user_parkings,
            fecha_pago__gte=current_month,
            estado='completado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        # Datos para gráficos
        last_7_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        daily_occupancy = []
        
        for day in last_7_days:
            # Calcular ocupación promedio para el día
            reservations_count = Reservation.objects.filter(
                estacionamiento__in=user_parkings,
                hora_entrada__date=day
            ).count()
            
            daily_occupancy.append({
                'fecha': day.strftime('%Y-%m-%d'),
                'ocupacion': min(reservations_count, total_spaces)
            })
        
        data = {
            'user': {
                'name': user.get_full_name() or user.username,
                'role': 'Propietario',
                'email': user.email
            },
            'stats': {
                'total_parkings': parking_stats['total_parkings'],
                'approved_parkings': parking_stats['approved_parkings'],
                'active_parkings': parking_stats['active_parkings'],
                'total_spaces': total_spaces,
                'occupied_spaces': occupied_spaces,
                'available_spaces': available_spaces,
                'active_reservations': active_reservations,
                'today_revenue': float(today_revenue),
                'monthly_revenue': float(monthly_revenue)
            },
            'parkings': ParkingInfoSerializer(user_parkings, many=True).data,
            'charts': {
                'daily_occupancy': daily_occupancy
            },
            'recent_activity': {
                'today_reservations': Reservation.objects.filter(
                    estacionamiento__in=user_parkings,
                    hora_entrada__date=today
                ).order_by('-hora_entrada')[:5].values(
                    'id', 'usuario__username', 'hora_entrada', 'estado'
                ),
                'recent_reviews': ParkingReview.objects.filter(
                    estacionamiento__in=user_parkings
                ).order_by('-fecha')[:3].values(
                    'id', 'usuario__username', 'calificacion', 'comentario'
                )
            }
        }
        
        return Response(data)
        
    except Exception as e:
        logger.error(f"Error en owner_dashboard_complete: {str(e)}")
        return Response(
            {'error': f'Error al cargar datos del dashboard: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recent_reservations(request):
    """Endpoint legacy para reservas recientes"""
    from reservations.models import Reservation
    from reservations.serializers import ReservationDetailSerializer
    
    if request.user.is_admin_general:
        reservations = Reservation.objects.all().order_by('-created_at')[:10]
    elif request.user.is_owner:
        reservations = Reservation.objects.filter(
            estacionamiento__dueno=request.user
        ).order_by('-created_at')[:10]
    else:
        reservations = Reservation.objects.filter(usuario=request.user).order_by('-created_at')[:10]
    
    serializer = ReservationDetailSerializer(reservations, many=True)
    return Response(serializer.data)