from rest_framework import generics, permissions
from rest_framework.response import Response
from django.db.models import Sum, Q
from decimal import Decimal
from drf_spectacular.utils import extend_schema

from .serializers import (
    AdminDashboardSerializer,
    HostDashboardSerializer,
    LandlordDashboardSerializer,
    TenantDashboardSerializer,
)
from apps.rentals.models import (
    Rental,
    Vehicle,
    Property,
    RentalUnit,
    TenantAssignment,
    RentalSchedule,
    RentObligation,
    RentPayment,
    RentReceipt,
)
from apps.rentals.serializers import RentReceiptSerializer
from apps.payouts.models import HostPayout
from apps.kyc.models import KYCRecord
from apps.authentication.models import User
from apps.core.permissions import IsAdminRole, IsHostRole, IsLandlordRole, IsTenantRole
from django.utils import timezone

class AdminDashboardView(generics.GenericAPIView):
    serializer_class = AdminDashboardSerializer
    permission_classes = [IsAdminRole]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Platform administrative overview metrics',
        description='Returns system-wide payment volume, confirmations, host disbursements, and KYC queue counts.',
        responses={200: AdminDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        # Ensure HostPayout records exist for all confirmed / active / completed rentals
        unrecorded = Rental.objects.filter(
            status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE, Rental.Status.COMPLETED]
        ).exclude(payouts__isnull=False)
        for r in unrecorded:
            p_fee = (r.rental_amount_usdc * Decimal('0.10')).quantize(Decimal('0.0000001'))
            net = (r.rental_amount_usdc - p_fee).quantize(Decimal('0.0000001'))
            HostPayout.objects.get_or_create(
                rental=r,
                defaults={
                    'host': r.host,
                    'gross_rental_usdc': r.rental_amount_usdc,
                    'platform_fee_usdc': p_fee,
                    'net_payout_usdc': net,
                    'status': HostPayout.Status.PENDING
                }
            )

        total_volume = Rental.objects.aggregate(total=Sum('total_due_usdc'))['total'] or Decimal('0.0000000')
        confirmed_vol = Rental.objects.filter(status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE, Rental.Status.COMPLETED]).aggregate(total=Sum('total_due_usdc'))['total'] or Decimal('0.0000000')
        pending_vol = Rental.objects.filter(status=Rental.Status.AWAITING_PAYMENT).aggregate(total=Sum('total_due_usdc'))['total'] or Decimal('0.0000000')

        total_host_payouts = HostPayout.objects.filter(status=HostPayout.Status.COMPLETED).aggregate(total=Sum('net_payout_usdc'))['total'] or Decimal('0.0000000')
        owed_to_hosts = HostPayout.objects.filter(status=HostPayout.Status.PENDING).aggregate(total=Sum('net_payout_usdc'))['total'] or Decimal('0.0000000')
        platform_fees = HostPayout.objects.filter(status=HostPayout.Status.COMPLETED).aggregate(total=Sum('platform_fee_usdc'))['total'] or Decimal('0.0000000')

        data = {
            'total_volume_usdc': total_volume,
            'confirmed_usdc': confirmed_vol,
            'pending_usdc': pending_vol,
            'total_host_payouts_usdc': total_host_payouts,
            'owed_to_hosts_usdc': owed_to_hosts,
            'platform_fees_collected_usdc': platform_fees,
            'total_users_count': User.objects.count(),
            'verified_hosts_count': User.objects.filter(role=User.Role.HOST).count(),
            'active_rentals_count': Rental.objects.filter(status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE]).count(),
            'fleet_vehicles_count': Vehicle.objects.count(),
            'pending_kyc_count': KYCRecord.objects.filter(status=KYCRecord.Status.PENDING).count(),
            'awaiting_payment_count': Rental.objects.filter(status=Rental.Status.AWAITING_PAYMENT).count(),
            'completed_rentals_count': Rental.objects.filter(status=Rental.Status.COMPLETED).count(),
        }
        return Response(data)


class LandlordDashboardView(generics.GenericAPIView):
    """
    Enhanced Landlord Dashboard API (Deliverable 3.A of MVP 2).
    Returns collection overview (rent due, collected, outstanding),
    active tenants count, rental collection breakdown, overdue tracking,
    and payment reconciliation metrics.
    """
    serializer_class = LandlordDashboardSerializer
    permission_classes = [IsHostRole]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Landlord property portfolio & rent collection dashboard',
        description='Returns rent due, collected, outstanding balance, tenant collections, and reconciliation overview.',
        responses={200: LandlordDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        user = request.user
        today = timezone.localdate()

        # If admin, aggregate across platform; otherwise filter to landlord
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            obligations_qs = RentObligation.objects.all()
            properties_qs = Property.objects.all()
            assignments_qs = TenantAssignment.objects.all()
            payments_qs = RentPayment.objects.all()
        else:
            obligations_qs = RentObligation.objects.filter(landlord=user)
            properties_qs = Property.objects.filter(landlord=user)
            assignments_qs = TenantAssignment.objects.filter(landlord=user)
            payments_qs = RentPayment.objects.filter(
                Q(obligation__landlord=user) |
                Q(receiving_stellar_address__in=properties_qs.values_list('receiving_wallet', flat=True))
            )

        rent_due = obligations_qs.aggregate(total=Sum('amount_due_usdc'))['total'] or Decimal('0.0000000')
        rent_collected = obligations_qs.aggregate(total=Sum('amount_paid_usdc'))['total'] or Decimal('0.0000000')
        outstanding = obligations_qs.aggregate(total=Sum('outstanding_balance_usdc'))['total'] or Decimal('0.0000000')

        active_tenants = assignments_qs.filter(status=TenantAssignment.Status.ACTIVE).values('tenant').distinct().count()
        total_units = RentalUnit.objects.filter(property__in=properties_qs).count()
        occupied_units = RentalUnit.objects.filter(property__in=properties_qs, is_occupied=True).count()
        overdue_count = obligations_qs.filter(due_date__lt=today, outstanding_balance_usdc__gt=0).count()

        # Build collection overview items
        collection_overview = []
        for obl in obligations_qs.select_related('tenant', 'property', 'unit').order_by('due_date')[:25]:
            collection_overview.append({
                'tenant_id': obl.tenant.id,
                'tenant_email': obl.tenant.email,
                'tenant_name': obl.tenant.first_name or obl.tenant.username or obl.tenant.email.split('@')[0],
                'property_name': obl.property.name,
                'unit_number': obl.unit.unit_number if obl.unit else '',
                'obligation_reference': obl.obligation_reference,
                'due_date': obl.due_date,
                'amount_due_usdc': obl.amount_due_usdc,
                'amount_paid_usdc': obl.amount_paid_usdc,
                'outstanding_usdc': obl.outstanding_balance_usdc,
                'status': obl.status,
                'is_overdue': obl.is_overdue,
            })

        # Recent verified payments
        recent_payments = []
        for p in payments_qs.select_related('obligation', 'tenant').order_by('-created_at')[:10]:
            recent_payments.append({
                'payment_reference': p.payment_reference,
                'amount': str(p.amount),
                'asset': p.asset_code,
                'tenant_email': p.tenant.email if p.tenant else (p.payer_stellar_address[:8] + '...'),
                'stellar_tx_hash': p.stellar_tx_hash,
                'stellar_op_id': p.stellar_op_id,
                'date': p.ledger_closed_at.isoformat() if p.ledger_closed_at else p.created_at.isoformat(),
                'status': p.reconciliation_status,
                'balance_after_payment': str(p.balance_after_payment) if p.balance_after_payment is not None else None,
                'explorer_url': p.stellar_explorer_url,
            })

        # Reconciliation stats
        reconciliation_summary = {
            'confirmed_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.CONFIRMED).count(),
            'partial_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.PARTIAL).count(),
            'unmatched_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED).count(),
            'excess_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.FLAGGED_EXCESS).count(),
        }

        data = {
            'rent_due_usdc': rent_due,
            'rent_collected_usdc': rent_collected,
            'outstanding_usdc': outstanding,
            'active_tenants': active_tenants,
            'managed_properties_count': properties_qs.count(),
            'total_units_count': total_units,
            'occupied_units_count': occupied_units,
            'overdue_obligations_count': overdue_count,
            'rental_collection_overview': collection_overview,
            'recent_payments': recent_payments,
            'reconciliation_summary': reconciliation_summary,
        }
        return Response(data)


class TenantDashboardView(generics.GenericAPIView):
    """
    Enhanced Tenant Dashboard API (Deliverable 3.B of MVP 2).
    Displays current rent obligation, total outstanding balance, payment schedule,
    partial payment capability, verified payment history, and downloadable receipts.
    """
    serializer_class = TenantDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Tenant rent overview, payment history & receipts dashboard',
        description='Returns current rent obligation, total outstanding rent, payment schedule, and verified receipts.',
        responses={200: TenantDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        tenant = request.user
        today = timezone.localdate()

        obligations_qs = RentObligation.objects.filter(tenant=tenant).select_related('property', 'unit').order_by('due_date')
        active_assignments = TenantAssignment.objects.filter(tenant=tenant, status=TenantAssignment.Status.ACTIVE)

        total_outstanding = obligations_qs.aggregate(total=Sum('outstanding_balance_usdc'))['total'] or Decimal('0.0000000')

        # Current primary obligation (first unsettled or upcoming obligation)
        current_obl = obligations_qs.filter(outstanding_balance_usdc__gt=0).first()
        if not current_obl:
            current_obl = obligations_qs.order_by('-due_date').first()

        monthly_rent = Decimal('0.0000000')
        if current_obl:
            monthly_rent = current_obl.amount_due_usdc
        elif active_assignments.exists():
            monthly_rent = active_assignments.first().rent_amount_usdc

        current_obl_data = None
        if current_obl:
            current_obl_data = {
                'id': str(current_obl.id),
                'obligation_reference': current_obl.obligation_reference,
                'property_name': current_obl.property.name,
                'unit_number': current_obl.unit.unit_number if current_obl.unit else '',
                'rental_period': current_obl.rental_period_display,
                'due_date': str(current_obl.due_date),
                'amount_due_usdc': str(current_obl.amount_due_usdc),
                'amount_paid_usdc': str(current_obl.amount_paid_usdc),
                'outstanding_balance_usdc': str(current_obl.outstanding_balance_usdc),
                'status': current_obl.status,
                'is_overdue': current_obl.is_overdue,
                'receiving_wallet': current_obl.receiving_wallet,
                'payment_memo': current_obl.payment_memo,
                'stellar_uri': f"web+stellar:pay?destination={current_obl.receiving_wallet}&amount={current_obl.outstanding_balance_usdc}&asset_code={current_obl.asset_code}&memo={current_obl.payment_memo}&memo_type=MEMO_TEXT"
            }

        # Upcoming obligations list
        upcoming = []
        for obl in obligations_qs.filter(due_date__gte=today)[:5]:
            upcoming.append({
                'obligation_reference': obl.obligation_reference,
                'period': obl.rental_period_display,
                'due_date': str(obl.due_date),
                'amount_due_usdc': str(obl.amount_due_usdc),
                'outstanding_balance_usdc': str(obl.outstanding_balance_usdc),
                'status': obl.status,
            })

        # Payment schedule (all obligations with due dates & rental periods)
        schedule_items = []
        for obl in obligations_qs[:12]:
            schedule_items.append({
                'obligation_reference': obl.obligation_reference,
                'property': obl.property.name,
                'period': obl.rental_period_display,
                'due_date': str(obl.due_date),
                'amount_due_usdc': str(obl.amount_due_usdc),
                'status': obl.status,
            })

        # Recent verified payment transactions
        payments_qs = RentPayment.objects.filter(tenant=tenant).order_by('-created_at')[:10]
        recent_payments = []
        for p in payments_qs:
            receipt = getattr(p, 'receipt', None)
            recent_payments.append({
                'payment_reference': p.payment_reference,
                'amount': str(p.amount),
                'asset': p.asset_code,
                'date': p.ledger_closed_at.isoformat() if p.ledger_closed_at else p.created_at.isoformat(),
                'status': p.reconciliation_status,
                'stellar_tx_hash': p.stellar_tx_hash,
                'explorer_url': p.stellar_explorer_url,
                'receipt_number': receipt.receipt_number if receipt else None,
                'receipt_id': str(receipt.id) if receipt else None,
            })

        # Downloadable receipts
        receipts_qs = RentReceipt.objects.filter(tenant=tenant).order_by('-payment_date')[:10]
        downloadable_receipts = RentReceiptSerializer(receipts_qs, many=True, context={'request': request}).data

        data = {
            'outstanding_rent_usdc': total_outstanding,
            'monthly_rent_usdc': monthly_rent,
            'amount_paid_usdc': current_obl.amount_paid_usdc if current_obl else Decimal('0.0000000'),
            'remaining_balance_usdc': current_obl.outstanding_balance_usdc if current_obl else Decimal('0.0000000'),
            'payment_status': current_obl.status if current_obl else 'No active obligations',
            'current_obligation': current_obl_data,
            'upcoming_obligations': upcoming,
            'payment_schedule': schedule_items,
            'recent_payments': recent_payments,
            'downloadable_receipts': downloadable_receipts,
        }
        return Response(data)


class HostDashboardView(generics.GenericAPIView):
    serializer_class = HostDashboardSerializer
    permission_classes = [IsHostRole]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Host earnings and bookings summary',
        description='Returns metrics specific to the authenticated vehicle host.',
        responses={200: HostDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        host = request.user

        # Reconcile any active rentals for host that don't have a payout record yet
        unrecorded = Rental.objects.filter(
            host=host,
            status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE]
        ).exclude(payouts__isnull=False)
        for r in unrecorded:
            p_fee = (r.rental_amount_usdc * Decimal('0.10')).quantize(Decimal('0.0000001'))
            net = (r.rental_amount_usdc - p_fee).quantize(Decimal('0.0000001'))
            HostPayout.objects.get_or_create(
                rental=r,
                host=host,
                defaults={
                    'gross_rental_usdc': r.rental_amount_usdc,
                    'platform_fee_usdc': p_fee,
                    'net_payout_usdc': net,
                    'status': HostPayout.Status.PENDING
                }
            )

        total_earned = HostPayout.objects.filter(host=host, status=HostPayout.Status.COMPLETED).aggregate(total=Sum('net_payout_usdc'))['total'] or Decimal('0.0000000')
        pending_payout = HostPayout.objects.filter(host=host, status=HostPayout.Status.PENDING).aggregate(total=Sum('net_payout_usdc'))['total'] or Decimal('0.0000000')

        data = {
            'total_earned_usdc': total_earned,
            'pending_payout_usdc': pending_payout,
            'vehicles_listed_count': Vehicle.objects.filter(host=host).count(),
            'active_bookings_count': Rental.objects.filter(host=host, status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE]).count(),
            'completed_bookings_count': Rental.objects.filter(host=host, status=Rental.Status.COMPLETED).count(),
        }
        return Response(data)


class LandlordDashboardView(generics.GenericAPIView):
    """
    Enhanced Landlord Dashboard API (Deliverable 3.A of MVP 2).
    Returns collection overview (rent due, collected, outstanding),
    active tenants count, rental collection breakdown, overdue tracking,
    and payment reconciliation metrics.
    """
    serializer_class = LandlordDashboardSerializer
    permission_classes = [IsHostRole]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Landlord property portfolio & rent collection dashboard',
        description='Returns rent due, collected, outstanding balance, tenant collections, and reconciliation overview.',
        responses={200: LandlordDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        user = request.user
        today = timezone.localdate()

        # If admin, aggregate across platform; otherwise filter to landlord
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            obligations_qs = RentObligation.objects.all()
            properties_qs = Property.objects.all()
            assignments_qs = TenantAssignment.objects.all()
            payments_qs = RentPayment.objects.all()
        else:
            obligations_qs = RentObligation.objects.filter(landlord=user)
            properties_qs = Property.objects.filter(landlord=user)
            assignments_qs = TenantAssignment.objects.filter(landlord=user)
            payments_qs = RentPayment.objects.filter(
                Q(obligation__landlord=user) |
                Q(receiving_stellar_address__in=properties_qs.values_list('receiving_wallet', flat=True))
            )

        rent_due = obligations_qs.aggregate(total=Sum('amount_due_usdc'))['total'] or Decimal('0.0000000')
        rent_collected = obligations_qs.aggregate(total=Sum('amount_paid_usdc'))['total'] or Decimal('0.0000000')
        outstanding = obligations_qs.aggregate(total=Sum('outstanding_balance_usdc'))['total'] or Decimal('0.0000000')

        active_tenants = assignments_qs.filter(status=TenantAssignment.Status.ACTIVE).values('tenant').distinct().count()
        total_units = RentalUnit.objects.filter(property__in=properties_qs).count()
        occupied_units = RentalUnit.objects.filter(property__in=properties_qs, is_occupied=True).count()
        overdue_count = obligations_qs.filter(due_date__lt=today, outstanding_balance_usdc__gt=0).count()

        # Build collection overview items
        collection_overview = []
        for obl in obligations_qs.select_related('tenant', 'property', 'unit').order_by('due_date')[:25]:
            collection_overview.append({
                'tenant_id': obl.tenant.id,
                'tenant_email': obl.tenant.email,
                'tenant_name': obl.tenant.first_name or obl.tenant.username or obl.tenant.email.split('@')[0],
                'property_name': obl.property.name,
                'unit_number': obl.unit.unit_number if obl.unit else '',
                'obligation_reference': obl.obligation_reference,
                'due_date': obl.due_date,
                'amount_due_usdc': obl.amount_due_usdc,
                'amount_paid_usdc': obl.amount_paid_usdc,
                'outstanding_usdc': obl.outstanding_balance_usdc,
                'status': obl.status,
                'is_overdue': obl.is_overdue,
            })

        # Recent verified payments
        recent_payments = []
        for p in payments_qs.select_related('obligation', 'tenant').order_by('-created_at')[:10]:
            recent_payments.append({
                'payment_reference': p.payment_reference,
                'amount': str(p.amount),
                'asset': p.asset_code,
                'tenant_email': p.tenant.email if p.tenant else (p.payer_stellar_address[:8] + '...'),
                'stellar_tx_hash': p.stellar_tx_hash,
                'stellar_op_id': p.stellar_op_id,
                'date': p.ledger_closed_at.isoformat() if p.ledger_closed_at else p.created_at.isoformat(),
                'status': p.reconciliation_status,
                'balance_after_payment': str(p.balance_after_payment) if p.balance_after_payment is not None else None,
                'explorer_url': p.stellar_explorer_url,
            })

        # Reconciliation stats
        reconciliation_summary = {
            'confirmed_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.CONFIRMED).count(),
            'partial_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.PARTIAL).count(),
            'unmatched_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED).count(),
            'excess_count': payments_qs.filter(reconciliation_status=RentPayment.ReconciliationStatus.FLAGGED_EXCESS).count(),
        }

        data = {
            'rent_due_usdc': rent_due,
            'rent_collected_usdc': rent_collected,
            'outstanding_usdc': outstanding,
            'active_tenants': active_tenants,
            'managed_properties_count': properties_qs.count(),
            'total_units_count': total_units,
            'occupied_units_count': occupied_units,
            'overdue_obligations_count': overdue_count,
            'rental_collection_overview': collection_overview,
            'recent_payments': recent_payments,
            'reconciliation_summary': reconciliation_summary,
        }
        return Response(data)


class TenantDashboardView(generics.GenericAPIView):
    """
    Enhanced Tenant Dashboard API (Deliverable 3.B of MVP 2).
    Displays current rent obligation, total outstanding balance, payment schedule,
    partial payment capability, verified payment history, and downloadable receipts.
    """
    serializer_class = TenantDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Tenant rent overview, payment history & receipts dashboard',
        description='Returns current rent obligation, total outstanding rent, payment schedule, and verified receipts.',
        responses={200: TenantDashboardSerializer}
    )
    def get(self, request, *args, **kwargs):
        tenant = request.user
        today = timezone.localdate()

        obligations_qs = RentObligation.objects.filter(tenant=tenant).select_related('property', 'unit').order_by('due_date')
        active_assignments = TenantAssignment.objects.filter(tenant=tenant, status=TenantAssignment.Status.ACTIVE)

        total_outstanding = obligations_qs.aggregate(total=Sum('outstanding_balance_usdc'))['total'] or Decimal('0.0000000')

        # Current primary obligation (first unsettled or upcoming obligation)
        current_obl = obligations_qs.filter(outstanding_balance_usdc__gt=0).first()
        if not current_obl:
            current_obl = obligations_qs.order_by('-due_date').first()

        monthly_rent = Decimal('0.0000000')
        if current_obl:
            monthly_rent = current_obl.amount_due_usdc
        elif active_assignments.exists():
            monthly_rent = active_assignments.first().rent_amount_usdc

        current_obl_data = None
        if current_obl:
            current_obl_data = {
                'id': str(current_obl.id),
                'obligation_reference': current_obl.obligation_reference,
                'property_name': current_obl.property.name,
                'unit_number': current_obl.unit.unit_number if current_obl.unit else '',
                'rental_period': current_obl.rental_period_display,
                'due_date': str(current_obl.due_date),
                'amount_due_usdc': str(current_obl.amount_due_usdc),
                'amount_paid_usdc': str(current_obl.amount_paid_usdc),
                'outstanding_balance_usdc': str(current_obl.outstanding_balance_usdc),
                'status': current_obl.status,
                'is_overdue': current_obl.is_overdue,
                'receiving_wallet': current_obl.receiving_wallet,
                'payment_memo': current_obl.payment_memo,
                'stellar_uri': f"web+stellar:pay?destination={current_obl.receiving_wallet}&amount={current_obl.outstanding_balance_usdc}&asset_code={current_obl.asset_code}&memo={current_obl.payment_memo}&memo_type=MEMO_TEXT"
            }

        # Upcoming obligations list
        upcoming = []
        for obl in obligations_qs.filter(due_date__gte=today)[:5]:
            upcoming.append({
                'obligation_reference': obl.obligation_reference,
                'period': obl.rental_period_display,
                'due_date': str(obl.due_date),
                'amount_due_usdc': str(obl.amount_due_usdc),
                'outstanding_balance_usdc': str(obl.outstanding_balance_usdc),
                'status': obl.status,
            })

        # Payment schedule (all obligations with due dates & rental periods)
        schedule_items = []
        for obl in obligations_qs[:12]:
            schedule_items.append({
                'obligation_reference': obl.obligation_reference,
                'property': obl.property.name,
                'period': obl.rental_period_display,
                'due_date': str(obl.due_date),
                'amount_due_usdc': str(obl.amount_due_usdc),
                'status': obl.status,
            })

        # Recent verified payment transactions
        payments_qs = RentPayment.objects.filter(tenant=tenant).order_by('-created_at')[:10]
        recent_payments = []
        for p in payments_qs:
            receipt = getattr(p, 'receipt', None)
            recent_payments.append({
                'payment_reference': p.payment_reference,
                'amount': str(p.amount),
                'asset': p.asset_code,
                'date': p.ledger_closed_at.isoformat() if p.ledger_closed_at else p.created_at.isoformat(),
                'status': p.reconciliation_status,
                'stellar_tx_hash': p.stellar_tx_hash,
                'explorer_url': p.stellar_explorer_url,
                'receipt_number': receipt.receipt_number if receipt else None,
                'receipt_id': str(receipt.id) if receipt else None,
            })

        # Downloadable receipts
        receipts_qs = RentReceipt.objects.filter(tenant=tenant).order_by('-payment_date')[:10]
        downloadable_receipts = RentReceiptSerializer(receipts_qs, many=True, context={'request': request}).data

        data = {
            'outstanding_rent_usdc': total_outstanding,
            'monthly_rent_usdc': monthly_rent,
            'amount_paid_usdc': current_obl.amount_paid_usdc if current_obl else Decimal('0.0000000'),
            'remaining_balance_usdc': current_obl.outstanding_balance_usdc if current_obl else Decimal('0.0000000'),
            'payment_status': current_obl.status if current_obl else 'No active obligations',
            'current_obligation': current_obl_data,
            'upcoming_obligations': upcoming,
            'payment_schedule': schedule_items,
            'recent_payments': recent_payments,
            'downloadable_receipts': downloadable_receipts,
        }
        return Response(data)
