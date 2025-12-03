from django.contrib import admin
from .models import Vehicle

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ['id', 'placa', 'marca', 'modelo', 'color', 'usuario', 'activo']
    list_filter = ['marca', 'activo']
    search_fields = ['placa', 'marca', 'modelo', 'usuario__username']
    list_per_page = 20

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('usuario')