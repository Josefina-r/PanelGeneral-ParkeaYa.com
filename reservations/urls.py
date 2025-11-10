from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReservationViewSet, 
    CheckInView, 
    CheckOutView, 
    UserActiveReservationsView, 
    ParkingReservationsView,
    ReservationStatsView,
    admin_reservations_stats,
    owner_reservations_stats
)

router = DefaultRouter()
router.register(r'reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('', include(router.urls)),
    
    # Endpoints específicos de reservas por rol
    path('client/active/', UserActiveReservationsView.as_view(), name='user-active-reservations'),
    path('owner/parking/<int:parking_id>/', ParkingReservationsView.as_view(), name='parking-reservations'),
    path('stats/', ReservationStatsView.as_view(), name='reservation-stats'),
    
    # Endpoints para dashboards
    path('dashboard/admin/stats/', admin_reservations_stats, name='admin-reservations-stats'),
    path('dashboard/owner/stats/', owner_reservations_stats, name='owner-reservations-stats'),
    
    # Endpoints por código de reserva
    path('<uuid:codigo_reserva>/checkin/', CheckInView.as_view(), name='checkin'),
    path('<uuid:codigo_reserva>/checkout/', CheckOutView.as_view(), name='checkout'),
    
    # Endpoints de acciones específicas
    path('<uuid:codigo_reserva>/cancel/', 
         ReservationViewSet.as_view({'post': 'cancel'}), 
         name='cancel-reservation'),
    path('<uuid:codigo_reserva>/extend/', 
         ReservationViewSet.as_view({'post': 'extend'}), 
         name='extend-reservation'),
    path('tipos/', 
         ReservationViewSet.as_view({'get': 'tipos_reserva'}), 
         name='reservation-tipos'),
    
    # Endpoints específicos por rol
    path('client/mis-reservas/', 
         ReservationViewSet.as_view({'get': 'mis_reservas'}), 
         name='mis-reservas'),
    path('owner/reservas/', 
         ReservationViewSet.as_view({'get': 'reservas_estacionamiento'}), 
         name='reservas-estacionamiento'),
]