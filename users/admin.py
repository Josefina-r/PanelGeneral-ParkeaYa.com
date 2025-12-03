from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, Car

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (*DjangoUserAdmin.fieldsets, ('Extra', {'fields': ('telefono','rol','activo')}))
    list_display = ('username','email','rol','is_staff','activo','fecha_registro')
    list_filter = ('rol','activo','is_staff')

@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ('placa','usuario','modelo','tipo','created_at')
    search_fields = ('placa','usuario__username')
