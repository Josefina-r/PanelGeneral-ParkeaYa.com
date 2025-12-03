from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id','reserva','monto','metodo','estado','fecha_pago')
    list_filter = ('metodo','estado')
