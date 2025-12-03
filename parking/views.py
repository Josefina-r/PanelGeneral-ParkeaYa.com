# parking/views.py
from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Count, Avg, Sum, F, Q
from django.db.models.functions import TruncDate
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.contrib.auth import get_user_model
from .serializers import ParkingImageUploadSerializer
from datetime import timedelta, datetime
import logging
import uuid

from analytic import serializers

from .permissions import (
    IsAdminGeneral, IsOwner, IsAdminOrOwner, 
    IsOwnerOfParking, IsAdminOrOwnerOfParking, CanManageParkingApprovals
)
from .models import ParkingLot, ParkingReview, ParkingApprovalRequest, ParkingImage, ParkingApprovalImage
from .serializers import (
    ParkingLotClientSerializer, ParkingLotOwnerSerializer, ParkingLotAdminSerializer,
    ParkingLotListSerializer, ParkingLotSerializer, ParkingReviewSerializer, ParkingImageSerializer,
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
    parser_classes = [MultiPartParser, FormParser]  # ✅ IMPORTANTE: Para recibir archivos

    def get_serializer_context(self):
        """🔑 CRÍTICO: Pasar el contexto del request al serializer para URLs absolutas"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_serializer_class(self):
        """✅ Selecciona serializer según el rol del usuario - INCLUYEN IMÁGENES"""
        user = self.request.user
        
        if not user.is_authenticated:
            print("🔄 Usando ParkingLotClientSerializer para usuario no autenticado")
            return ParkingLotClientSerializer
            
        if user.is_admin_general:
            print("🔄 Usando ParkingLotAdminSerializer para admin")
            return ParkingLotAdminSerializer
        elif user.is_owner:
            print("🔄 Usando ParkingLotOwnerSerializer para owner")
            return ParkingLotOwnerSerializer
        else:
            print("🔄 Usando ParkingLotClientSerializer para cliente")
            return ParkingLotClientSerializer

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve para debug de imágenes"""
        instance = self.get_object()
        
        # Debug: verificar imágenes en la base de datos
        print(f"🔍 [ParkingDetail-API] Parking ID: {instance.id}")
        print(f"🔍 [ParkingDetail-API] Nombre: {instance.nombre}")
        print(f"🔍 [ParkingDetail-API] Tiene imágenes: {instance.imagenes.exists()}")
        print(f"🔍 [ParkingDetail-API] Total imágenes: {instance.imagenes.count()}")
        
        if instance.imagenes.exists():
            for i, img in enumerate(instance.imagenes.all()):
                print(f"🔍 [ParkingDetail-API] Imagen {i}: {img.imagen.name} - URL: {img.imagen.url if img.imagen else 'None'}")
        
        serializer = self.get_serializer(instance)
        
        # Debug: ver qué datos se envían en la respuesta
        response_data = serializer.data
        print(f"🔍 [ParkingDetail-API] Respuesta serializada - Tiene 'imagenes': {'imagenes' in response_data}")
        print(f"🔍 [ParkingDetail-API] Respuesta serializada - Tiene 'imagen_principal': {'imagen_principal' in response_data}")
        
        if 'imagenes' in response_data:
            print(f"🔍 [ParkingDetail-API] Número de imágenes en respuesta: {len(response_data['imagenes'])}")
            for i, img_data in enumerate(response_data['imagenes']):
                print(f"🔍 [ParkingDetail-API] Imagen {i} en respuesta: {img_data.get('imagen_url', 'No URL')}")
        
        return Response(response_data)

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

    def create(self, request, *args, **kwargs):
        """Override create para debug y asegurar imágenes"""
        print(f"🔍 [CREATE-API] Headers: {dict(request.headers)}")
        print(f"🔍 [CREATE-API] Content-Type: {request.content_type}")
        print(f"🔍 [CREATE-API] Método: {request.method}")
        print(f"🔍 [CREATE-API] Archivos recibidos: {list(request.FILES.keys())}")
        print(f"🔍 [CREATE-API] Número de imágenes: {len(request.FILES.getlist('imagenes', []))}")
        
        # Debug de datos del formulario
        print(f"🔍 [CREATE-API] Datos POST: {request.data}")
        
        response = super().create(request, *args, **kwargs)
        
        # Después de crear, recargar el parking desde BD para obtener imágenes
        if response.status_code == 201:
            parking_id = response.data.get('id')
            if parking_id:
                try:
                    # Recargar desde BD con imágenes
                    parking = ParkingLot.objects.prefetch_related('imagenes').get(id=parking_id)
                    serializer = self.get_serializer(parking, context=self.get_serializer_context())
                    
                    print(f"🔄 Reenviando parking {parking_id} con imágenes actualizadas")
                    print(f"📸 Total imágenes en respuesta: {len(serializer.data.get('imagenes', []))}")
                    
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                except ParkingLot.DoesNotExist:
                    print(f"❌ Parking {parking_id} no encontrado después de crear")
        
        return response

    def perform_create(self, serializer):
        """Crear parking y guardar imágenes asociadas - VERSIÓN MEJORADA"""
        try:
            # Extraer imágenes del request
            imagenes_data = self.request.FILES.getlist('imagenes')
            print(f"📸 Imágenes recibidas en perform_create: {len(imagenes_data)}")
            
            # Crear el parking primero
            parking = serializer.save(
                dueno=self.request.user,
                aprobado=False, 
                activo=False    
            )

            logger.info(f"🏢 Parking creado por user={self.request.user.id} parking_id={parking.id}")
            print(f"✅ Parking creado: ID={parking.id}, Nombre={parking.nombre}")

            # ✅ GUARDAR LAS IMÁGENES ASOCIADAS AL PARKING
            if imagenes_data:
                print(f"📸 Procesando {len(imagenes_data)} imagen(es) para parking_id={parking.id}")
                
                for i, imagen_file in enumerate(imagenes_data):
                    try:
                        print(f"📤 Guardando imagen {i+1}: {imagen_file.name} (size: {imagen_file.size} bytes)")
                        
                        parking_image = ParkingImage.objects.create(
                            estacionamiento=parking,
                            imagen=imagen_file,
                            descripcion=f"Imagen {i+1} de {parking.nombre}"
                        )
                        
                        print(f"✅ Imagen guardada: ID={parking_image.id}")
                        logger.info(f"✅ Imagen guardada: {imagen_file.name} para parking {parking.id}")
                        
                    except Exception as e:
                        logger.error(f"❌ Error guardando imagen {imagen_file.name}: {str(e)}")
                        print(f"❌ Error con imagen {imagen_file.name}: {str(e)}")
            else:
                print(f"ℹ️ No hay imágenes para guardar en perform_create")
            
            # Verificar que las imágenes se guardaron
            total_imagenes = parking.imagenes.count()
            print(f"📊 Total imágenes guardadas en BD: {total_imagenes}")
            
            # Crear solicitud de aprobación automáticamente para owners
            if self.request.user.is_owner:
                try:
                    panel_local = str(uuid.uuid4())
                    req = ParkingApprovalRequest.objects.create(
                        nombre=parking.nombre,
                        direccion=parking.direccion,
                        coordenadas=parking.coordenadas or '',
                        telefono=parking.telefono or '',
                        descripcion=parking.descripcion or '',
                        horario_apertura=parking.horario_apertura,
                        horario_cierre=parking.horario_cierre,
                        nivel_seguridad=parking.nivel_seguridad,
                        tarifa_hora=parking.tarifa_hora,
                        total_plazas=parking.total_plazas,
                        plazas_disponibles=parking.plazas_disponibles,
                        servicios=[],
                        panel_local_id=panel_local,
                        status='PENDING',
                        solicitado_por=self.request.user,
                        estacionamiento_creado=parking
                    )
                    logger.info(f"📋 ParkingApprovalRequest creado id={req.id} para parking_id={parking.id}")
                except Exception as e:
                    logger.exception(f"❌ Error creando ParkingApprovalRequest: {e}")
                    
        except Exception as e:
            logger.error(f"💥 Error en perform_create: {str(e)}")
            print(f"💥 Error crítico en perform_create: {str(e)}")
            raise

    def update(self, request, *args, **kwargs):
        """✅ Override update para asegurar que retorna parking con imágenes"""
        print(f"🔍 [UPDATE-API] Actualizando parking, imágenes recibidas: {len(request.FILES.getlist('imagenes', []))}")
        
        response = super().update(request, *args, **kwargs)
        
        # Después de actualizar, recargar el parking desde BD para obtener imágenes
        if response.status_code in [200, 201]:
            parking_id = response.data.get('id')
            if parking_id:
                try:
                    # Recargar desde BD con imágenes usando .prefetch_related()
                    parking = ParkingLot.objects.prefetch_related('imagenes').get(id=parking_id)
                    
                    # Usar el serializer correcto con contexto
                    serializer = self.get_serializer(parking, context=self.get_serializer_context())
                    
                    print(f"🔄 Reenviando parking {parking_id} actualizado con imágenes")
                    print(f"📸 Serializer: {serializer.__class__.__name__}")
                    print(f"📸 Total imágenes en respuesta: {len(serializer.data.get('imagenes', []))}")
                    
                    # Verificar que el serializer tiene el campo imagenes
                    if 'imagenes' in serializer.data:
                        print(f"✅ Campo 'imagenes' presente en respuesta")
                        for idx, img in enumerate(serializer.data['imagenes']):
                            print(f"   {idx + 1}. ID: {img.get('id')}, URL: {img.get('imagen_url')}")
                    else:
                        print(f"❌ ADVERTENCIA: Campo 'imagenes' NO presente en respuesta")
                        print(f"   Campos disponibles: {list(serializer.data.keys())}")
                    
                    return Response(serializer.data, status=status.HTTP_200_OK)
                except ParkingLot.DoesNotExist:
                    print(f"❌ Parking {parking_id} no encontrado después de actualizar")
                    pass
        
        return response

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

    @action(detail=True, methods=['get'])
    def debug_images(self, request, pk=None):
        """Endpoint de debug para verificar imágenes del parking"""
        parking = self.get_object()
        
        print(f"🔍 [DEBUG-IMAGES] Parking: {parking.nombre} (ID: {parking.id})")
        print(f"🔍 [DEBUG-IMAGES] Total imágenes en BD: {parking.imagenes.count()}")
        
        imagenes_info = []
        for i, img in enumerate(parking.imagenes.all()):
            img_info = {
                'id': img.id,
                'nombre_archivo': img.imagen.name if img.imagen else 'None',
                'url': img.imagen.url if img.imagen else 'None',
                'tamaño': img.imagen.size if img.imagen else 0,
                'descripcion': img.descripcion
            }
            imagenes_info.append(img_info)
            print(f"🔍 [DEBUG-IMAGES] Imagen {i}: {img_info}")
        
        return Response({
            'parking_id': parking.id,
            'parking_nombre': parking.nombre,
            'total_imagenes': parking.imagenes.count(),
            'imagenes': imagenes_info
        })
   
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_images(self, request, pk=None):
        """Subir imágenes al estacionamiento - Solo owner o admin"""
        try:
            parking = self.get_object()
            print(f"🖼️ Subiendo imágenes para parking: {parking.id} - {parking.nombre}")
            
            # Verificar que el usuario es el dueño
            if parking.dueno != request.user and not request.user.is_admin_general:
                return Response(
                    {'error': 'No tienes permisos para subir imágenes a este estacionamiento'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
     
            serializer = ParkingImageUploadSerializer(data=request.data)
            if not serializer.is_valid():
                print(f"❌ Error de validación: {serializer.errors}")
                return Response(
                    {'error': 'Datos inválidos', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            imagenes_data = request.FILES.getlist('imagenes')
            print(f"📁 Archivos recibidos: {len(imagenes_data)}")
            
            if not imagenes_data:
                return Response(
                    {'error': 'No se proporcionaron archivos de imagen'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            uploaded_images = []
            errors = []
            
            for i, imagen_file in enumerate(imagenes_data):
                try:
                    print(f"💾 Guardando imagen {i+1}: {imagen_file.name} ({imagen_file.size} bytes)")
                    
                    # Crear imagen con descripción opcional
                    descripcion = request.data.get(f'descripcion_{imagen_file.name}', '') or f"Imagen de {parking.nombre}"
                    
                    parking_image = ParkingImage.objects.create(
                        estacionamiento=parking,
                        imagen=imagen_file,
                        descripcion=descripcion
                    )
                    
                    print(f"✅ Imagen guardada en BD - ID: {parking_image.id}")
                    logger.info(f"✅ Imagen subida: {imagen_file.name} para parking_id={parking.id}")
                    
                    # Obtener URL completa
                    imagen_url = parking_image.imagen.url
                    if request:
                        imagen_url = request.build_absolute_uri(imagen_url)
                    
                    uploaded_images.append({
                        'id': parking_image.id,
                        'imagen_url': imagen_url,
                        'descripcion': parking_image.descripcion,
                        'creado_en': parking_image.creado_en
                    })
                    
                except Exception as e:
                    error_msg = f'Error al subir {imagen_file.name}: {str(e)}'
                    print(f"❌ {error_msg}")
                    logger.error(f"❌ {error_msg}")
                    errors.append(error_msg)
            
            # Verificación final
            total_imagenes_actual = parking.imagenes.count()
            print(f"📊 Verificación final - Total imágenes en parking: {total_imagenes_actual}")
            
            response_data = {
                'message': f'{len(uploaded_images)} imagen(es) subida(s) exitosamente',
                'uploaded_images': uploaded_images,
                'total_uploaded': len(uploaded_images),
                'total_parking_images': total_imagenes_actual
            }
            
            if errors:
                response_data['errors'] = errors
                return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"💥 Error general en upload_images: {str(e)}")
            logger.error(f"💥 Error en upload_images: {str(e)}")
            return Response(
                {'error': f'Error interno del servidor: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['delete'])
    def delete_image(self, request, pk=None):
        """Eliminar una imagen específica del estacionamiento"""
        parking = self.get_object()
        image_id = request.query_params.get('image_id')
        
        # Verificar permisos
        if not request.user.is_admin_general and parking.dueno != request.user:
            return Response(
                {'error': 'No tienes permisos para eliminar imágenes de este estacionamiento'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not image_id:
            return Response(
                {'error': 'Se requiere el parámetro "image_id"'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            parking_image = ParkingImage.objects.get(id=image_id, estacionamiento=parking)
            image_name = parking_image.imagen.name
            parking_image.delete()
            
            logger.info(f"✅ Imagen eliminada: {image_name} de parking_id={parking.id}")
            
            return Response({
                'message': 'Imagen eliminada exitosamente',
                'total_remaining_images': parking.imagenes.count()
            })
        except ParkingImage.DoesNotExist:
            return Response(
                {'error': 'Imagen no encontrada'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"❌ Error al eliminar imagen: {str(e)}")
            return Response(
                {'error': f'Error al eliminar la imagen: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def imagenes(self, request, pk=None):
        """Obtener todas las imágenes del estacionamiento"""
        parking = self.get_object()
        imagenes = parking.imagenes.all()
        
        serializer = ParkingImageSerializer(imagenes, many=True, context={'request': request})
        
        logger.info(f"🔍 Parking ID: {parking.id} - Total imágenes: {imagenes.count()}")
        
        return Response({
            'parking_id': parking.id,
            'parking_nombre': parking.nombre,
            'total_imagenes': imagenes.count(),
            'imagenes': serializer.data
        })

    def list(self, request, *args, **kwargs):
        """Override list para asegurar que el contexto se pase al serializer"""
        queryset = self.filter_queryset(self.get_queryset())
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
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
        
        # Usar el serializer con contexto
        serializer = ParkingLotListSerializer(parkings, many=True, context={'request': request})
        
        # Debug para el mapa
        print(f"🔍 [Mapa-API] Total parkings enviados: {len(serializer.data)}")
        for i, parking_data in enumerate(serializer.data):
            print(f"🔍 [Mapa-API] Parking {i}: {parking_data.get('nombre')} - Imagen: {parking_data.get('imagen_principal', 'No image')}")
        
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
        # Validar que venga estacionamiento en los datos validados
        estacionamiento = serializer.validated_data.get('estacionamiento')
        if not estacionamiento:
            raise ValidationError({'estacionamiento': 'Este campo es requerido.'})

        # Evitar duplicados del mismo usuario para el mismo parking
        if ParkingReview.objects.filter(estacionamiento=estacionamiento, usuario=self.request.user).exists():
            raise ValidationError({'non_field_errors': ['Ya has realizado una reseña para este estacionamiento.']})

        # Forzar usuario y publicar inmediatamente
        review = serializer.save(usuario=self.request.user, activo=True)

        # Recalcular rating del parking usando solo reseñas activas
        reviews_activas = ParkingReview.objects.filter(estacionamiento=estacionamiento, activo=True)
        if reviews_activas.exists():
            avg_rating = reviews_activas.aggregate(avg=Avg('calificacion'))['avg'] or 0
            estacionamiento.rating_promedio = avg_rating
            estacionamiento.total_reseñas = reviews_activas.count()
        else:
            estacionamiento.rating_promedio = 0
            estacionamiento.total_reseñas = 0
        estacionamiento.save()


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
        # Delegar la creación y el manejo de imágenes al serializer.create()
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


class ParkingImageViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar imágenes individuales del parking"""
    queryset = ParkingImage.objects.all()
    serializer_class = ParkingImageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filtrar imágenes según el usuario"""
        user = self.request.user
        
        if user.is_admin_general:
            # Admin ve todas las imágenes
            return ParkingImage.objects.all()
        elif user.is_owner:
            # Owner solo ve imágenes de sus parkings
            return ParkingImage.objects.filter(estacionamiento__dueno=user)
        else:
            # Cliente solo ve imágenes públicas
            return ParkingImage.objects.filter(estacionamiento__aprobado=True, estacionamiento__activo=True)

    def destroy(self, request, *args, **kwargs):
        """Eliminar una imagen - verificar permisos"""
        image = self.get_object()
        
        # Verificar que el usuario es dueño del parking de la imagen o admin
        if not request.user.is_admin_general and image.estacionamiento.dueno != request.user:
            return Response(
                {'error': 'No tienes permisos para eliminar esta imagen'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        image_name = image.imagen.name
        logger.info(f"✅ Eliminando imagen: {image_name} de parking_id={image.estacionamiento.id}")
        
        return super().destroy(request, *args, **kwargs)


from django.db.models import Avg  # ya debería estar importado; si no, se añade arriba

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_parking_review(request):
    """Crear una reseña para un estacionamiento - SIN APROBACIÓN (publicada de inmediato)"""
    try:
        data = request.data.copy()
        data['usuario'] = request.user.id

        serializer = ParkingReviewSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            # Evitar duplicados de reseña por mismo usuario en mismo parking
            existing_review = ParkingReview.objects.filter(
                estacionamiento_id=data.get('estacionamiento'),
                usuario=request.user
            ).exists()

            if existing_review:
                return Response({'error': 'Ya has realizado una reseña para este estacionamiento'}, status=status.HTTP_400_BAD_REQUEST)

            # Publicar automáticamente
            serializer.validated_data['activo'] = True
            review = serializer.save()

            # Recalcular rating del parking usando solo reseñas activas
            parking = review.estacionamiento
            reviews_activas = ParkingReview.objects.filter(estacionamiento=parking, activo=True)
            if reviews_activas.exists():
                avg_rating = reviews_activas.aggregate(avg=Avg('calificacion'))['avg'] or 0
                parking.rating_promedio = avg_rating
                parking.total_reseñas = reviews_activas.count()
                parking.save()

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception(f"Error en create_parking_review: {e}")
        return Response({'error': 'Error al crear la reseña'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def parking_reviews_public(request, parking_id):
    """Obtener reseñas públicas (solo activas) de un estacionamiento"""
    try:
        parking = ParkingLot.objects.get(id=parking_id)
        reviews = ParkingReview.objects.filter(estacionamiento=parking, activo=True).select_related('usuario').order_by('-fecha')[:20]
        serializer = ParkingReviewSerializer(reviews, many=True, context={'request': request})

        total_reviews = reviews.count()
        avg_rating = reviews.aggregate(avg=Avg('calificacion'))['avg'] if total_reviews > 0 else 0

        return Response({
            'reviews': serializer.data,
            'stats': {
                'total_reviews': total_reviews,
                'average_rating': avg_rating or 0,
                'parking_id': parking_id
            }
        })
    except ParkingLot.DoesNotExist:
        return Response({'error': 'Estacionamiento no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.exception(f"Error en parking_reviews_public: {e}")
        return Response({'error': 'Error al obtener reseñas'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def report_review(request, review_id):
    """Reportar una reseña como inapropiada (marca reportado y guarda motivo)"""
    try:
        review = ParkingReview.objects.get(id=review_id)
        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({'error': 'Debe proporcionar un motivo para el reporte'}, status=status.HTTP_400_BAD_REQUEST)

        review.reportado = True
        review.motivo_reporte = motivo
        review.save()

        # (Opcional) Notificar administradores aquí

        return Response({'message': 'Reseña reportada. Los administradores la revisarán.', 'review_id': review_id})
    except ParkingReview.DoesNotExist:
        return Response({'error': 'Reseña no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.exception(f"Error en report_review: {e}")
        return Response({'error': 'Error al reportar la reseña'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminGeneral])
def admin_deactivate_review(request, review_id):
    """Administrador desactiva una reseña inapropiada y actualiza el rating del parking"""
    try:
        review = ParkingReview.objects.get(id=review_id)
        motivo = request.data.get('motivo', 'Contenido inapropiado')

        review.activo = False
        review.save()

        # Recalcular rating del parking excluyendo reseñas inactivas
        parking = review.estacionamiento
        reviews_activas = ParkingReview.objects.filter(estacionamiento=parking, activo=True)
        if reviews_activas.exists():
            avg_rating = reviews_activas.aggregate(avg=Avg('calificacion'))['avg'] or 0
            parking.rating_promedio = avg_rating
            parking.total_reseñas = reviews_activas.count()
        else:
            parking.rating_promedio = 0
            parking.total_reseñas = 0
        parking.save()

        return Response({
            'message': f'Reseña desactivada: {motivo}',
            'review_id': review_id,
            'parking_updated': True,
            'new_rating': parking.rating_promedio
        })
    except ParkingReview.DoesNotExist:
        return Response({'error': 'Reseña no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.exception(f"Error en admin_deactivate_review: {e}")
        return Response({'error': 'Error al desactivar la reseña'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)