# notifications/admin.py
from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'rol', 'type', 'read', 'created_at']
    list_filter = ['rol', 'type', 'read', 'created_at']
    search_fields = ['title', 'message', 'user__username']
    readonly_fields = ['created_at']
    actions = ['mark_as_read', 'mark_as_unread']
    
    def mark_as_read(self, request, queryset):
        updated = queryset.update(read=True)
        self.message_user(request, f'{updated} notificaciones marcadas como leídas.')
    mark_as_read.short_description = "Marcar como leídas"
    
    def mark_as_unread(self, request, queryset):
        updated = queryset.update(read=False)
        self.message_user(request, f'{updated} notificaciones marcadas como no leídas.')
    mark_as_unread.short_description = "Marcar como no leídas"