from rest_framework import serializers

class AdminDashboardSerializer(serializers.Serializer):
    total_volume_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    confirmed_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    pending_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    total_host_payouts_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    owed_to_hosts_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    platform_fees_collected_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    total_users_count = serializers.IntegerField()
    verified_hosts_count = serializers.IntegerField()
    active_rentals_count = serializers.IntegerField()
    fleet_vehicles_count = serializers.IntegerField()
    pending_kyc_count = serializers.IntegerField()
    awaiting_payment_count = serializers.IntegerField()
    completed_rentals_count = serializers.IntegerField()


class HostDashboardSerializer(serializers.Serializer):
    total_earned_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    pending_payout_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    vehicles_listed_count = serializers.IntegerField()
    active_bookings_count = serializers.IntegerField()
    completed_bookings_count = serializers.IntegerField()


class LandlordCollectionItemSerializer(serializers.Serializer):
    tenant_id = serializers.UUIDField()
    tenant_email = serializers.EmailField()
    tenant_name = serializers.CharField()
    property_name = serializers.CharField()
    unit_number = serializers.CharField(allow_blank=True)
    obligation_reference = serializers.CharField()
    due_date = serializers.DateField()
    amount_due_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    amount_paid_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    outstanding_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    status = serializers.CharField()
    is_overdue = serializers.BooleanField()


class LandlordDashboardSerializer(serializers.Serializer):
    rent_due_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    rent_collected_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    outstanding_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    active_tenants = serializers.IntegerField()
    managed_properties_count = serializers.IntegerField()
    total_units_count = serializers.IntegerField()
    occupied_units_count = serializers.IntegerField()
    overdue_obligations_count = serializers.IntegerField()
    rental_collection_overview = LandlordCollectionItemSerializer(many=True)
    recent_payments = serializers.ListField(child=serializers.DictField())
    reconciliation_summary = serializers.DictField()


class TenantDashboardSerializer(serializers.Serializer):
    outstanding_rent_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    monthly_rent_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    amount_paid_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    remaining_balance_usdc = serializers.DecimalField(max_digits=18, decimal_places=7)
    payment_status = serializers.CharField()
    current_obligation = serializers.DictField(allow_null=True)
    upcoming_obligations = serializers.ListField(child=serializers.DictField())
    payment_schedule = serializers.ListField(child=serializers.DictField())
    recent_payments = serializers.ListField(child=serializers.DictField())
    downloadable_receipts = serializers.ListField(child=serializers.DictField())
