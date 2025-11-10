from django.contrib import admin
from .models import PlatformAnalytics, UserActivity, RevenueReport

@admin.register(PlatformAnalytics)
class PlatformAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['date', 'total_users', 'total_parkings', 'total_revenue']
    list_filter = ['date']

@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'timestamp']
    list_filter = ['timestamp', 'action']

@admin.register(RevenueReport)
class RevenueReportAdmin(admin.ModelAdmin):
    list_display = ['period', 'start_date', 'end_date', 'total_revenue']
    list_filter = ['period', 'start_date']