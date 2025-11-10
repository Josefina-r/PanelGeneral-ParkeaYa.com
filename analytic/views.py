from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, Avg
from django.utils import timezone
from datetime import timedelta
from .permissions import IsOwner
from parking.models import ParkingLot
from reservations.models import Reservation
from payments.models import Payment

def calculate_growth(current, previous):
    if previous == 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100, 2)

def get_owner_daily_analytics(owner, days=30):
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=days)
    parking_ids = ParkingLot.objects.filter(owner=owner).values_list('id', flat=True)
    daily_data = []
    current_date = start_date
    
    while current_date <= end_date:
        daily_reservations = Reservation.objects.filter(
            parking_lot__in=parking_ids,
            created_at__date=current_date
        ).count()
        
        daily_revenue = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date=current_date,
            status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        daily_earnings = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date=current_date,
            status='completed'
        ).aggregate(total=Sum('owner_earnings'))['total'] or 0
        
        daily_data.append({
            'date': current_date.isoformat(),
            'reservations': daily_reservations,
            'revenue': float(daily_revenue),
            'earnings': float(daily_earnings)
        })
        current_date += timedelta(days=1)
    
    return daily_data

def get_owner_daily_revenue(owner, days=30):
    return get_owner_daily_analytics(owner, days)

def get_owner_weekly_revenue(owner, weeks=12):
    weekly_data = []
    end_date = timezone.now().date()
    parking_ids = ParkingLot.objects.filter(owner=owner).values_list('id', flat=True)
    
    for i in range(weeks):
        week_start = end_date - timedelta(weeks=i+1)
        week_end = end_date - timedelta(weeks=i)
        
        weekly_revenue = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date__range=[week_start, week_end],
            status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        weekly_earnings = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date__range=[week_start, week_end],
            status='completed'
        ).aggregate(total=Sum('owner_earnings'))['total'] or 0
        
        weekly_data.append({
            'week': f"Semana {weeks - i}",
            'revenue': float(weekly_revenue),
            'earnings': float(weekly_earnings),
            'start_date': week_start.isoformat(),
            'end_date': week_end.isoformat()
        })
    
    return list(reversed(weekly_data))

def get_owner_monthly_revenue(owner, months=12):
    monthly_data = []
    today = timezone.now().date()
    parking_ids = ParkingLot.objects.filter(owner=owner).values_list('id', flat=True)
    
    for i in range(months):
        month = today.replace(day=1) - timedelta(days=30*i)
        month_start = month.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)
        
        monthly_revenue = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date__range=[month_start, month_end],
            status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        monthly_earnings = Payment.objects.filter(
            reservation__parking_lot__in=parking_ids,
            created_at__date__range=[month_start, month_end],
            status='completed'
        ).aggregate(total=Sum('owner_earnings'))['total'] or 0
        
        monthly_data.append({
            'month': month_start.strftime('%Y-%m'),
            'revenue': float(monthly_revenue),
            'earnings': float(monthly_earnings),
            'month_name': month_start.strftime('%B %Y')
        })
    
    return list(reversed(monthly_data))

def get_parking_detailed_performance(parking):
    reservations = parking.reservations.all()
    payments = Payment.objects.filter(reservation__parking_lot=parking, status='completed')
    
    total_earnings = payments.aggregate(total=Sum('owner_earnings'))['total'] or 0
    total_reservations = reservations.count()
    completed_reservations = reservations.filter(status='completed').count()
    avg_rating = reservations.aggregate(avg=Avg('rating'))['avg'] or 0
    
    return {
        'parking_info': {
            'id': parking.id,
            'name': parking.name,
            'address': parking.address,
            'status': parking.status
        },
        'performance': {
            'total_earnings': float(total_earnings),
            'total_reservations': total_reservations,
            'completed_reservations': completed_reservations,
            'completion_rate': round((completed_reservations / total_reservations * 100) if total_reservations > 0 else 0, 2),
            'average_rating': round(avg_rating, 2)
        }
    }

def get_all_parkings_performance(parkings):
    performance_data = []
    for parking in parkings:
        performance = get_parking_detailed_performance(parking)
        performance_data.append(performance)
    return performance_data

# VISTAS PARA ADMIN
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_analytics_dashboard(request):
    try:
        from users.models import User
        today = timezone.now().date()
        
        total_users = User.objects.count()
        total_owners = User.objects.filter(role='owner').count()
        total_parkings = ParkingLot.objects.count()
        active_parkings = ParkingLot.objects.filter(status='active').count()
        total_reservations = Reservation.objects.count()
        active_reservations = Reservation.objects.filter(status='active').count()
        
        total_revenue = Payment.objects.filter(status='completed').aggregate(total=Sum('amount'))['total'] or 0
        platform_earnings = Payment.objects.filter(status='completed').aggregate(total=Sum('platform_fee'))['total'] or 0
        
        response_data = {
            'platform_stats': {
                'total_users': total_users,
                'total_owners': total_owners,
                'total_parkings': total_parkings,
                'active_parkings': active_parkings,
                'total_reservations': total_reservations,
                'active_reservations': active_reservations,
                'total_revenue': float(total_revenue),
                'platform_earnings': float(platform_earnings),
            }
        }
        return Response(response_data)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def revenue_analytics(request):
    period = request.GET.get('period', 'monthly')
    try:
        if period == 'daily':
            data = get_owner_daily_revenue(request.user, 30)
        elif period == 'weekly':
            data = get_owner_weekly_revenue(request.user, 12)
        elif period == 'monthly':
            data = get_owner_monthly_revenue(request.user, 12)
        else:
            data = get_owner_daily_revenue(request.user, 30)
            
        return Response({'revenue_data': data, 'period': period})
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_analytics(request):
    try:
        from users.models import User
        role_distribution = User.objects.values('role').annotate(count=Count('id'))
        active_users = User.objects.filter(last_login__date__gte=timezone.now().date() - timedelta(days=30)).count()
        
        response_data = {
            'role_distribution': list(role_distribution),
            'active_users': active_users,
            'total_users': User.objects.count()
        }
        return Response(response_data)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

# VISTAS PARA OWNER
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwner])
def owner_analytics_dashboard(request):
    try:
        user = request.user
        today = timezone.now().date()
        user_parkings = ParkingLot.objects.filter(owner=user)
        parking_ids = user_parkings.values_list('id', flat=True)
        
        total_parkings = user_parkings.count()
        active_parkings = user_parkings.filter(status='active').count()
        
        owner_reservations = Reservation.objects.filter(parking_lot__in=parking_ids)
        total_reservations = owner_reservations.count()
        active_reservations = owner_reservations.filter(status='active').count()
        completed_today = owner_reservations.filter(status='completed', created_at__date=today).count()
        
        owner_payments = Payment.objects.filter(reservation__parking_lot__in=parking_ids, status='completed')
        total_revenue = owner_payments.aggregate(total=Sum('amount'))['total'] or 0
        today_revenue = owner_payments.filter(created_at__date=today).aggregate(total=Sum('amount'))['total'] or 0
        total_earnings = owner_payments.aggregate(total=Sum('owner_earnings'))['total'] or 0
        
        parking_performance = user_parkings.annotate(
            reservation_count=Count('reservations'),
            total_earnings=Sum('reservations__payment__owner_earnings')
        ).order_by('-total_earnings')[:5]
        
        performance_data = []
        for parking in parking_performance:
            avg_rating = Reservation.objects.filter(parking_lot=parking).aggregate(avg=Avg('rating'))['avg'] or 0
            performance_data.append({
                'id': parking.id,
                'name': parking.name,
                'reservations': parking.reservation_count or 0,
                'earnings': float(parking.total_earnings or 0),
                'occupancy_rate': float(avg_rating * 20)
            })
        
        daily_data = get_owner_daily_analytics(user, 30)
        
        response_data = {
            'owner_stats': {
                'total_parkings': total_parkings,
                'active_parkings': active_parkings,
                'total_reservations': total_reservations,
                'active_reservations': active_reservations,
                'completed_today': completed_today,
                'total_revenue': float(total_revenue),
                'today_revenue': float(today_revenue),
                'total_earnings': float(total_earnings),
            },
            'parking_performance': performance_data,
            'chart_data': daily_data,
            'timeframe': 'last_30_days'
        }
        return Response(response_data)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwner])
def owner_revenue_analytics(request):
    period = request.GET.get('period', 'monthly')
    try:
        user = request.user
        if period == 'daily':
            data = get_owner_daily_revenue(user, 30)
        elif period == 'weekly':
            data = get_owner_weekly_revenue(user, 12)
        elif period == 'monthly':
            data = get_owner_monthly_revenue(user, 12)
        else:
            data = get_owner_daily_revenue(user, 30)
            
        return Response({'revenue_data': data, 'period': period})
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwner])
def owner_parking_performance(request, parking_id=None):
    try:
        user = request.user
        user_parkings = ParkingLot.objects.filter(owner=user)
        
        if parking_id:
            parking = user_parkings.get(id=parking_id)
            performance_data = get_parking_detailed_performance(parking)
        else:
            performance_data = get_all_parkings_performance(user_parkings)
        
        return Response(performance_data)
    except ParkingLot.DoesNotExist:
        return Response({'error': 'Parking no encontrado'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwner])
def owner_reservation_analytics(request):
    try:
        user = request.user
        parking_ids = ParkingLot.objects.filter(owner=user).values_list('id', flat=True)
        reservations = Reservation.objects.filter(parking_lot__in=parking_ids)
        
        status_stats = reservations.values('status').annotate(
            count=Count('id'),
            total_revenue=Sum('payment__amount')
        )
        
        avg_rating = reservations.aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0
        
        popular_hours = reservations.values('start_time__hour').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        response_data = {
            'status_distribution': list(status_stats),
            'average_rating': round(avg_rating, 2),
            'popular_hours': list(popular_hours),
            'total_reservations': reservations.count()
        }
        return Response(response_data)
    except Exception as e:
        return Response({'error': str(e)}, status=500)