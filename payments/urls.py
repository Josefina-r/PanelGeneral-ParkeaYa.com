# payments/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet

router = DefaultRouter()
# Registramos el PaymentViewSet en la raíz del include.
# Como en `parkeaya/urls.py` este archivo se incluye con:
#   path('api/payments/', include('payments.urls'))
# Queremos que las URLs queden como /api/payments/..., por eso
# usamos el prefijo vacío aquí.
router.register(r'', PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
]