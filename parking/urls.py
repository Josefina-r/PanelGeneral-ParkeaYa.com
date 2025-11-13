from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ParkingLotViewSet, 
    ParkingReviewViewSet, 
    ParkingApprovalViewSet,
    admin_approved_parkings,
    admin_dashboard_data,
    admin_pending_parkings,
    owner_dashboard_data,
    dashboard_data,
    dashboard_stats,
    recent_reservations
)

# Router principal para parking
router = DefaultRouter()
router.register(r'parkings', ParkingLotViewSet, basename='parking')
router.register(r'reviews', ParkingReviewViewSet, basename='review')

# Router para approval requests
approval_router = DefaultRouter()
approval_router.register(r'requests', ParkingApprovalViewSet, basename='approval-request')

urlpatterns = [
    # Dashboard endpoints
    path('dashboard/', dashboard_data, name='dashboard_data'),
    path('dashboard/admin/', admin_dashboard_data, name='admin_dashboard_data'),
    path('dashboard/owner/', owner_dashboard_data, name='owner_dashboard_data'),
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    path('dashboard/recent-reservations/', recent_reservations, name='recent_reservations'),
    
    # Approval management
    path('approval/', include(approval_router.urls)),
    
    # Main parking endpoints
    path('', include(router.urls)),
    
      # Nuevos endpoints para admin
    path('admin/pending-parkings/', admin_pending_parkings, name='pending-parkings'),
    path('admin/approved-parkings/', admin_approved_parkings, name='approved-parkings'),
    
    # Endpoints de acciones
    path('parkings/<int:pk>/approve/', ParkingLotViewSet.as_view({'post': 'approve'}), name='parking-approve'),
    path('parkings/<int:pk>/reject/', ParkingLotViewSet.as_view({'post': 'reject'}), name='parking-reject'),

    # Endpoints específicos para owners
    path('my-parkings/', ParkingLotViewSet.as_view({'get': 'mis_estacionamientos'}), name='my-parkings'),
]