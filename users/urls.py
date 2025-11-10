# users/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MyTokenObtainPairView, RegisterClientView, RegisterOwnerView,
    AdminUserViewSet, OwnerUserViewSet, ClientUserViewSet, CarViewSet,
    admin_panel_login, get_user_profile, check_panel_access,
    admin_dashboard_stats, owner_dashboard_stats, client_dashboard_stats
)
from rest_framework_simplejwt.views import TokenRefreshView

# Router para las vistas de usuarios por rol
router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-user')
router.register(r'owner/profile', OwnerUserViewSet, basename='owner-profile')
router.register(r'client/profile', ClientUserViewSet, basename='client-profile')
router.register(r'cars', CarViewSet, basename='car')

urlpatterns = [
    # Autenticación general
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Registros específicos por rol
    path('auth/register/client/', RegisterClientView.as_view(), name='register-client'),
    path('auth/register/owner/', RegisterOwnerView.as_view(), name='register-owner'),
    
    # Autenticación para panel web
    path('panel/login/', admin_panel_login, name='admin-panel-login'),
    path('profile/', get_user_profile, name='user-profile'),
    path('panel/check-access/', check_panel_access, name='check-panel-access'),
    
    # Dashboards por rol
    path('admin/dashboard/stats/', admin_dashboard_stats, name='admin-dashboard-stats'),
    path('owner/dashboard/stats/', owner_dashboard_stats, name='owner-dashboard-stats'),
    path('client/dashboard/stats/', client_dashboard_stats, name='client-dashboard-stats'),
    
    # Incluir las rutas del router
    path('', include(router.urls)),
]