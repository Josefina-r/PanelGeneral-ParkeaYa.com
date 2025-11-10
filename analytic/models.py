from django.db import models
from django.contrib.auth import get_user_model
from parking.models import ParkingLot
from reservations.models import Reservation

User = get_user_model()

class PlatformAnalytics(models.Model):
    date = models.DateField(unique=True)
    total_users = models.IntegerField(default=0)
    new_users = models.IntegerField(default=0)
    total_parkings = models.IntegerField(default=0)
    active_parkings = models.IntegerField(default=0)
    total_reservations = models.IntegerField(default=0)
    completed_reservations = models.IntegerField(default=0)
    total_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = "Platform Analytics"
        verbose_name_plural = "Platform Analytics"

class UserActivity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=100)  
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict)
    
    class Meta:
        verbose_name = "User Activity"
        verbose_name_plural = "User Activities"

class RevenueReport(models.Model):
    REPORT_PERIOD_CHOICES = [
        ('daily', 'Diario'),
        ('weekly', 'Semanal'),
        ('monthly', 'Mensual'),
        ('yearly', 'Anual'),
    ]
    
    period = models.CharField(max_length=10, choices=REPORT_PERIOD_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    total_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    owner_payouts = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Revenue Report"
        verbose_name_plural = "Revenue Reports"