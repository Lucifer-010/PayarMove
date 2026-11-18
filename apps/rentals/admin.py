from django.contrib import admin
from .models import Vehicle, Rental, SavedVehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        'make_model',
        'category',
        'registration_number',
        'host',
        'location',
        'seats',
        'rating',
        'trips_count',
        'daily_rate_usdc',
        'hourly_rate_usdc',
        'deposit_amount_usdc',
        'is_active',
        'created_at',
    )
    list_filter = ('category', 'is_active', 'location', 'transmission', 'fuel_type', 'created_at')
    search_fields = ('make_model', 'registration_number', 'location', 'host__email', 'host__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SavedVehicle)
class SavedVehicleAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__email', 'vehicle__make_model')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Rental)
class RentalAdmin(admin.ModelAdmin):
    list_display = (
        'rental_code',
        'vehicle',
        'renter',
        'host',
        'start_date',
        'end_date',
        'total_due_usdc',
        'status',
        'created_at',
    )
    list_filter = ('status', 'start_date', 'end_date', 'created_at')
    search_fields = (
        'rental_code',
        'vehicle__make_model',
        'renter__email',
        'host__email',
    )
    readonly_fields = ('rental_code', 'total_days', 'rental_amount_usdc', 'deposit_amount_usdc', 'total_due_usdc', 'created_at', 'updated_at')


# ============================================================================
# PayarMove MVP 2: Property & Rental Schedule Admin
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
    StellarReconciliationCursor,
)


class RentalUnitInline(admin.TabularInline):
    model = RentalUnit
    extra = 1


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('name', 'property_type', 'city', 'country', 'landlord', 'receiving_wallet', 'is_active', 'created_at')
    list_filter = ('property_type', 'is_active', 'city', 'country')
    search_fields = ('name', 'address', 'city', 'landlord__email', 'receiving_wallet')
    inlines = [RentalUnitInline]


@admin.register(RentalUnit)
class RentalUnitAdmin(admin.ModelAdmin):
    list_display = ('property', 'unit_number', 'bedrooms', 'rent_amount_usdc', 'is_occupied', 'current_tenant')
    list_filter = ('is_occupied', 'property')
    search_fields = ('unit_number', 'property__name', 'current_tenant__email')


@admin.register(TenantAssignment)
class TenantAssignmentAdmin(admin.ModelAdmin):
    list_display = ('assignment_code', 'property', 'unit', 'tenant', 'landlord', 'rent_amount_usdc', 'payment_frequency', 'status')
    list_filter = ('status', 'payment_frequency', 'property')
    search_fields = ('assignment_code', 'tenant__email', 'landlord__email', 'property__name')


@admin.register(RentalSchedule)
class RentalScheduleAdmin(admin.ModelAdmin):
    list_display = ('schedule_code', 'property', 'tenant', 'rent_amount_usdc', 'frequency', 'first_payment_date', 'is_active')
    list_filter = ('frequency', 'is_active')
    search_fields = ('schedule_code', 'tenant__email', 'landlord__email', 'property__name')


@admin.register(RentObligation)
class RentObligationAdmin(admin.ModelAdmin):
    list_display = (
        'obligation_reference', 'tenant', 'property', 'due_date',
        'amount_due_usdc', 'amount_paid_usdc', 'outstanding_balance_usdc',
        'status', 'payment_memo'
    )
    list_filter = ('status', 'due_date', 'property')
    search_fields = ('obligation_reference', 'payment_memo', 'tenant__email', 'receiving_wallet')


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ('request_reference', 'obligation', 'tenant', 'amount_requested', 'status', 'payment_memo', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('request_reference', 'payment_memo', 'tenant__email')


@admin.register(RentPayment)
class RentPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'payment_reference', 'obligation', 'tenant', 'amount',
        'reconciliation_status', 'stellar_tx_hash', 'stellar_op_id',
        'created_at'
    )
    list_filter = ('reconciliation_status', 'asset_code', 'created_at')
    search_fields = ('payment_reference', 'stellar_tx_hash', 'stellar_op_id', 'memo', 'tenant__email')


@admin.register(RentReceipt)
class RentReceiptAdmin(admin.ModelAdmin):
    list_display = (
        'receipt_number', 'tenant', 'property_name', 'rental_period',
        'amount_paid', 'outstanding_balance_after', 'verification_status',
        'payment_date'
    )
    list_filter = ('verification_status', 'payment_date')
    search_fields = ('receipt_number', 'stellar_tx_hash', 'tenant__email', 'property_name')


@admin.register(StellarReconciliationCursor)
class StellarReconciliationCursorAdmin(admin.ModelAdmin):
    list_display = ('wallet_address', 'last_paging_token', 'last_polled_at')
