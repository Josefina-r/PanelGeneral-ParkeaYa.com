# payments/views.py - ACTUALIZADO
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Count, Case, When, DecimalField
from datetime import timedelta

from .models import Payment
from .serializers import PaymentSerializer, CreatePaymentSerializer, RefundPaymentSerializer, OwnerValidatePaymentSerializer
from .permissions import IsAdminOrOwnerOrReadOnly, IsAdminOrOwner  # NUEVO

class PaymentViewSet(viewsets.ModelViewSet):
    # PERMISOS ACTUALIZADOS
    permission_classes = [IsAdminOrOwnerOrReadOnly]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'rol', None) == 'admin':
            return Payment.objects.all().select_related('reserva', 'usuario', 'reserva__estacionamiento')
        elif getattr(user, 'rol', None) == 'owner':
            # Dueños ven pagos de sus estacionamientos
            return Payment.objects.filter(
                reserva__estacionamiento__owner=user
            ).select_related('reserva', 'usuario', 'reserva__estacionamiento')
        # Clientes ven solo sus pagos
        return Payment.objects.filter(usuario=user).select_related('reserva', 'reserva__estacionamiento')

    def get_serializer_class(self):
        if self.action == 'create':
            return CreatePaymentSerializer
        elif self.action == 'refund':
            return RefundPaymentSerializer
        elif self.action == 'owner_validate':  # ✅ Nueva acción
            return OwnerValidatePaymentSerializer
        return PaymentSerializer

    # Nuevo helper: obtener instancia de reserva y asegurar atributo 'notes'
    def _get_and_ensure_reservation(self, serializer_or_payment):
        """
        Intenta obtener la instancia de reserva desde:
        - serializer.validated_data['reserva'] (si existe)
        - serializer.initial_data['reserva'] (pk), cargando desde DB
        - payment.reserva (si se le pasa un payment)
        Asegura que la instancia tenga atributo 'notes' (fallback '')
        """
        reserva = None
        # Si se pasó un payment
        if hasattr(serializer_or_payment, 'reserva'):
            reserva = serializer_or_payment.reserva
        else:
            # serializer
            serializer = serializer_or_payment
            reserva = serializer.validated_data.get('reserva') if hasattr(serializer, 'validated_data') else None
            if not reserva:
                reserva_pk = getattr(serializer, 'initial_data', {}).get('reserva')
                if reserva_pk:
                    try:
                        ReservaModel = Payment._meta.get_field('reserva').related_model
                        reserva = ReservaModel.objects.get(pk=reserva_pk)
                    except Exception:
                        reserva = None

        if reserva is not None and not hasattr(reserva, 'notes'):
            # agregar atributo dinámicamente para evitar AttributeError en save/procesamientos
            setattr(reserva, 'notes', '')

        return reserva

    def perform_create(self, serializer):
        """Sobrescribir para manejar la creación con transaction.atomic y evitar AttributeError por 'notes' faltante"""
        with transaction.atomic():
            # Asegurar que la reserva tenga 'notes' antes de save para evitar AttributeError en señales/métodos del modelo
            try:
                self._get_and_ensure_reservation(serializer)
                payment = serializer.save(usuario=self.request.user)  # Asegurar usuario
                
            except AttributeError as e:
                # Manejo específico para el caso reportado: falta 'notes' en Reservation
                if "has no attribute 'notes'" in str(e):
                    # Intentar obtener la reserva y reintentar
                    self._get_and_ensure_reservation(serializer)
                    payment = serializer.save(usuario=self.request.user)
                else:
                    # volver a lanzar si es otra AttributeError
                    raise

            # Para Yape/Plin, el pago queda pendiente hasta confirmación
            if payment.metodo in ['yape', 'plin']:
                payment.estado = 'pendiente'
                payment.save()
                
                # Programar verificación periódica
                #from .tasks import verificar_pago_pendiente
                #verificar_pago_pendiente.apply_async(
                  #  args=[payment.id], 
                   # countdown=300  # 5 minutos
                #)
                
            return payment

    # ACCIONES PÚBLICAS (para todos los usuarios autenticados)
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Procesar pago pendiente (para Yape/Plin manual)"""
        payment = self.get_object()
        
        # Verificar que el usuario tenga permisos sobre este pago
        if payment.usuario != request.user and not (
            request.user.is_staff or 
            getattr(request.user, 'rol', None) in ['admin', 'owner'] and
            payment.reserva.estacionamiento.owner == request.user
        ):
            return Response(
                {'detail': 'No tiene permisos para procesar este pago.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if payment.estado != 'pendiente':
            return Response(
                {'detail': 'El pago ya ha sido procesado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Asegurar que la reserva vinculada al pago tenga 'notes' para evitar AttributeError en procesar_pago()
                try:
                    self._get_and_ensure_reservation(payment)
                except Exception:
                    # no crítico: seguir y dejar que el método interno gestione su propia validación
                    pass

                success = payment.procesar_pago()
                
                if success:
                    return Response(
                        {'detail': 'Pago procesado exitosamente.', 'payment': PaymentSerializer(payment).data},
                        status=status.HTTP_200_OK
                    )
                else:
                    return Response(
                        {'detail': 'Error al procesar el pago.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
        except Exception as e:
            return Response(
                {'detail': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Solicitar reembolso"""
        payment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verificar permisos específicos para reembolso
        user = request.user
        if payment.usuario != user and not (
            user.is_staff or 
            getattr(user, 'rol', None) in ['admin', 'owner'] and
            payment.reserva.estacionamiento.owner == user
        ):
            return Response(
                {'detail': 'No tiene permisos para reembolsar este pago.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not payment.puede_reembolsar:
            return Response(
                {'detail': 'Este pago no puede ser reembolsado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # asegurar reserva antes de reembolsar por si el reembolso accede a 'notes'
                try:
                    self._get_and_ensure_reservation(payment)
                except Exception:
                    pass

                monto_parcial = serializer.validated_data.get('monto_parcial')
                success = payment.reembolsar(monto_parcial)
                
                if success:
                    return Response(
                        {'detail': 'Reembolso procesado exitosamente.'},
                        status=status.HTTP_200_OK
                    )
                else:
                    return Response(
                        {'detail': 'Error al procesar el reembolso.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
        except Exception as e:
            return Response(
                {'detail': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ACCIONES PARA CLIENTES
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Obtener pagos pendientes del usuario (solo cliente)"""
        payments = self.get_queryset().filter(
            usuario=request.user,
            estado='pendiente'
        )
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    # ACCIONES PARA OWNERS
    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrOwner])
    def by_parking(self, request, parking_id=None):
        """Obtener pagos por estacionamiento (solo admin y owners)"""
        payments = self.get_queryset().filter(
            reserva__estacionamiento_id=parking_id
        )
        
        # Filtros
        estado = request.GET.get('estado')
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        
        if estado:
            payments = payments.filter(estado=estado)
        if fecha_desde:
            payments = payments.filter(fecha_creacion__date__gte=fecha_desde)
        if fecha_hasta:
            payments = payments.filter(fecha_creacion__date__lte=fecha_hasta)
            
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    # ACCIONES SOLO PARA ADMIN
    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrOwner], url_path='transactions/stats')
    def admin_stats(self, request):
        """Obtener estadísticas de pagos para admin"""
        # Obtener período
        now = timezone.now()
        last_month = now - timedelta(days=30)

        # Estadísticas generales
        stats = {
            'total_pagos': Payment.objects.filter(estado='pagado').count(),
            'monto_total': Payment.objects.filter(estado='pagado').aggregate(
                total=Sum('monto', output_field=DecimalField())
            )['total'] or 0,
            'comisiones_total': Payment.objects.filter(estado='pagado').aggregate(
                total=Sum('comision_plataforma', output_field=DecimalField())
            )['total'] or 0
        }

        # Estadísticas último mes
        monthly_stats = {
            'pagos_mes': Payment.objects.filter(
                estado='pagado',
                fecha_pago__gte=last_month
            ).count(),
            'monto_mes': Payment.objects.filter(
                estado='pagado',
                fecha_pago__gte=last_month
            ).aggregate(
                total=Sum('monto', output_field=DecimalField())
            )['total'] or 0,
            'comisiones_mes': Payment.objects.filter(
                estado='pagado',
                fecha_pago__gte=last_month
            ).aggregate(
                total=Sum('comision_plataforma', output_field=DecimalField())
            )['total'] or 0
        }

        # Métodos de pago
        metodos_pago = Payment.objects.filter(estado='pagado').values('metodo').annotate(
            count=Count('id'),
            total=Sum('monto', output_field=DecimalField())
        )

        return Response({
            'stats': stats,
            'monthly_stats': monthly_stats,
            'metodos_pago': metodos_pago
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrOwner], url_path='transactions')
    def admin_transactions(self, request):
        """Obtener lista de transacciones para admin"""
        # Filtros
        estado = request.GET.get('estado')
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        metodo = request.GET.get('metodo')
        
        # Aplicar filtros
        transactions = self.get_queryset()
        
        if estado:
            transactions = transactions.filter(estado=estado)
        if fecha_desde:
            transactions = transactions.filter(fecha_creacion__date__gte=fecha_desde)
        if fecha_hasta:
            transactions = transactions.filter(fecha_creacion__date__lte=fecha_hasta)
        if metodo:
            transactions = transactions.filter(metodo=metodo)
            
        # Ordenar por fecha de creación, más recientes primero
        transactions = transactions.order_by('-fecha_creacion')
        
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)

    # ACCIONES ESPECÍFICAS PARA OWNER
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrOwner])
    def owner_validate(self, request):
        """Endpoint específico para que owners validen pagos manualmente"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        payment = serializer.save()
        
        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED
        )