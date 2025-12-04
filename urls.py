from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/terms/', include('terms.urls')),  # <-- añadir esta línea
]