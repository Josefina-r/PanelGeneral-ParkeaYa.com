from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Registrar el ViewSet en el router con prefijo vacío para que, al incluirse
# en `path('api/reservations/', include(...))` en el archivo principal,
# las rutas queden en `/api/reservations/` (en vez de `/api/reservations/reservations/`).
router.register(r'', views.ReservationViewSet, basename='reservation')

# ----------------------------
# Helpers "lazy" para evitar errores de import al cargar urls
# ----------------------------
def lazy_view(name):
	"""
	Devuelve un callable que importa reservations.views.<name> al primer request.
	Si el objeto tiene as_view() se invoca como CBV; si no, se llama como función.
	"""
	def _callable(request, *args, **kwargs):
		mod = __import__('reservations.views', fromlist=[name])
		attr = getattr(mod, name)
		if hasattr(attr, 'as_view'):
			return attr.as_view()(request, *args, **kwargs)
		return attr(request, *args, **kwargs)
	return _callable

def lazy_viewset_action(mapping):
	"""
	Devuelve un callable que usa ReservationViewSet.as_view(mapping) de forma lazy.
	Mapping ejemplo: {'post': 'cancel'}
	"""
	def _callable(request, *args, **kwargs):
		mod = __import__('reservations.views', fromlist=['ReservationViewSet'])
		vs = getattr(mod, 'ReservationViewSet')
		return vs.as_view(mapping)(request, *args, **kwargs)
	return _callable

urlpatterns = [
    path('', include(router.urls)),
    
    # Endpoints específicos de reservas por rol (usando lazy import)
    path('client/active/', lazy_view('UserActiveReservationsView'), name='user-active-reservations'),
    path('owner/parking/<int:parking_id>/', lazy_view('ParkingReservationsView'), name='parking-reservations'),
    path('stats/', lazy_view('ReservationStatsView'), name='reservation-stats'),
    
    # Endpoints para dashboards (funciones -> lazy también)
    path('dashboard/admin/stats/', lazy_view('admin_reservations_stats'), name='admin-reservations-stats'),
    path('dashboard/owner/stats/', lazy_view('owner_reservations_stats'), name='owner-reservations-stats'),
    
    # Endpoints por código de reserva (APIViews lazy)
    path('<uuid:codigo_reserva>/checkin/', lazy_view('CheckInView'), name='checkin'),
    path('<uuid:codigo_reserva>/checkout/', lazy_view('CheckOutView'), name='checkout'),
    
    # Endpoints de acciones específicas (mapear a métodos del ViewSet) - con wrapper lazy
    path('<uuid:codigo_reserva>/cancel/', 
         lazy_viewset_action({'post': 'cancel'}), 
         name='cancel-reservation'),
    path('<uuid:codigo_reserva>/extend/', 
         lazy_viewset_action({'post': 'extend'}), 
         name='extend-reservation'),
    path('tipos/', 
         lazy_viewset_action({'get': 'tipos_reserva'}), 
         name='reservation-tipos'),
    
    # Endpoints específicos por rol (acciones del ViewSet) - lazy
    path('client/mis-reservas/', 
         lazy_viewset_action({'get': 'mis_reservas'}), 
         name='mis-reservas'),
    path('owner/reservas/', 
         lazy_viewset_action({'get': 'reservas_estacionamiento'}), 
         name='reservas-estacionamiento'),

    # Páginas para WebView móvil (lazy)
    path('mobile/login/', lazy_view('mobile_login_via_token'), name='mobile-login'),
    path('mobile/reservas/', lazy_view('mobile_reservas_page'), name='mobile-reservas'),
    path('mobile/pago/', lazy_view('mobile_pago_page'), name='mobile-pago'),
]