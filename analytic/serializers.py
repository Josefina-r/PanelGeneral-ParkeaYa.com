from rest_framework import serializers
from .models import PlatformAnalytics, UserActivity, RevenueReport

class PlatformAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformAnalytics
        fields = '__all__'

class UserActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = UserActivity
        fields = ['id', 'user', 'user_name', 'action', 'timestamp', 'metadata']

class RevenueReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = RevenueReport
        fields = '__all__'

class OwnerParkingPerformanceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    reservations = serializers.IntegerField()
    earnings = serializers.DecimalField(max_digits=10, decimal_places=2)
    occupancy_rate = serializers.FloatField()

class DailyAnalyticsSerializer(serializers.Serializer):
    date = serializers.DateField()
    reservations = serializers.IntegerField()
    revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    earnings = serializers.DecimalField(max_digits=10, decimal_places=2)