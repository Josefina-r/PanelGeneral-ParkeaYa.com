from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

# Router para las vistas de usuarios por rol
router = DefaultRouter()
router.register(r'admin/users', views.AdminUserViewSet, basename='admin-user')
router.register(r'owner/profile', views.OwnerUserViewSet, basename='owner-profile')
router.register(r'client/profile', views.ClientUserViewSet, basename='client-profile')
router.register(r'cars', views.CarViewSet, basename='car')

urlpatterns = [
    # Autenticación general
    path('auth/login/', views.MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Registros específicos por rol
    path('auth/register/client/', views.RegisterClientView.as_view(), name='register-client'),
    path('auth/register/owner/', views.RegisterOwnerView.as_view(), name='register-owner'),

    # Autenticación para panel web
    path('panel/login/', views.admin_panel_login, name='admin-panel-login'),
    path('panel/check-access/', views.check_panel_access, name='check-panel-access'),

    # Perfil - GET y UPDATE
    path('profile/', views.get_user_profile, name='user-profile'),
    path('profile/update/', views.update_user_profile, name='user-profile-update'),

    # Dashboards por rol
    path('admin/dashboard/stats/', views.admin_dashboard_stats, name='admin-dashboard-stats'),
    path('owner/dashboard/stats/', views.owner_dashboard_stats, name='owner-dashboard-stats'),
    path('client/dashboard/stats/', views.client_dashboard_stats, name='client-dashboard-stats'),

    # Rutas del router
    path('', include(router.urls)),

    # Cambiar contraseña
    path('profile/change-password/', views.change_password, name='change-own-password'),
    path('change-password/', views.change_password, name='change-password'),
    path('users/change-password/', views.change_password, name='users-change-password'),

    # Ruta de emergencia para resetear contraseña (temporal)
    path('emergency-reset-password/', views.reset_own_password, name='emergency-reset-password'),

    # Rutas de compatibilidad
    path('users/profile/', views.get_user_profile, name='user-profile-compat'),
    path('users/profile/update/', views.update_user_profile, name='user-profile-update-compat'),
    path('users/profile/change-password/', views.change_password, name='user-change-password-compat'),

    # Owner "me" (viewset action)
    path('owner/me/', views.OwnerUserViewSet.as_view({'get': 'me', 'put': 'me'}), name='owner-me'),
]
