from django.contrib import admin
from .models import ParkingLot

@admin.register(ParkingLot)
class ParkingLotAdmin(admin.ModelAdmin):
    list_display = ('nombre','direccion','tarifa_hora','total_plazas','plazas_disponibles','nivel_seguridad')
    search_fields = ('nombre','direccion')
    list_filter = ('nivel_seguridad',)
