from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers
from .models import Vehicle, Rental, SavedVehicle
from apps.authentication.serializers import UserProfileSerializer

class QuantizedDecimalField(serializers.DecimalField):
    """
    Tolerates float representations, exponential notation, and numbers with > decimal_places,
    quantizing to the allowed decimal_places without throwing max_decimal_places ValidationError.
    """
    def to_internal_value(self, data):
        if data is not None and data != '':
            try:
                d = Decimal(str(data).strip())
                quantizer = Decimal('10') ** -self.decimal_places
                data = format(d.quantize(quantizer, rounding=ROUND_HALF_UP), 'f')
            except Exception:
                pass
        return super().to_internal_value(data)

class VehicleSerializer(serializers.ModelSerializer):
    host_email = serializers.EmailField(source='host.email', read_only=True)
    host_name = serializers.SerializerMethodField()
    host_stellar_address = serializers.CharField(source='host.primary_stellar_address', read_only=True)
    is_saved = serializers.SerializerMethodField()
    daily_rate_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    hourly_rate_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    deposit_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)

    class Meta:
        model = Vehicle
        fields = [
            'id', 'host_email', 'host_name', 'host_stellar_address', 'make_model',
            'registration_number', 'location', 'category', 'year',
            'seats', 'doors', 'transmission', 'fuel_type',
            'rating', 'reviews_count', 'trips_count',
            'daily_rate_usdc', 'hourly_rate_usdc', 'deposit_amount_usdc',
            'pickup_instructions', 'image_url', 'images', 'features', 'rules',
            'is_active', 'is_saved', 'created_at'
        ]
        read_only_fields = ['id', 'host_email', 'host_name', 'host_stellar_address', 'is_saved', 'created_at']

    def get_host_name(self, obj):
        if obj.host:
            return obj.host.first_name or obj.host.username or obj.host.email.split('@')[0]
        return 'Verified Host'

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.favorited_by.filter(user=request.user).exists()
        return False


class SavedVehicleSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(read_only=True)
    vehicle_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = SavedVehicle
        fields = ['id', 'vehicle', 'vehicle_id', 'created_at']
        read_only_fields = ['id', 'vehicle', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        vehicle_id = validated_data['vehicle_id']
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
        except Vehicle.DoesNotExist:
            raise serializers.ValidationError({'vehicle_id': 'Vehicle not found.'})
        
        saved, _ = SavedVehicle.objects.get_or_create(user=user, vehicle=vehicle)
        return saved


class RentalCreateSerializer(serializers.ModelSerializer):
    start_time = serializers.CharField(max_length=10, required=False, allow_blank=True, default='09:00')
    end_time = serializers.CharField(max_length=10, required=False, allow_blank=True, default='11:00')
    total_hours = QuantizedDecimalField(max_digits=8, decimal_places=2, required=False)
    rental_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    deposit_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    total_due_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)

    class Meta:
        model = Rental
        fields = [
            'id', 'vehicle', 'start_date', 'end_date',
            'start_time', 'end_time', 'total_hours',
            'rental_amount_usdc', 'deposit_amount_usdc', 'total_due_usdc'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if end_date < start_date:
            raise serializers.ValidationError('End date cannot be earlier than start date.')
        
        vehicle = attrs.get('vehicle')
        if not vehicle.is_active:
            raise serializers.ValidationError('Selected vehicle is currently not available.')
        return attrs

    def create(self, validated_data):
        renter = self.context['request'].user
        vehicle = validated_data['vehicle']
        rental = Rental.objects.create(
            renter=renter,
            host=vehicle.host,
            status=Rental.Status.AWAITING_PAYMENT,
            **validated_data
        )
        return rental


class RentalDetailSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(read_only=True)
    renter = UserProfileSerializer(read_only=True)
    host = UserProfileSerializer(read_only=True)

    class Meta:
        model = Rental
        fields = [
            'id', 'rental_code', 'vehicle', 'renter', 'host',
            'start_date', 'end_date', 'start_time', 'end_time',
            'total_days', 'total_hours',
            'rental_amount_usdc', 'deposit_amount_usdc', 'total_due_usdc',
            'status', 'created_at', 'updated_at'
        ]


# ============================================================================
# PayarMove MVP 2: Property & Rental Schedule Management Serializers
# ============================================================================

from .models import (
    Property,
    RentalUnit,
    TenantAssignment,
    RentalSchedule,
    RentObligation,
    PaymentRequest,
    RentPayment,
    RentReceipt,
)


class RentalUnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    tenant_email = serializers.EmailField(source='current_tenant.email', read_only=True, allow_null=True)
    rent_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    deposit_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    # Aliases for frontend flexibility
    monthly_rent_usdc = serializers.DecimalField(source='rent_amount_usdc', max_digits=18, decimal_places=7, read_only=True)
    security_deposit_usdc = serializers.DecimalField(source='deposit_amount_usdc', max_digits=18, decimal_places=7, read_only=True)

    class Meta:
        model = RentalUnit
        fields = [
            'id', 'property', 'property_name', 'unit_number', 'floor',
            'bedrooms', 'bathrooms', 'square_feet', 'rent_amount_usdc',
            'deposit_amount_usdc', 'monthly_rent_usdc', 'security_deposit_usdc',
            'is_occupied', 'current_tenant',
            'tenant_email', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'property_name', 'tenant_email', 'monthly_rent_usdc',
            'security_deposit_usdc', 'created_at', 'updated_at'
        ]


class PropertySerializer(serializers.ModelSerializer):
    landlord_email = serializers.EmailField(source='landlord.email', read_only=True)
    landlord_name = serializers.SerializerMethodField()
    units = RentalUnitSerializer(many=True, read_only=True)
    total_units_count = serializers.SerializerMethodField()
    occupied_units_count = serializers.SerializerMethodField()
    active_tenants_count = serializers.SerializerMethodField()
    min_rent_usdc = serializers.SerializerMethodField()
    max_rent_usdc = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            'id', 'landlord', 'landlord_email', 'landlord_name',
            'name', 'property_type', 'address', 'city', 'state_province',
            'postal_code', 'country', 'description', 'receiving_wallet',
            'default_asset_code', 'default_asset_issuer', 'image_url', 'images',
            'is_active', 'units', 'total_units_count', 'occupied_units_count',
            'active_tenants_count', 'min_rent_usdc', 'max_rent_usdc', 'price_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'landlord', 'landlord_email', 'landlord_name',
            'total_units_count', 'occupied_units_count', 'active_tenants_count',
            'min_rent_usdc', 'max_rent_usdc', 'price_display',
            'created_at', 'updated_at'
        ]

    def get_landlord_name(self, obj):
        if obj.landlord:
            return obj.landlord.first_name or obj.landlord.username or obj.landlord.email.split('@')[0]
        return 'Property Manager'

    def get_total_units_count(self, obj):
        return obj.units.count()

    def get_occupied_units_count(self, obj):
        return obj.units.filter(is_occupied=True).count()

    def get_active_tenants_count(self, obj):
        return obj.assignments.filter(status=TenantAssignment.Status.ACTIVE).count()

    def get_min_rent_usdc(self, obj):
        units = obj.units.all()
        if not units.exists():
            return None
        min_val = min(u.rent_amount_usdc for u in units)
        return str(min_val)

    def get_max_rent_usdc(self, obj):
        units = obj.units.all()
        if not units.exists():
            return None
        max_val = max(u.rent_amount_usdc for u in units)
        return str(max_val)

    def get_price_display(self, obj):
        units = obj.units.all()
        if not units.exists():
            return None
        rents = [u.rent_amount_usdc for u in units]
        min_r = min(rents)
        max_r = max(rents)
        if min_r == max_r:
            return f"${min_r:,.2f}".rstrip('0').rstrip('.')
        return f"From ${min_r:,.2f}".rstrip('0').rstrip('.')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        wallet = instance.owner_wallet
        data['receiving_wallet'] = wallet
        data['owner_wallet'] = wallet
        return data


class TenantAssignmentSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True, allow_null=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    tenant_name = serializers.SerializerMethodField()
    landlord_email = serializers.EmailField(source='landlord.email', read_only=True)
    rent_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7)
    deposit_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)

    class Meta:
        model = TenantAssignment
        fields = [
            'id', 'assignment_code', 'property', 'property_name',
            'unit', 'unit_number', 'landlord', 'landlord_email',
            'tenant', 'tenant_email', 'tenant_name',
            'rent_amount_usdc', 'deposit_amount_usdc', 'payment_frequency',
            'billing_day_of_month', 'start_date', 'end_date',
            'receiving_wallet', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'assignment_code', 'property_name', 'unit_number',
            'tenant_email', 'tenant_name', 'landlord_email',
            'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'landlord': {'required': False},
            'tenant': {'required': False},
            'receiving_wallet': {'required': False},
            'start_date': {'required': False},
        }

    def get_tenant_name(self, obj):
        if obj.tenant:
            return obj.tenant.first_name or obj.tenant.username or obj.tenant.email.split('@')[0]
        return 'Tenant'


class RentalScheduleSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True, allow_null=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    landlord_email = serializers.EmailField(source='landlord.email', read_only=True)
    rent_amount_usdc = QuantizedDecimalField(max_digits=18, decimal_places=7, required=False)
    obligations_count = serializers.SerializerMethodField()

    class Meta:
        model = RentalSchedule
        fields = [
            'id', 'schedule_code', 'assignment', 'property', 'property_name',
            'unit', 'unit_number', 'landlord', 'landlord_email',
            'tenant', 'tenant_email', 'rent_amount_usdc', 'asset_code',
            'asset_issuer', 'frequency', 'first_payment_date',
            'start_date', 'end_date', 'receiving_wallet', 'is_active',
            'obligations_count', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'schedule_code', 'property', 'property_name',
            'unit', 'unit_number', 'landlord', 'landlord_email',
            'tenant', 'tenant_email', 'obligations_count',
            'created_at', 'updated_at'
        ]

    def get_obligations_count(self, obj):
        return obj.obligations.count()


class RentObligationSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True, allow_null=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    tenant_name = serializers.SerializerMethodField()
    landlord_email = serializers.EmailField(source='landlord.email', read_only=True)
    rental_period_display = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_fully_paid = serializers.BooleanField(read_only=True)
    payment_progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = RentObligation
        fields = [
            'id', 'obligation_reference', 'schedule', 'assignment',
            'property', 'property_name', 'unit', 'unit_number',
            'landlord', 'landlord_email', 'tenant', 'tenant_email', 'tenant_name',
            'period_start_date', 'period_end_date', 'due_date',
            'amount_due_usdc', 'amount_paid_usdc', 'outstanding_balance_usdc',
            'asset_code', 'asset_issuer', 'receiving_wallet', 'payment_memo',
            'status', 'is_overdue', 'is_fully_paid', 'rental_period_display',
            'payment_progress_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'obligation_reference', 'payment_memo',
            'property_name', 'unit_number', 'tenant_email', 'tenant_name',
            'landlord_email', 'rental_period_display', 'is_overdue',
            'is_fully_paid', 'payment_progress_percentage', 'created_at', 'updated_at'
        ]

    def get_tenant_name(self, obj):
        if obj.tenant:
            return obj.tenant.first_name or obj.tenant.username or obj.tenant.email.split('@')[0]
        return 'Tenant'

    def get_payment_progress_percentage(self, obj):
        if not obj.amount_due_usdc or obj.amount_due_usdc <= Decimal('0'):
            return 100.0
        pct = (obj.amount_paid_usdc / obj.amount_due_usdc) * Decimal('100.0')
        return float(min(Decimal('100.0'), pct).quantize(Decimal('0.01')))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        wallet = instance.owner_receiving_wallet
        data['receiving_wallet'] = wallet
        data['owner_wallet'] = wallet
        return data


class PaymentRequestSerializer(serializers.ModelSerializer):
    obligation_reference = serializers.CharField(source='obligation.obligation_reference', read_only=True)
    property_name = serializers.CharField(source='obligation.property.name', read_only=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    stellar_uri = serializers.CharField(read_only=True)
    amount_requested = QuantizedDecimalField(max_digits=18, decimal_places=7)

    class Meta:
        model = PaymentRequest
        fields = [
            'id', 'request_reference', 'obligation', 'obligation_reference',
            'property_name', 'tenant', 'tenant_email',
            'amount_requested', 'asset_code', 'asset_issuer',
            'receiving_wallet', 'payment_memo', 'memo_type',
            'status', 'stellar_uri', 'expires_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'request_reference', 'obligation_reference',
            'property_name', 'tenant_email', 'receiving_wallet',
            'payment_memo', 'memo_type', 'stellar_uri', 'created_at'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.obligation:
            wallet = instance.obligation.owner_receiving_wallet
            data['receiving_wallet'] = wallet
            data['owner_wallet'] = wallet
        return data


class RentPaymentSerializer(serializers.ModelSerializer):
    obligation_reference = serializers.CharField(source='obligation.obligation_reference', read_only=True, allow_null=True)
    property_name = serializers.CharField(source='obligation.property.name', read_only=True, allow_null=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True, allow_null=True)
    stellar_explorer_url = serializers.CharField(read_only=True)
    receipt_number = serializers.CharField(source='receipt.receipt_number', read_only=True, allow_null=True)
    receipt_id = serializers.UUIDField(source='receipt.id', read_only=True, allow_null=True)

    class Meta:
        model = RentPayment
        fields = [
            'id', 'payment_reference', 'obligation', 'obligation_reference',
            'property_name', 'payment_request', 'tenant', 'tenant_email',
            'payer_stellar_address', 'receiving_stellar_address',
            'amount', 'asset_code', 'asset_issuer',
            'stellar_tx_hash', 'stellar_op_id', 'ledger_sequence',
            'ledger_closed_at', 'memo', 'reconciliation_status',
            'balance_after_payment', 'review_notes', 'stellar_explorer_url',
            'receipt_number', 'receipt_id', 'created_at'
        ]
        read_only_fields = fields


class RentReceiptSerializer(serializers.ModelSerializer):
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    obligation_reference = serializers.CharField(source='obligation.obligation_reference', read_only=True)
    payment_reference = serializers.CharField(source='payment.payment_reference', read_only=True)
    download_url = serializers.SerializerMethodField()
    amount_paid_usdc = serializers.DecimalField(source='amount_paid', max_digits=18, decimal_places=7, read_only=True)
    outstanding_balance_after_payment_usdc = serializers.DecimalField(source='outstanding_balance_after', max_digits=18, decimal_places=7, read_only=True)
    billing_period = serializers.CharField(source='rental_period', read_only=True)
    receipt_reference = serializers.CharField(source='receipt_number', read_only=True)
    stellar_transaction_hash = serializers.CharField(source='stellar_tx_hash', read_only=True)

    class Meta:
        model = RentReceipt
        fields = [
            'id', 'receipt_number', 'receipt_reference', 'payment', 'payment_reference',
            'obligation', 'obligation_reference', 'tenant', 'tenant_email',
            'property_name', 'unit_number', 'rental_period', 'billing_period',
            'amount_paid', 'amount_paid_usdc', 'asset_code', 'payment_date',
            'stellar_tx_hash', 'stellar_transaction_hash', 'stellar_op_id',
            'outstanding_balance_after', 'outstanding_balance_after_payment_usdc',
            'verification_status', 'stellar_explorer_url', 'download_url',
            'notes', 'created_at'
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        request = self.context.get('request')
        relative = f"/api/v1/rentals/receipts/{obj.id}/download/"
        return request.build_absolute_uri(relative) if request else relative


class TransactionVerificationRequestSerializer(serializers.Serializer):
    """
    Input serializer to trigger immediate on-demand Stellar transaction
    verification and reconciliation.
    """
    tx_hash = serializers.CharField(max_length=64, min_length=64, help_text="64-character Stellar transaction hash")
    obligation_reference = serializers.CharField(required=False, allow_blank=True, help_text="Optional obligation reference code (e.g. OBL-2026-...)")


class RentCalculatorSerializer(serializers.Serializer):
    """
    Interactive Rent Payment Calculator serializer matching section 5 of project_mvp2.txt.
    """
    rent_due = QuantizedDecimalField(max_digits=18, decimal_places=7, default=Decimal('300.00'))
    already_paid = QuantizedDecimalField(max_digits=18, decimal_places=7, default=Decimal('100.00'))
    new_payment = QuantizedDecimalField(max_digits=18, decimal_places=7, default=Decimal('50.00'))
    due_date = serializers.DateField(required=False)
    reference_date = serializers.DateField(required=False)
