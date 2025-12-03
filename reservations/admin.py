from django.contrib import admin
from .models import Reservation

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('codigo_reserva','usuario','vehiculo','estacionamiento','estado','created_at')
    list_filter = ('estado','created_at')
    search_fields = ('codigo_reserva','usuario__username','vehiculo__placa')
