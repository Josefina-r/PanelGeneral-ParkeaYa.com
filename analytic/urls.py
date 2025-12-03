from django.urls import path
from . import views

urlpatterns = [
    path('admin/dashboard/', views.admin_analytics_dashboard, name='admin-analytics-dashboard'),
    path('admin/revenue/', views.revenue_analytics, name='revenue-analytics'),
    path('admin/users/', views.user_analytics, name='user-analytics'),
    path('owner/dashboard/', views.owner_analytics_dashboard, name='owner-analytics-dashboard'),
    path('owner/revenue/', views.owner_revenue_analytics, name='owner-revenue-analytics'),
    path('owner/performance/', views.owner_parking_performance, name='owner-parking-performance'),
    path('owner/performance/<int:parking_id>/', views.owner_parking_performance, name='owner-parking-detail'),
    path('owner/reservations/', views.owner_reservation_analytics, name='owner-reservation-analytics'),
]