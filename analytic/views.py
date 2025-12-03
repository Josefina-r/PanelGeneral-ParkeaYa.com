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
    parking_ids = ParkingLot.objects.filter(dueno=owner).values_list('id', flat=True)
    daily_data = []
    current_date = start_date
    
    while current_date <= end_date:
        daily_reservations = Reservation.objects.filter(
            estacionamiento__in=parking_ids,
            created_at__date=current_date
        ).count()
        
        daily_revenue = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date=current_date,
            estado='pagado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        daily_earnings = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date=current_date,
            estado='pagado'
        ).aggregate(total=Sum('monto_propietario'))['total'] or 0
        
        daily_data.append({
            'date': current_date.isoformat(),
            'reservations': daily_reservations,
            'revenue': float(daily_revenue),
            'revenue_currency': 'PEN',
            'earnings': float(daily_earnings),
            'earnings_currency': 'PEN'
        })
        current_date += timedelta(days=1)
    
    return daily_data

def get_owner_daily_revenue(owner, days=30):
    return get_owner_daily_analytics(owner, days)

def get_owner_weekly_revenue(owner, weeks=12):
    weekly_data = []
    end_date = timezone.now().date()
    parking_ids = ParkingLot.objects.filter(dueno=owner).values_list('id', flat=True)
    
    for i in range(weeks):
        week_start = end_date - timedelta(weeks=i+1)
        week_end = end_date - timedelta(weeks=i)
        
        weekly_revenue = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date__range=[week_start, week_end],
            estado='pagado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        weekly_earnings = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date__range=[week_start, week_end],
            estado='pagado'
        ).aggregate(total=Sum('monto_propietario'))['total'] or 0
        
        weekly_data.append({
            'week': f"Semana {weeks - i}",
            'revenue': float(weekly_revenue),
            'revenue_currency': 'PEN',
            'earnings': float(weekly_earnings),
            'earnings_currency': 'PEN',
            'start_date': week_start.isoformat(),
            'end_date': week_end.isoformat()
        })
    
    return list(reversed(weekly_data))

def get_owner_monthly_revenue(owner, months=12):
    monthly_data = []
    today = timezone.now().date()
    parking_ids = ParkingLot.objects.filter(dueno=owner).values_list('id', flat=True)
    
    for i in range(months):
        month = today.replace(day=1) - timedelta(days=30*i)
        month_start = month.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)
        
        monthly_revenue = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date__range=[month_start, month_end],
            estado='pagado'
        ).aggregate(total=Sum('monto'))['total'] or 0
        
        monthly_earnings = Payment.objects.filter(
            reserva__estacionamiento__in=parking_ids,
            fecha_creacion__date__range=[month_start, month_end],
            estado='pagado'
        ).aggregate(total=Sum('monto_propietario'))['total'] or 0
        
        monthly_data.append({
            'month': month_start.strftime('%Y-%m'),
            'revenue': float(monthly_revenue),
            'revenue_currency': 'PEN',
            'earnings': float(monthly_earnings),
            'earnings_currency': 'PEN',
            'month_name': month_start.strftime('%B %Y')
        })
    
    return list(reversed(monthly_data))

def get_parking_detailed_performance(parking):
    reservations = parking.reservations.all() if hasattr(parking, 'reservations') else []
    payments = Payment.objects.filter(reserva__estacionamiento=parking, estado='pagado')
    
    total_earnings = payments.aggregate(total=Sum('monto_propietario'))['total'] or 0
    total_reservations = reservations.count()
    completed_reservations = reservations.filter(estado='finalizada').count()
    avg_rating = reservations.aggregate(avg=Avg('rating'))['avg'] or 0
    
    return {
        'parking_info': {
            'id': parking.id,
            'nombre': parking.nombre,
            'direccion': parking.direccion,
            'activo': parking.activo
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
        last_month = today - timedelta(days=30)
        
        # Estadísticas de usuarios
        total_users = User.objects.count()
        total_owners = User.objects.filter(rol='owner').count()
        total_clients = User.objects.filter(rol='client').count()
        new_users = User.objects.filter(created_at__date__gte=last_month).count() if hasattr(User.objects.first(), 'created_at') else 0
        active_users = User.objects.filter(last_login__date__gte=last_month).count() if User.objects.filter(last_login__isnull=False).exists() else total_users
        
        # Estadísticas de estacionamientos
        total_parkings = ParkingLot.objects.count()
        active_parkings = ParkingLot.objects.filter(activo=True).count()
        
        # Estadísticas de reservas
        total_reservations = Reservation.objects.count()
        active_reservations = Reservation.objects.filter(estado='activa').count()
        completed_today = Reservation.objects.filter(estado='finalizada', created_at__date=today).count()
        
        # Estadísticas de pagos
        total_revenue = Payment.objects.filter(estado='pagado').aggregate(total=Sum('monto'))['total'] or 0
        platform_earnings = Payment.objects.filter(estado='pagado').aggregate(total=Sum('comision_plataforma'))['total'] or 0
        
        # Calcular crecimiento
        users_last_month = User.objects.filter(created_at__date__lt=last_month).count() if hasattr(User.objects.first(), 'created_at') else total_users - new_users
        user_growth = calculate_growth(total_users, users_last_month) if users_last_month > 0 else 0
        
        previous_month_revenue = Payment.objects.filter(
            estado='pagado',
            fecha_creacion__date__lt=last_month
        ).aggregate(total=Sum('monto'))['total'] or 0
        revenue_growth = calculate_growth(float(total_revenue), float(previous_month_revenue)) if float(previous_month_revenue) > 0 else 0
        
        # Top parkings
        top_parkings_list = ParkingLot.objects.annotate(
            reservations_count=Count('reservations'),
            total_earnings=Sum('reservations__payment__monto_propietario', 
                             filter=Q(reservations__payment__estado='pagado'))
        ).order_by('-total_earnings')[:5]
        
        top_parkings = []
        for parking in top_parkings_list:
            top_parkings.append({
                'id': parking.id,
                'nombre': parking.nombre,
                'propietario': parking.dueno.get_full_name() if parking.dueno else 'Sin propietario',
                'reservations_count': parking.reservations_count or 0,
                'total_earnings': float(parking.total_earnings or 0)
            })
        
        # Datos de gráfico de reservas últimos 7 días
        reservations_chart = []
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            count = Reservation.objects.filter(created_at__date=date).count()
            reservations_chart.append({
                'date': date.isoformat(),
                'count': count
            })
        
        # Tasa de ocupación promedio
        occupancy_rate = min(100, round((active_reservations / max(1, total_reservations) * 100)) if total_reservations > 0 else 0)
        
        response_data = {
            'total_users': total_users,
            'total_owners': total_owners,
            'total_clients': total_clients,
            'new_users': new_users,
            'active_users': active_users,
            'user_growth': user_growth,
            'total_parkings': total_parkings,
            'active_parkings': active_parkings,
            'total_reservations': total_reservations,
            'active_reservations': active_reservations,
            'completed_today': completed_today,
            'total_revenue': float(total_revenue),
            'revenue_currency': 'PEN',
            'platform_earnings': float(platform_earnings),
            'earnings_currency': 'PEN',
            'revenue_growth': revenue_growth,
            'commission_rate': 30,
            'top_parkings': top_parkings,
            'reservations_chart': reservations_chart,
            'occupancy_rate': occupancy_rate
        }
        return Response(response_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def revenue_analytics(request):
    period = request.GET.get('period', 'monthly')
    try:
        today = timezone.now().date()
        
        if period == 'daily':
            data = get_owner_daily_revenue(request.user, 30) if hasattr(request.user, 'parkings') else []
        elif period == 'weekly':
            data = get_owner_weekly_revenue(request.user, 12) if hasattr(request.user, 'parkings') else []
        elif period == 'monthly':
            data = get_owner_monthly_revenue(request.user, 12) if hasattr(request.user, 'parkings') else []
        else:
            data = get_owner_daily_revenue(request.user, 30) if hasattr(request.user, 'parkings') else []
        
        # Calcular totales generales de la plataforma
        total_revenue = Payment.objects.filter(estado='pagado').aggregate(total=Sum('monto'))['total'] or 0
        platform_earnings = Payment.objects.filter(estado='pagado').aggregate(total=Sum('comision_plataforma'))['total'] or 0
        owner_payouts = Payment.objects.filter(estado='pagado').aggregate(total=Sum('monto_propietario'))['total'] or 0
        
        # Gráfico de ingresos últimos 7 días
        revenue_chart = []
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            amount = Payment.objects.filter(
                estado='pagado',
                fecha_creacion__date=date
            ).aggregate(total=Sum('monto'))['total'] or 0
            revenue_chart.append({
                'date': date.isoformat(),
                'amount': float(amount),
                'currency': 'PEN'
            })
            
        return Response({
            'revenue_data': data,
            'period': period,
            'total_revenue': float(total_revenue),
            'revenue_currency': 'PEN',
            'platform_earnings': float(platform_earnings),
            'earnings_currency': 'PEN',
            'owner_payouts': float(owner_payouts),
            'payouts_currency': 'PEN',
            'revenue_chart': revenue_chart
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_analytics(request):
    try:
        from users.models import User
        today = timezone.now().date()
        last_month = today - timedelta(days=30)
        
        rol_distribution = User.objects.values('rol').annotate(count=Count('id'))
        active_users = User.objects.filter(last_login__date__gte=last_month).count() if User.objects.filter(last_login__isnull=False).exists() else User.objects.count()
        total_users = User.objects.count()
        new_users = User.objects.filter(created_at__date__gte=last_month).count() if hasattr(User.objects.first(), 'created_at') else 0
        total_owners = User.objects.filter(rol='owner').count()
        total_clients = User.objects.filter(rol='client').count()
        
        # Gráfico de crecimiento de usuarios últimos 7 días
        users_chart = []
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            try:
                count = User.objects.filter(created_at__date=date).count()
            except:
                count = 0
            users_chart.append({
                'date': date.isoformat(),
                'count': count
            })
        
        response_data = {
            'rol_distribution': list(rol_distribution),
            'active_users': active_users,
            'total_users': total_users,
            'new_users': new_users,
            'total_owners': total_owners,
            'total_clients': total_clients,
            'users_chart': users_chart
        }
        return Response(response_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)

# VISTAS PARA OWNER
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwner])
def owner_analytics_dashboard(request):
    try:
        user = request.user
        today = timezone.now().date()
        user_parkings = ParkingLot.objects.filter(dueno=user)
        parking_ids = user_parkings.values_list('id', flat=True)
        
        total_parkings = user_parkings.count()
        active_parkings = user_parkings.filter(activo=True).count()
        
        owner_reservations = Reservation.objects.filter(estacionamiento__in=parking_ids)
        total_reservations = owner_reservations.count()
        active_reservations = owner_reservations.filter(estado='activa').count()
        completed_today = owner_reservations.filter(estado='finalizada', created_at__date=today).count()
        
        owner_payments = Payment.objects.filter(reserva__estacionamiento__in=parking_ids, estado='pagado')
        total_revenue = owner_payments.aggregate(total=Sum('monto'))['total'] or 0
        today_revenue = owner_payments.filter(fecha_creacion__date=today).aggregate(total=Sum('monto'))['total'] or 0
        total_earnings = owner_payments.aggregate(total=Sum('monto_propietario'))['total'] or 0
        
        parking_performance = user_parkings.annotate(
            reservation_count=Count('reservations'),
            total_earnings=Sum('reservations__payment__monto_propietario')
        ).order_by('-total_earnings')[:5]
        
        performance_data = []
        for parking in parking_performance:
            # Calcular tasa de ocupación basada en reservas
            reservations_count = Reservation.objects.filter(estacionamiento=parking).count()
            total_capacity = parking.total_plazas if hasattr(parking, 'total_plazas') else 1
            occupancy_rate = (reservations_count / max(1, total_capacity)) * 100 if total_capacity > 0 else 0
            
            performance_data.append({
                'id': parking.id,
                'nombre': parking.nombre,
                'reservations': parking.reservation_count or 0,
                'earnings': float(parking.total_earnings or 0),
                'occupancy_rate': float(occupancy_rate)
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
                'revenue_currency': 'PEN',
                'today_revenue': float(today_revenue),
                'today_currency': 'PEN',
                'total_earnings': float(total_earnings),
                'earnings_currency': 'PEN'
            },
            'parking_performance': performance_data,
            'chart_data': daily_data,
            'timeframe': 'last_30_days'
        }
        return Response(response_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
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
        user_parkings = ParkingLot.objects.filter(dueno=user)
        
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
        parking_ids = ParkingLot.objects.filter(dueno=user).values_list('id', flat=True)
        reservations = Reservation.objects.filter(estacionamiento__in=parking_ids)
        
        status_stats = reservations.values('estado').annotate(
            count=Count('id'),
            total_revenue=Sum('payment__monto')
        )
        
        # Calcular horas pico
        popular_hours = reservations.values('hora_entrada__hour').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        response_data = {
            'status_distribution': list(status_stats),
            'average_rating': 0,
            'popular_hours': list(popular_hours),
            'total_reservations': reservations.count()
        }
        return Response(response_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)