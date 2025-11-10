"""
URL configuration for parkeaya project.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Importar las vistas para el router principal
from users.views import AdminUserViewSet, OwnerUserViewSet, ClientUserViewSet, CarViewSet
from parking.views import ParkingLotViewSet
from reservations.views import ReservationViewSet
from payments.views import PaymentViewSet
from tickets.views import TicketViewSet, TicketValidationAPIView
from users import views

# Router principal 
router = routers.DefaultRouter()
router.register(r'users/admin', AdminUserViewSet, basename='admin-user')
router.register(r'users/owner', OwnerUserViewSet, basename='owner-user')
router.register(r'users/client', ClientUserViewSet, basename='client-user')
router.register(r'cars', CarViewSet, basename='car')
router.register(r'parking', ParkingLotViewSet, basename='parking')
router.register(r'reservations', ReservationViewSet, basename='reservation')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'tickets', TicketViewSet, basename='ticket')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    
    # Users app - TODAS las URLs de users
    path('api/users/', include('users.urls')),
    
    # Parking app - TODAS las URLs de parking  
    path('api/parking/', include('parking.urls')),
    
    # Reservations app - TODAS las URLs de reservations
    path('api/reservations/', include('reservations.urls')),
    
    # Payments app - URLs específicas
    path('api/payments/', include('payments.urls')),

    path('api/analytics/', include('analytic.urls')),

    path('api/', include(router.urls)),
    
    
    # JWT endpoints globales
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Autenticación de cuenta (legacy)
    path("auth/", include("dj_rest_auth.urls")),
    
    
    # Ticket-specific extra endpoints
    path('api/tickets/validate/', TicketValidationAPIView.as_view(), name='validate-ticket'),
    path('api/tickets/parking/<int:parking_id>/', 
         TicketViewSet.as_view({'get': 'by_parking'}), 
         name='tickets-by-parking'),
    
    
    # Complaints app
    path('api/complaints/', include('complaints.urls')),
    
    # Legacy endpoints que pueden estar en uso
    path('api/dashboard/stats/', include('parking.urls')),  
    path('api/dashboard/recent-reservations/', include('reservations.urls')),  
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair_legacy'),  
]