# reservations/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from datetime import timedelta, datetime
from django.shortcuts import get_object_or_404
from decimal import Decimal
from django.db.models import Count, Q
from django.db.models import Count, Sum, Q 

from .permissions import (
    IsAdminGeneral, IsOwner, IsClient, IsAdminOrOwner,
    IsOwnerOfParkingReservation, IsAdminOrOwnerOfReservation, CanManageReservations
)
from .models import Reservation
from .serializers import (
    ReservationClientSerializer, ReservationOwnerSerializer, 
    ReservationAdminSerializer, ReservationDetailSerializer,
    ExtendReservationSerializer, CheckInResponseSerializer,
    CheckOutResponseSerializer, ReservationStatsSerializer,
    ParkingReservationsResponseSerializer
)
from parking.models import ParkingLot
from users.models import Car
from django.shortcuts import render, redirect
from django.conf import settings

# ----------------------------
# VISTAS PARA WEBVIEW MÓVIL
# ----------------------------


def mobile_login_via_token(request):
    """
    Endpoint simple para que la app WebView pueda pasar un token JWT
    en la URL y se establezca como cookie para las siguientes peticiones.

    Uso: /api/reservations/mobile/login/?token=<JWT>&next=/api/reservations/mobile/reservas/
    """
    token = request.GET.get('token')
    next_url = request.GET.get('next') or '/api/reservations/mobile/reservas/'

    response = redirect(next_url)
    if token:
        cookie_name = getattr(settings, 'REST_AUTH', {}).get('JWT_AUTH_COOKIE', 'jwt-auth')
        # Poner cookie no HttpOnly para que JS en WebView pueda leerla y añadir Authorization header
        response.set_cookie(cookie_name, token, httponly=False)
    return response


def mobile_reservas_page(request):
    """Renderiza la pantalla de reservas para WebView.
    La plantilla consumirá la API REST (`/api/reservations/client/mis-reservas/`).
    """
    return render(request, 'reservations/mobile_reservas.html')


def mobile_pago_page(request):
    """Renderiza la pantalla de pago para WebView.

    Espera `?reserva=<uuid>` para preseleccionar la reserva.
    """
    reserva_id = request.GET.get('reserva')
    return render(request, 'reservations/mobile_pago.html', {'reserva_id': reserva_id})

# =============================================================================
# VISTA PRINCIPAL DE RESERVAS
# =============================================================================

class ReservationViewSet(viewsets.ModelViewSet):
    """Vista principal de reservas - Comportamiento diferenciado por rol"""
    # Usar codigo_reserva en las URLs en lugar del pk numérico para que
    # endpoints tipo /api/reservations/<codigo_reserva>/cancel/ funcionen.
    lookup_field = 'codigo_reserva'
    # Aceptar UUIDs (hex + guiones). Ajustar si su codigo_reserva tiene otro formato.
    lookup_value_regex = r'[0-9a-fA-F-]+'
    # Asegurar que el ViewSet acepte tokens JWT además de autenticación por sesión
    authentication_classes = [JWTAuthentication, SessionAuthentication, BasicAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    queryset = Reservation.objects.all().select_related(
        'usuario', 'vehiculo', 'estacionamiento'
    ).order_by('-created_at')
    
    @action(detail=False, methods=['get', 'post', 'put', 'patch', 'delete'])
    def reservations(self, request):
        if request.method == 'GET':
            return self.list(request)
        elif request.method == 'POST':
            return self.create(request)
    
    def get_serializer_class(self):
        """Selecciona serializer según el rol del usuario"""
        user = self.request.user
        
        if not user.is_authenticated:
            return ReservationDetailSerializer
            
        if user.is_admin_general:
            return ReservationAdminSerializer
        elif user.is_owner:
            return ReservationOwnerSerializer
        else:
            # PARA CLIENTES: Usar ReservationClientSerializer para CREATE
            if self.action == 'create':
                return ReservationClientSerializer
            return ReservationDetailSerializer

    def get_queryset(self):
        """Filtra reservas según el rol del usuario"""
        user = self.request.user
        
        if not user.is_authenticated:
            return Reservation.objects.none()
            
        if user.is_admin_general:
            return self.queryset
        elif user.is_owner:
            return self.queryset.filter(estacionamiento__dueno=user)
        else:
            return self.queryset.filter(usuario=user)

    def get_permissions(self):
        """Configura permisos según la acción y rol - CORREGIDO"""
        if self.action in ['list', 'retrieve', 'tipos_reserva']:
            permission_classes = [permissions.IsAuthenticated]
        elif self.action == 'create':
            # ✅ PERMITIR POST A TODOS LOS USUARIOS AUTENTICADOS
            permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy', 'cancel', 'extend']:
            permission_classes = [permissions.IsAuthenticated, IsAdminOrOwnerOfReservation]
        else:
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Crear reserva - PARA TODOS LOS USUARIOS AUTENTICADOS
        """
        data = request.data.copy()
        user = request.user

        vehiculo_id = data.get('vehiculo')
        estacionamiento_id = data.get('estacionamiento')
        hora_entrada = data.get('hora_entrada')
        duracion_minutos = int(data.get('duracion_minutos', 60))
        tipo_reserva = data.get('tipo_reserva', 'hora')

        # Validaciones básicas -> devolver errores por campo para el cliente
        errors = {}
        if not vehiculo_id:
            errors['vehiculo'] = ['Este campo es requerido.']
        if not estacionamiento_id:
            errors['estacionamiento'] = ['Este campo es requerido.']
        if not hora_entrada:
            errors['hora_entrada'] = ['Este campo es requerido.']
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # ✅ CORRECCIÓN: Buscar PRIMERO en Vehicle y convertir a Car si es necesario
        vehiculo_car = None
        user_vehicles = []
        user_cars = []
        
        try:
            from vehicles.models import Vehicle as ExternalVehicle
            try:
                # Buscar en Vehicle primero
                vehiculo_external = ExternalVehicle.objects.get(id=vehiculo_id, usuario=user)
                
                # ✅ CONVERTIR: Crear o obtener un Car equivalente
                vehiculo_car, created = Car.objects.get_or_create(
                    placa=vehiculo_external.placa,
                    usuario=user,
                    defaults={
                        'modelo': getattr(vehiculo_external, 'modelo', ''),
                        'marca': getattr(vehiculo_external, 'marca', ''),
                        'tipo': 'auto',
                        'color': getattr(vehiculo_external, 'color', '')
                    }
                )
                
            except ExternalVehicle.DoesNotExist:
                pass
            user_vehicles = list(ExternalVehicle.objects.filter(usuario=user).values('id', 'placa'))
        except ImportError:
            pass

        # Si no encontró en vehicles, intentar en Car directamente
        if not vehiculo_car:
            try:
                vehiculo_car = Car.objects.get(id=vehiculo_id, usuario=user)
            except Car.DoesNotExist:
                pass
            user_cars = list(Car.objects.filter(usuario=user).values('id', 'placa'))

        # Si no encontró en ningún lado, retornar error
        if not vehiculo_car:
            return Response(
                {
                    'vehiculo': ['Vehículo no encontrado o no pertenece al usuario.'],
                    'user_vehicles': user_vehicles,
                    'user_cars': user_cars
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ Ahora usar vehiculo_car (que es del modelo Car)
        vehiculo = vehiculo_car

        # Bloquear estacionamiento para evitar overbooking
        try:
            parking = ParkingLot.objects.select_for_update().get(
                pk=estacionamiento_id, 
                aprobado=True, 
                activo=True
            )
        except ParkingLot.DoesNotExist:
            return Response(
                {'estacionamiento': ['Estacionamiento no disponible.']},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verificar disponibilidad
        if parking.plazas_disponibles <= 0:
            return Response(
                {'estacionamiento': ['No hay plazas disponibles en este momento.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parsear hora de entrada
        try:
            from django.utils.dateparse import parse_datetime
            entrada_dt = parse_datetime(hora_entrada)

            # Fallback: aceptar formatos comunes (espacio y T)
            if entrada_dt is None:
                try:
                    entrada_dt = datetime.strptime(hora_entrada, "%Y-%m-%d %H:%M:%S")
                except Exception:
                    try:
                        entrada_dt = datetime.strptime(hora_entrada, "%Y-%m-%dT%H:%M:%S")
                    except Exception:
                        entrada_dt = None

            if entrada_dt is None:
                raise ValueError("invalid datetime")

            # Normalizar a timezone-aware si es naive (asumir UTC)
            if entrada_dt.tzinfo is None:
                from django.utils.timezone import make_aware
                try:
                    entrada_dt = make_aware(entrada_dt)
                except Exception:
                    # si no se puede hacer aware, dejar como está y comparar en UTC
                    pass

            # Verificar que la reserva no sea en el pasado
            if entrada_dt < timezone.now():
                return Response(
                    {'hora_entrada': ['No se pueden hacer reservas en el pasado.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except ValueError:
            return Response(
                {'hora_entrada': ['Formato de hora_entrada inválido. Use formato ISO (ej: 2025-11-29T04:30:00 o 2025-11-29 04:30:00).']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar tipo de reserva
        if tipo_reserva == 'dia' and not hasattr(parking, 'precio_dia'):
            return Response(
                {'tipo_reserva': ['Este estacionamiento no acepta reservas por día.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif tipo_reserva == 'mes' and not hasattr(parking, 'precio_mes'):
            return Response(
                {'tipo_reserva': ['Este estacionamiento no acepta reservas por mes.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar duración mínima según tipo de reserva
        if tipo_reserva == 'hora' and duracion_minutos < 60:
            return Response(
                {'duracion_minutos': ['La duración mínima para reserva por hora es 60 minutos.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif tipo_reserva == 'dia' and duracion_minutos < 1440:
            return Response(
                {'duracion_minutos': ['La duración mínima para reserva por día es 24 horas.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif tipo_reserva == 'mes' and duracion_minutos < 43200:
            return Response(
                {'duracion_minutos': ['La duración mínima para reserva por mes es 30 días.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificar conflictos de reserva para el mismo vehículo
        salida_dt = entrada_dt + timedelta(minutes=duracion_minutos)
        reservas_conflicto = Reservation.objects.filter(
            vehiculo=vehiculo,
            hora_entrada__lt=salida_dt,
            hora_salida__gt=entrada_dt,
            estado__in=['activa', 'confirmada']
        )
        
        if reservas_conflicto.exists():
            return Response(
                {'non_field_errors': ['El vehículo ya tiene una reserva en ese horario.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular costo (usar tarifa_hora como base)
        precio_por_minuto = float(parking.tarifa_hora) / 60.0
        costo_estimado = round(precio_por_minuto * duracion_minutos, 2)

        # Reducir plazas disponibles
        parking.plazas_disponibles -= 1
        parking.save()

        # Crear reserva
        create_payload = {
            'vehiculo': vehiculo.id,
            'estacionamiento': estacionamiento_id,
            'hora_entrada': entrada_dt,
            'hora_salida': salida_dt,
            'duracion_minutos': duracion_minutos,
            'costo_estimado': costo_estimado,
            'tipo_reserva': tipo_reserva
        }

        serializer = self.get_serializer(data=create_payload)
        serializer.is_valid(raise_exception=True)
        reservation = serializer.save(usuario=user)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def cancel(self, request, codigo_reserva=None):
        """
        Cancelar reserva
        """
        # ✅ codigo_reserva contiene el codigo de la reserva (lookup_field configurado)
        reservation = self.get_object()
        user = request.user

        # ✅ MEJORADO: Permitir cancelar reservas en varios estados (activa, confirmada, proxima)
        # Pero no permitir cancelar si ya está finalizada o cancelada
        estados_cancelables = ['activa', 'confirmada', 'proxima', 'pending']
        if reservation.estado not in estados_cancelables:
            return Response(
                {
                    'detail': f'No se puede cancelar una reserva en estado \"{reservation.estado}\". '
                              f'Solo se pueden cancelar reservas en estados: {", ".join(estados_cancelables)}.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cancelar reserva y liberar plaza
        with transaction.atomic():
            parking = ParkingLot.objects.select_for_update().get(pk=reservation.estacionamiento.id)
            parking.plazas_disponibles += 1
            parking.save()
            
            reservation.estado = 'cancelada'
            reservation.save()

        return Response(
            {'detail': 'Reserva cancelada exitosamente.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def checkin(self, request, codigo_reserva=None):
        """
        Check-in vía ViewSet (permite a dueño/admin forzar el check-in sin restricción de tiempo).
        Si el usuario es cliente se mantiene la lógica original (verificar tiempo_antes).
        """
        reservation = self.get_object()
        user = request.user

        # Si el actor es owner o admin, permitir forzar check-in
        is_privileged = getattr(user, 'is_admin_general', False) or getattr(user, 'is_owner', False)

        if reservation.estado != 'activa' and reservation.estado != 'confirmada':
            # Si no está en estado que permita check-in, permitir solo si es privileged
            if not is_privileged:
                return Response({'detail': 'La reserva no está en un estado válido para check-in.'}, status=status.HTTP_400_BAD_REQUEST)

        if not is_privileged:
            # Comprobar ventana de tiempo (mismo comportamiento que la API original)
            tiempo_antes = (reservation.hora_entrada - timezone.now()).total_seconds() / 60
            if tiempo_antes > 30:
                return Response(
                    {'detail': 'Solo puede hacer check-in hasta 30 minutos antes de la reserva.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Marcar como activa / check-in
        reservation.estado = 'activa'
        reservation.save()

        response_data = {
            'detail': 'Check-in realizado exitosamente.',
            'reserva': ReservationDetailSerializer(reservation).data
        }
        return Response(response_data)

    @action(detail=True, methods=['post'])
    def validate_payment(self, request, codigo_reserva=None):
        """
        Registrar/validar pago manualmente desde el owner/dashboard.
        Acepta mínimo: { monto } o { monto, estado }.
        """
        reservation = self.get_object()
        data = request.data or {}

        monto_raw = data.get('monto') or data.get('amount') or data.get('cantidad')
        estado_str = (data.get('estado') or data.get('status') or '').lower()
        pago_pagado = estado_str in ['pagado', 'paid', 'completed', 'success'] or (not estado_str and monto_raw is not None)

        try:
            with transaction.atomic():
                # Actualizar monto si se proporciona
                if monto_raw is not None:
                    try:
                        monto_dec = Decimal(str(monto_raw))
                        reservation.costo_estimado = monto_dec
                    except Exception:
                        pass

                # Actualizar estado en función del pago
                if pago_pagado:
                    reservation.estado = 'confirmada'

                # Intentar actualizar objeto payment relacionado si existe
                payment_obj = getattr(reservation, 'payment', None)
                if payment_obj is not None and hasattr(payment_obj, 'save'):
                    mapping = {
                        'monto': 'monto', 'amount': 'monto',
                        'moneda': 'moneda', 'currency': 'moneda',
                        'estado': 'estado', 'status': 'estado',
                        'referencia_pago': 'referencia_pago', 'reference': 'referencia_pago',
                        'metodo': 'metodo', 'method': 'metodo'
                    }
                    for k, v in data.items():
                        target = mapping.get(k)
                        if target and hasattr(payment_obj, target):
                            try:
                                setattr(payment_obj, target, v)
                            except Exception:
                                pass
                    fecha = data.get('fecha_pago') or data.get('paid_at') or data.get('fecha')
                    if fecha:
                        try:
                            from django.utils.dateparse import parse_datetime
                            fecha_dt = parse_datetime(fecha)
                            if fecha_dt and hasattr(payment_obj, 'fecha_pago'):
                                payment_obj.fecha_pago = fecha_dt
                        except Exception:
                            pass
                    try:
                        payment_obj.save()
                    except Exception as e:
                        # ✅ MEJORADO: Ignorar error de guardar payment sin romper la operación
                        print(f"[validate_payment] Error guardando payment: {str(e)}")

                reservation.save()

            return Response({
                'detail': 'Información de pago registrada.',
                'reserva': ReservationDetailSerializer(reservation).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            print(f"[validate_payment] Error: {str(e)}")
            print(f"[validate_payment] Traceback: {traceback.format_exc()}")
            return Response({'detail': f'Error registrando pago: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def send_ticket(self, request, codigo_reserva=None):
        """
        Generar y almacenar un ticket comprobante desde el backend.
        No requiere que el frontend envíe URL; el backend crea un código/ticket y lo devuelve.
        Devuelve: { ticket: { code, message, created_at } }
        """
        reservation = self.get_object()
        user = request.user

        try:
            from uuid import uuid4
            ticket_code = f"TK-{uuid4().hex[:12].upper()}"
            created_at = timezone.now().isoformat()
            message = f"Ticket generado por {getattr(user, 'username', str(user))}"

            ticket_obj = {
                'code': ticket_code,
                'message': message,
                'created_at': created_at
            }

            # Intentar guardar en payment si existe
            payment_obj = getattr(reservation, 'payment', None)
            if payment_obj is not None and hasattr(payment_obj, 'save'):
                try:
                    if hasattr(payment_obj, 'ticket_code'):
                        payment_obj.ticket_code = ticket_code
                    if hasattr(payment_obj, 'ticket_url'):
                        payment_obj.ticket_url = f"generated://{ticket_code}"
                    payment_obj.save()
                except Exception:
                    reservation.notes = (reservation.notes or '') + f"\n[Ticket generado]: {ticket_obj}"
                    reservation.save()
            else:
                reservation.notes = (reservation.notes or '') + f"\n[Ticket generado]: {ticket_obj}"
                reservation.save()

            print(f"[send_ticket] user={getattr(user,'username',str(user))} reserva={reservation.codigo_reserva} ticket={ticket_code}")
            return Response({'detail': 'Ticket generado correctamente.', 'ticket': ticket_obj}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': f'Error generando ticket: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Acción única para devolver las reservas del owner y exponer la ruta exacta usada por el frontend.
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsOwner],
            url_path='owner/reservas', url_name='owner_reservas')
    def reservas_estacionamiento(self, request):
        """
        Reservas de los estacionamientos del dueño (ruta /api/reservations/owner/reservas/).
        """
        user_parkings = ParkingLot.objects.filter(dueno=request.user)
        reservations = Reservation.objects.filter(estacionamiento__in=user_parkings).order_by('-hora_entrada')

        serializer = ReservationOwnerSerializer(reservations, many=True)
        for i, reservation in enumerate(reservations):
            try:
                print(f"Reserva {i}: id={reservation.id}, codigo_reserva={reservation.codigo_reserva}")
            except Exception:
                print(f"Reserva {i}: id={getattr(reservation, 'id', 'unknown')}, codigo_reserva=ERROR")
        return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def owner_reservations_stats(request):
	"""
	Obtener estadísticas de reservas para el propietario autenticado.
	Calcula: total, activas, próximas, completadas, canceladas, ingresos hoy, ingresos mes.
	"""
	try:
		import logging
		logger = logging.getLogger(__name__)
		logger.info(f'owner_reservations_stats: user={request.user}, rol={getattr(request.user, "rol", None)}')
		
		user = request.user
		
		# Obtener reservas del propietario desde sus estacionamientos
		if hasattr(user, 'rol') and user.rol == 'owner':
			try:
				from parking.models import Estacionamiento
				parkings = Estacionamiento.objects.filter(owner=user)
				logger.info(f'Owner {user.id} tiene {parkings.count()} estacionamientos')
				reservations = Reservation.objects.filter(estacionamiento__in=parkings)
			except Exception as e:
				logger.error(f'Error obteniendo estacionamientos del owner: {str(e)}')
				reservations = Reservation.objects.none()
		elif user.is_staff:
			# Admin ve todas
			logger.info(f'Admin {user.id} obteniendo todas las reservas')
			reservations = Reservation.objects.all()
		else:
			# Cliente solo sus propias
			logger.info(f'Cliente {user.id} obteniendo sus reservas')
			reservations = Reservation.objects.filter(usuario=user)
		
		logger.info(f'Total reservas a procesar: {reservations.count()}')
		
		now = timezone.now()
		start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
		last_30_days = now - timedelta(days=30)
		
		logger.info(f'Filtros: hoy={start_of_today}, hace 30 días={last_30_days}')
		
		# Estadísticas de estado
		total = reservations.count()
		active = reservations.filter(estado__in=['activa', 'in_progress']).count()
		upcoming = reservations.filter(estado__in=['proxima', 'confirmada']).count()
		completed = reservations.filter(estado__in=['finalizada', 'completed']).count()
		cancelled = reservations.filter(estado='cancelada').count()
		
		logger.info(f'Estados: activas={active}, próximas={upcoming}, completadas={completed}, canceladas={cancelled}')
		
		# Ingresos desde pagos confirmados - SIN filtro fecha_pago si es NULL
		try:
			from payments.models import Payment
			
			# Pagos de hoy (si fecha_pago es null, no se cuenta para "hoy")
			today_payments = Payment.objects.filter(
				reserva__in=reservations,
				estado='pagado',
				fecha_pago__gte=start_of_today
			).aggregate(total=Sum('monto'))['total']
			today_total = float(today_payments) if today_payments else 0
			
			# Pagos del mes (si fecha_pago es null, no se cuenta)
			monthly_payments = Payment.objects.filter(
				reserva__in=reservations,
				estado='pagado',
				fecha_pago__gte=last_30_days
			).aggregate(total=Sum('monto'))['total']
			monthly_total = float(monthly_payments) if monthly_payments else 0
			
			logger.info(f'Ingresos: hoy={today_total}, mes={monthly_total}')
			
		except Exception as e:
			logger.error(f'Error calculando ingresos: {str(e)}')
			today_total = 0
			monthly_total = 0
		
		response_data = {
			'total': total,
			'active': active,
			'upcoming': upcoming,
			'completed': completed,
			'cancelled': cancelled,
			'today_earnings': today_total,
			'monthly_earnings': monthly_total
		}
		
		logger.info(f'Response stats: {response_data}')
		return Response(response_data)
	
	except Exception as e:
		import logging
		import traceback
		logger = logging.getLogger(__name__)
		logger.error(f'Error en owner_reservations_stats: {str(e)}')
		logger.error(f'Traceback: {traceback.format_exc()}')
		
		return Response({
			'error': str(e),
			'total': 0,
			'active': 0,
			'upcoming': 0,
			'completed': 0,
			'cancelled': 0,
			'today_earnings': 0,
			'monthly_earnings': 0
		}, status=500)