# payments/serializers.py
from rest_framework import serializers
from .models import Payment, PaymentHistory
from reservations.models import Reservation
# from reservations.serializers import ReservationDetailSerializer  # ❌ COMENTAR ESTA LÍNEA

class PaymentHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentHistory
        fields = ['estado_anterior', 'estado_nuevo', 'mensaje', 'fecha_creacion', 'datos_adicionales']

class PaymentSerializer(serializers.ModelSerializer):
    reserva = serializers.PrimaryKeyRelatedField(read_only=True)
    usuario = serializers.StringRelatedField(read_only=True)
    referencia_pago = serializers.CharField(read_only=True)
    history = PaymentHistorySerializer(many=True, read_only=True)
    
    # ✅ AGREGAR: Información básica de la reserva sin dependencia circular
    reserva_info = serializers.SerializerMethodField()
    
    # Campos calculados
    puede_reembolsar = serializers.BooleanField(read_only=True)
    qr_yape = serializers.SerializerMethodField()
    qr_plin = serializers.SerializerMethodField()
    telefono_yape = serializers.SerializerMethodField()
    telefono_plin = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'referencia_pago', 'reserva', 'reserva_info', 'usuario', 'monto', 'moneda',
            'metodo', 'estado', 'comision_plataforma', 'monto_propietario',
            'fecha_creacion', 'fecha_pago', 'fecha_reembolso', 'intentos',
            'puede_reembolsar', 'qr_yape', 'qr_plin', 'telefono_yape', 'telefono_plin', 'history'
        ]
        read_only_fields = [
            'id', 'referencia_pago', 'usuario', 'comision_plataforma', 
            'monto_propietario', 'fecha_creacion', 'fecha_pago', 'fecha_reembolso',
            'intentos', 'history'
        ]

    def get_reserva_info(self, obj):
        """Obtener información básica de la reserva sin dependencia circular"""
        try:
            reserva = obj.reserva
            return {
                'id': reserva.id,
                'codigo_reserva': reserva.codigo_reserva,
                'estado': reserva.estado,
                'costo_estimado': str(reserva.costo_estimado),
                'hora_entrada': reserva.hora_entrada,
                'hora_salida': reserva.hora_salida
            }
        except Reservation.DoesNotExist:
            return None

    def get_qr_yape(self, obj):
        """Genera datos para QR de Yape"""
        if obj.metodo == 'yape' and obj.estado == 'pendiente':
            return f"yape://payment?phone=999888777&amount={obj.monto}&note=Reserva{obj.reserva.codigo_reserva}"
        return None

    def get_qr_plin(self, obj):
        """Genera datos para QR de Plin"""
        if obj.metodo == 'plin' and obj.estado == 'pendiente':
            return f"plin://payment?phone=999777666&amount={obj.monto}&note=Reserva{obj.reserva.codigo_reserva}"
        return None

    def get_telefono_yape(self, obj):
        """Retorna teléfono Yape para transferencia"""
        if obj.metodo == 'yape' and obj.estado == 'pendiente':
            return "999888777"
        return None

    def get_telefono_plin(self, obj):
        """Retorna teléfono Plin para transferencia"""
        if obj.metodo == 'plin' and obj.estado == 'pendiente':
            return "999777666"
        return None

    def validate(self, attrs):
        if self.instance and self.instance.estado in ['pagado', 'reembolsado']:
            raise serializers.ValidationError("No se puede modificar un pago completado o reembolsado")
        return attrs


class CreatePaymentSerializer(serializers.ModelSerializer):
    reserva = serializers.PrimaryKeyRelatedField(
        queryset=Reservation.objects.all()
    )
   
    token_pago = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Payment
        fields = ['reserva', 'metodo', 'token_pago']
        read_only_fields = ['monto', 'moneda', 'usuario']

    def validate_reserva(self, value):
        """Valida que la reserva sea válida para pago"""
        if hasattr(value, 'payment'):
            raise serializers.ValidationError("Esta reserva ya tiene un pago asociado")
        
        if value.estado != 'activa':
            raise serializers.ValidationError("Solo se pueden pagar reservas activas")
        
        # Verificar que el costo estimado esté definido
        if not value.costo_estimado or value.costo_estimado <= 0:
            raise serializers.ValidationError("La reserva no tiene un costo válido")
        
        return value

    def validate(self, attrs):
        
        metodo = attrs.get('metodo')
        token_pago = attrs.get('token_pago')

        # Para tarjeta, se requiere token
        if metodo == 'tarjeta' and not token_pago:
            raise serializers.ValidationError({
                'token_pago': 'Se requiere token de pago para tarjeta'
            })

        # Para Yape/Plin
        if metodo in ['yape', 'plin'] and token_pago:
            raise serializers.ValidationError({
                'token_pago': 'No se requiere token para Yape/Plin'
            })

        return attrs

    def create(self, validated_data):
        token_pago = validated_data.pop('token_pago', None)
        request = self.context.get('request')
        
        # Obtener la reserva
        reserva = validated_data['reserva']
        
        # Crear el pago
        payment = Payment.objects.create(
            reserva=reserva,
            metodo=validated_data['metodo'],
            usuario=request.user,
            monto=reserva.costo_estimado
        )
        
        # ✅ ACTUALIZAR LA RESERVA CON LA INFORMACIÓN DEL PAGO
        reserva.estado = 'confirmada'  # o el estado que uses para reservas pagadas
        reserva.save()
        
        # Procesar pago inmediato para tarjeta
        if payment.metodo == 'tarjeta' and token_pago:
            payment.procesar_pago(token_pago)
        elif payment.metodo in ['yape', 'plin']:
            # from .tasks import verificar_pago_pendiente
            # verificar_pago_pendiente.apply_async(
            #     args=[payment.id], 
            #     countdown=300  
            # )
            print(f"✅ Pago {payment.id} creado - Método: {payment.metodo}")
            print(f"💰 Monto: {payment.monto} - Reserva: {payment.reserva.id}")
            print(f"📊 Estado reserva actualizado: {reserva.estado}")
        
        return payment


class RefundPaymentSerializer(serializers.Serializer):
    # Serializer para reembolsos
    monto_parcial = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, min_value=0.01
    )
    motivo = serializers.CharField(max_length=255, required=False)

    def validate_monto_parcial(self, value):
        if value and value <= 0:
            raise serializers.ValidationError("El monto debe ser mayor a 0")
        return value

class OwnerValidatePaymentSerializer(serializers.ModelSerializer):
    """Serializer específico para validación manual del owner"""
    reserva = serializers.IntegerField(write_only=True)
    monto = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)
    estado = serializers.CharField(default='pagado')
    moneda = serializers.CharField(default='PEN')
    metodo = serializers.CharField(default='manual')
    referencia_pago = serializers.CharField(default='validado_por_owner')
    
    class Meta:
        model = Payment
        fields = ['reserva', 'monto', 'estado', 'moneda', 'metodo', 'referencia_pago']
    
    def validate(self, attrs):
        reserva_id = attrs.get('reserva')
        
        try:
            reserva = Reservation.objects.get(id=reserva_id)
            attrs['reserva_instance'] = reserva
            
            # Si no se especifica monto, usar el de la reserva
            if not attrs.get('monto'):
                attrs['monto'] = reserva.costo_estimado or 0
                
        except Reservation.DoesNotExist:
            raise serializers.ValidationError({'reserva': 'Reserva no encontrada'})
            
        return attrs
    
    def create(self, validated_data):
        request = self.context.get('request')
        reserva = validated_data.pop('reserva_instance')
        
        # Verificar si ya existe un pago para esta reserva
        existing_payment = Payment.objects.filter(reserva=reserva).first()
        
        if existing_payment:
            # Actualizar el pago existente
            existing_payment.estado = validated_data.get('estado', 'pagado')
            existing_payment.monto = validated_data.get('monto', existing_payment.monto)
            existing_payment.metodo = validated_data.get('metodo', 'manual')
            existing_payment.referencia_pago = validated_data.get('referencia_pago', 'validado_por_owner')
            existing_payment.save()
            return existing_payment
        
        # Crear nuevo pago
        payment = Payment.objects.create(
            reserva=reserva,
            usuario=reserva.usuario,  # Usar usuario de la reserva, no el owner
            monto=validated_data.get('monto', reserva.costo_estimado or 0),
            moneda=validated_data.get('moneda', 'PEN'),
            metodo=validated_data.get('metodo', 'manual'),
            estado=validated_data.get('estado', 'pagado'),
            referencia_pago=validated_data.get('referencia_pago', 'validado_por_owner')
        )
        
        return payment