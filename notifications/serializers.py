from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'message', 'source', 
            'icon', 'action_url', 'read', 'created_at', 'time_ago'
        ]
        read_only_fields = ['created_at']
    
    def get_time_ago(self, obj):
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        now = timezone.now()
        if obj.created_at:
            return timesince(obj.created_at, now)
        return "Reciente"

class CreateNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['rol', 'type', 'title', 'message', 'source', 'icon', 'action_url']

class MarkAsReadSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )