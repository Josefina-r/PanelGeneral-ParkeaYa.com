# payments/serializers.py
from rest_framework import serializers
from .models import Payment, PaymentHistory
from reservations.serializers import ReservationDetailSerializer

class PaymentHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentHistory
        fields = ['estado_anterior', 'estado_nuevo', 'mensaje', 'fecha_creacion', 'datos_adicionales']

class PaymentSerializer(serializers.ModelSerializer):
    reserva = ReservationDetailSerializer(read_only=True)
    referencia_pago = serializers.CharField(read_only=True)
    history = PaymentHistorySerializer(many=True, read_only=True)
    
    # Campos calculados
    puede_reembolsar = serializers.BooleanField(read_only=True)
    qr_yape = serializers.SerializerMethodField()
    qr_plin = serializers.SerializerMethodField()
    telefono_yape = serializers.SerializerMethodField()
    telefono_plin = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'referencia_pago', 'reserva', 'usuario', 'monto', 'moneda',
            'metodo', 'estado', 'comision_plataforma', 'monto_propietario',
            'fecha_creacion', 'fecha_pago', 'fecha_reembolso', 'intentos',
            'puede_reembolsar', 'qr_yape', 'qr_plin', 'telefono_yape', 'telefono_plin', 'history'
        ]
        read_only_fields = [
            'id', 'referencia_pago', 'usuario', 'comision_plataforma', 
            'monto_propietario', 'fecha_creacion', 'fecha_pago', 'fecha_reembolso',
            'intentos', 'history'
        ]

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
        
        payment = Payment.objects.create(
            reserva=validated_data['reserva'],
            metodo=validated_data['metodo'],
            usuario=request.user,
            monto=validated_data['reserva'].costo_estimado
        )
        
        # Procesar pago inmediato para tarjeta
        if payment.metodo == 'tarjeta' and token_pago:
            payment.procesar_pago(token_pago)
        elif payment.metodo in ['yape', 'plin']:
            
            from .tasks import verificar_pago_pendiente
            verificar_pago_pendiente.apply_async(
                args=[payment.id], 
                countdown=300  
            )
        
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