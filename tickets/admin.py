from django.contrib import admin
from .models import Ticket

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('reserva','estado','fecha_emision','fecha_validacion')
    search_fields = ('reserva__codigo_reserva','reserva__usuario__username')
