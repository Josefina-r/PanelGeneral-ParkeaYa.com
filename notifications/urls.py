# notifications/urls.py
from django.urls import path, include
from rest_framework import routers
from . import views

router = routers.DefaultRouter()
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'admin/notifications', views.AdminNotificationViewSet, basename='admin-notification')
router.register(r'owner/notifications', views.OwnerNotificationViewSet, basename='owner-notification')

urlpatterns = [
    path('', include(router.urls)),
]