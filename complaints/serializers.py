from rest_framework import serializers
from .models import Complaint

class ComplaintSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    parking_name = serializers.CharField(source='parking.nombre', read_only=True)

    class Meta:
        model = Complaint
        fields = '__all__'
