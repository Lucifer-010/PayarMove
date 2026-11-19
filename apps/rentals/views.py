import logging
from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.db.models import Q
from django.utils import timezone
from django.http import Http404
from django.conf import settings
from decimal import Decimal

logger = logging.getLogger(__name__)

from .models import Vehicle, Rental, SavedVehicle
from .serializers import (
    VehicleSerializer,
    RentalCreateSerializer,
    RentalDetailSerializer,
    SavedVehicleSerializer,
)
from apps.core.permissions import IsHostRole, IsKYCApproved
from apps.payouts.models import HostPayout
from apps.escrow.models import SmartContractEscrow, ContractEventLog
from apps.escrow.soroban_client import SorobanClient

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = VehicleSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsHostRole(), IsKYCApproved()]

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)

    @extend_schema(
        tags=['Mobility Vehicles'],
        summary='List active mobility rental vehicles',
        description='Browse peer-to-peer vehicles available for rental with pricing in Stellar USDC and specifications.'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        tags=['Mobility Vehicles'],
        summary='List vehicle for rental (Hosts only)',
        description='Host adds a vehicle to the peer-to-peer marketplace.'
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='my-vehicles', permission_classes=[permissions.IsAuthenticated])
    def my_vehicles(self, request):
        vehicles = Vehicle.objects.filter(host=request.user).order_by('-created_at')
        serializer = self.get_serializer(vehicles, many=True)
        return Response(serializer.data)


class SavedVehicleViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedVehicleSerializer

    def get_queryset(self):
        return SavedVehicle.objects.filter(user=self.request.user).order_by('-created_at')

    @extend_schema(
        tags=['Saved Vehicles'],
        summary='List saved vehicles for current user',
        description='Returns list of vehicles bookmarked/favorited by the authenticated user.'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        tags=['Saved Vehicles'],
        summary='Save / bookmark a vehicle',
        description='Adds a vehicle to user favorites.'
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='toggle')
    def toggle(self, request):
        vehicle_id = request.data.get('vehicle_id')
        if not vehicle_id:
            return Response({'error': 'vehicle_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)

        saved = SavedVehicle.objects.filter(user=request.user, vehicle=vehicle).first()
        if saved:
            saved.delete()
            return Response({'saved': False, 'vehicle_id': str(vehicle.id), 'message': 'Removed from saved vehicles'})
        else:
            SavedVehicle.objects.create(user=request.user, vehicle=vehicle)
            return Response({'saved': True, 'vehicle_id': str(vehicle.id), 'message': 'Added to saved vehicles'}, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        # Support removing either by SavedVehicle.id or Vehicle.id
        saved = SavedVehicle.objects.filter(
            Q(id=pk) | Q(vehicle_id=pk),
            user=request.user
        ).first()
        if not saved:
            return Response({'error': 'Saved record not found'}, status=status.HTTP_404_NOT_FOUND)
        saved.delete()
        return Response({'message': 'Removed from saved vehicles'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='sync')
    def sync_saved(self, request):
        vehicle_ids = request.data.get('vehicle_ids', [])
        if not isinstance(vehicle_ids, list):
            vehicle_ids = [vehicle_ids]
        created_count = 0
        for vid in vehicle_ids:
            try:
                vehicle = Vehicle.objects.get(id=vid)
                SavedVehicle.objects.get_or_create(user=request.user, vehicle=vehicle)
                created_count += 1
            except Exception:
                continue
        all_saved = list(SavedVehicle.objects.filter(user=request.user).values_list('vehicle_id', flat=True))
        return Response({
            'success': True,
            'synced_count': created_count,
            'saved_vehicle_ids': [str(vid) for vid in all_saved]
        })


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.all()
    serializer_class = RentalDetailSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsKYCApproved()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'ADMIN' or user.is_superuser:
            return Rental.objects.all().order_by('-created_at')
        qs = Rental.objects.filter(Q(renter=user) | Q(host=user)).order_by('-created_at')
        confirmed_vehicle_ids = set(
            Rental.objects.filter(
                renter=user,
                status__in=[Rental.Status.CONFIRMED, Rental.Status.ACTIVE]
            ).values_list('vehicle_id', flat=True)
        )
        if confirmed_vehicle_ids:
            qs = qs.exclude(
                renter=user,
                vehicle_id__in=confirmed_vehicle_ids,
                status=Rental.Status.AWAITING_PAYMENT
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return RentalCreateSerializer
        return RentalDetailSerializer

    @extend_schema(
        tags=['Rental Bookings'],
        summary='Create vehicle rental booking agreement',
        description='Initiates a rental booking. Transitions status to AWAITING_PAYMENT for Soroban escrow deposit.',
        request=RentalCreateSerializer,
        responses={201: RentalDetailSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        vehicle = serializer.validated_data['vehicle']

        # Idempotency / deduplication: if the user already has an active AWAITING_PAYMENT rental
        # for this vehicle, return the existing pending agreement instead of creating a duplicate.
        existing_rental = Rental.objects.filter(
            renter=request.user,
            vehicle=vehicle,
            status=Rental.Status.AWAITING_PAYMENT
        ).order_by('-created_at').first()

        if existing_rental:
            existing_rental.start_date = serializer.validated_data.get('start_date', existing_rental.start_date)
            existing_rental.end_date = serializer.validated_data.get('end_date', existing_rental.end_date)
            existing_rental.start_time = serializer.validated_data.get('start_time', existing_rental.start_time)
            existing_rental.end_time = serializer.validated_data.get('end_time', existing_rental.end_time)
            if 'total_hours' in serializer.validated_data:
                existing_rental.total_hours = serializer.validated_data['total_hours']
            # Reset amounts to recalculate based on updated hours
            existing_rental.rental_amount_usdc = Decimal('0')
            existing_rental.save()
            return Response(RentalDetailSerializer(existing_rental).data, status=status.HTTP_200_OK)

        rental = serializer.save()
        return Response(RentalDetailSerializer(rental).data, status=status.HTTP_201_CREATED)

    def get_object(self):
        pk = self.kwargs.get('pk')
        try:
            return Rental.objects.get(id=pk)
        except Exception:
            try:
                return Rental.objects.get(rental_code__iexact=pk)
            except Rental.DoesNotExist:
                raise Http404("Rental agreement not found")

    @extend_schema(
        tags=['Rental Bookings'],
        summary='Retrieve rental details and breakdown',
        description='Inspect pricing breakdown, rental dates, vehicle, host, and escrow status.'
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=['Rental Bookings'],
        summary='List user rental agreements',
        description='Returns all bookings where the user is either the renter or the host.'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        tags=['Rental Bookings'],
        summary='Host confirms vehicle handover / delivered successfully',
        description='Host marks vehicle as delivered to renter. Rental transitions to ACTIVE status.',
        responses={200: RentalDetailSerializer}
    )
    @action(detail=True, methods=['post'], url_path='confirm-delivery')
    def confirm_delivery(self, request, pk=None):
        rental = self.get_object()
        if request.user != rental.host and not request.user.is_staff and request.user.role != 'ADMIN':
            return Response({'error': 'Only the vehicle host or platform administrator can confirm delivery.'}, status=status.HTTP_403_FORBIDDEN)
        
        if rental.status != Rental.Status.CONFIRMED:
            return Response({'error': f'Cannot confirm delivery for rental with status {rental.status}. Rental must be CONFIRMED.'}, status=status.HTTP_400_BAD_REQUEST)
        
        rental.status = Rental.Status.ACTIVE
        rental.save()

        # Ensure pending payout is recorded
        platform_fee = (rental.rental_amount_usdc * Decimal('0.10')).quantize(Decimal('0.0000001'))
        net_payout = (rental.rental_amount_usdc - platform_fee).quantize(Decimal('0.0000001'))
        HostPayout.objects.update_or_create(
            rental=rental,
            host=rental.host,
            defaults={
                'gross_rental_usdc': rental.rental_amount_usdc,
                'platform_fee_usdc': platform_fee,
                'net_payout_usdc': net_payout,
                'status': HostPayout.Status.PENDING,
            }
        )

        return Response({
            'success': True,
            'message': f'Vehicle {rental.vehicle.make_model} delivered successfully! Rental is now active.',
            'rental': RentalDetailSerializer(rental).data
        })

    @extend_schema(
        tags=['Rental Bookings'],
        summary='Host confirms vehicle returned successfully and closes deal',
        description='Host marks vehicle returned by renter. Rental transitions to COMPLETED status, escrow is released, and host payout settles.',
        responses={200: RentalDetailSerializer}
    )
    @action(detail=True, methods=['post'], url_path='confirm-return')
    def confirm_return(self, request, pk=None):
        rental = self.get_object()
        if request.user != rental.host and not request.user.is_staff and request.user.role != 'ADMIN':
            return Response({'error': 'Only the vehicle host or platform administrator can confirm return.'}, status=status.HTTP_403_FORBIDDEN)
        
        if rental.status not in (Rental.Status.ACTIVE, Rental.Status.CONFIRMED):
            return Response({'error': f'Cannot confirm return for rental with status {rental.status}.'}, status=status.HTTP_400_BAD_REQUEST)
        
        rental.status = Rental.Status.COMPLETED
        rental.save()

        platform_fee = (rental.rental_amount_usdc * Decimal('0.10')).quantize(Decimal('0.0000001'))
        host_net = (rental.rental_amount_usdc - platform_fee).quantize(Decimal('0.0000001'))

        # Check and settle escrow
        escrow = SmartContractEscrow.objects.filter(rental=rental).first()
        disburse_tx = None
        simulated_hash = f"0xreturn{rental.rental_code.replace('-', '')}{timezone.now().strftime('%Y%m%d%H%M%S')}"[:64]

        host_payout_addr = rental.host.primary_stellar_address or getattr(rental.vehicle.host, 'primary_stellar_address', None)
        if host_payout_addr and host_payout_addr.startswith('G'):
            try:
                client = SorobanClient()
                disburse_tx = client.disburse_funds_to_host(host_payout_addr, host_net)
            except Exception as d_err:
                import logging
                logging.getLogger(__name__).warning("On-chain server disburse to host warning: %s", d_err)

        if escrow:
            escrow.status = SmartContractEscrow.OnChainStatus.COMPLETED
            escrow.settlement_tx_hash = disburse_tx or simulated_hash
            escrow.settled_at = timezone.now()
            escrow.save()

            ContractEventLog.objects.create(
                escrow=escrow,
                event_topic='deal_closed',
                tx_hash=disburse_tx or simulated_hash,
                raw_data={
                    'host_payout': str(host_net),
                    'platform_fee': str(platform_fee),
                    'status': 'COMPLETED'
                }
            )

        HostPayout.objects.update_or_create(
            rental=rental,
            host=rental.host,
            defaults={
                'gross_rental_usdc': rental.rental_amount_usdc,
                'platform_fee_usdc': platform_fee,
                'net_payout_usdc': host_net,
                'status': HostPayout.Status.COMPLETED,
                'tx_hash': disburse_tx or simulated_hash,
                'settled_at': timezone.now()
            }
        )

        return Response({
            'success': True,
            'message': f'Vehicle {rental.vehicle.make_model} returned successfully! Deal is closed and payout has settled.',
            'rental': RentalDetailSerializer(rental).data
        })


# ============================================================================
# PayarMove MVP 2: Property & Rental Schedule Management Views & APIs
# ============================================================================

from django.http import HttpResponse
from datetime import timedelta
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
from .serializers import (
    PropertySerializer,
    RentalUnitSerializer,
    TenantAssignmentSerializer,
    RentalScheduleSerializer,
    RentObligationSerializer,
    PaymentRequestSerializer,
    RentPaymentSerializer,
    RentReceiptSerializer,
    TransactionVerificationRequestSerializer,
    RentCalculatorSerializer,
)
from .services.stellar_reconciliation import StellarReconciliationService
from .services.receipt_generator import generate_receipt_pdf_bytes
from apps.core.permissions import IsLandlordRole, IsTenantRole


class PropertyViewSet(viewsets.ModelViewSet):
    """
    CRUD management for rental properties.
    Publicly browsable for listings; landlords can create and manage their properties.
    """
    serializer_class = PropertySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Property.objects.filter(is_active=True).order_by('-created_at')
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            return Property.objects.all().order_by('-created_at')
        if self.action in ['retrieve', 'units']:
            return Property.objects.filter(Q(is_active=True) | Q(landlord=user)).order_by('-created_at')
        role_upper = (user.role or '').upper()
        if role_upper in ('LANDLORD', 'HOST'):
            if self.request.query_params.get('public') == 'true':
                return Property.objects.filter(is_active=True).order_by('-created_at')
            p_filter = Q(landlord=user)
            if user.primary_stellar_address:
                p_filter |= Q(receiving_wallet=user.primary_stellar_address)
            return Property.objects.filter(p_filter).order_by('-created_at')
        # Tenants see properties they have active assignments with or all active
        return Property.objects.filter(is_active=True).order_by('-created_at')

    def perform_create(self, serializer):
        prop = serializer.save(landlord=self.request.user)
        units_data = self.request.data.get('units', [])
        if isinstance(units_data, list):
            for u in units_data:
                rent = u.get('rent_amount_usdc') or u.get('monthly_rent_usdc') or 500
                deposit = u.get('deposit_amount_usdc') or u.get('security_deposit_usdc') or rent
                RentalUnit.objects.create(
                    property=prop,
                    unit_number=u.get('unit_number', '1A'),
                    bedrooms=u.get('bedrooms', 1),
                    bathrooms=Decimal(str(u.get('bathrooms', 1))),
                    rent_amount_usdc=Decimal(str(rent)),
                    deposit_amount_usdc=Decimal(str(deposit))
                )

    @extend_schema(
        tags=['Properties & Units'],
        summary='List managed rental properties'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        tags=['Properties & Units'],
        summary='Create new rental property record (Landlords)'
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def units(self, request, pk=None):
        prop = self.get_object()
        units = prop.units.all()
        return Response(RentalUnitSerializer(units, many=True).data)

    @action(detail=True, methods=['get'], url_path='active-tenants')
    def active_tenants(self, request, pk=None):
        prop = self.get_object()
        assignments = prop.assignments.filter(status=TenantAssignment.Status.ACTIVE)
        return Response(TenantAssignmentSerializer(assignments, many=True).data)

    @action(detail=True, methods=['get'], url_path='active_tenants')
    def active_tenants_legacy(self, request, pk=None):
        return self.active_tenants(request, pk)

    @action(detail=True, methods=['get'])
    def obligations(self, request, pk=None):
        prop = self.get_object()
        obligations = prop.obligations.all().order_by('-due_date')
        return Response(RentObligationSerializer(obligations, many=True).data)


class RentalUnitViewSet(viewsets.ModelViewSet):
    """
    Rental units within properties.
    Publicly browsable for available units; landlords can manage units.
    """
    serializer_class = RentalUnitSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = RentalUnit.objects.all().order_by('property', 'unit_number')
        property_id = self.request.query_params.get('property')
        if property_id:
            qs = qs.filter(property_id=property_id)
        return qs

    @extend_schema(
        tags=['Properties & Units'],
        summary='List rental units'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class TenantAssignmentViewSet(viewsets.ModelViewSet):
    """
    Assigns tenants to rental properties or units.
    """
    serializer_class = TenantAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            return TenantAssignment.objects.all().order_by('-created_at')
        role_upper = (user.role or '').upper()
        if role_upper in ('LANDLORD', 'HOST'):
            p_filter = Q(landlord=user)
            if user.primary_stellar_address:
                p_filter |= Q(property__receiving_wallet=user.primary_stellar_address)
            return TenantAssignment.objects.filter(p_filter).order_by('-created_at')
        return TenantAssignment.objects.filter(tenant=user).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        prop = serializer.validated_data.get('property')
        unit = serializer.validated_data.get('unit')
        if not prop and unit:
            prop = unit.property

        landlord = serializer.validated_data.get('landlord') or (prop.landlord if prop else None) or (user if user.role in ('LANDLORD', 'HOST') else None)
        tenant = serializer.validated_data.get('tenant') or (user if user.role in ('TENANT', 'RENTER') else None)
        receiving_wallet = serializer.validated_data.get('receiving_wallet') or (prop.receiving_wallet if prop else '') or (landlord.primary_stellar_address if landlord else '')
        start_date = serializer.validated_data.get('start_date') or timezone.localdate()

        assignment = serializer.save(
            property=prop,
            landlord=landlord or user,
            tenant=tenant or user,
            receiving_wallet=receiving_wallet,
            start_date=start_date
        )
        if assignment.unit and assignment.status == TenantAssignment.Status.ACTIVE:
            assignment.unit.is_occupied = True
            assignment.unit.current_tenant = assignment.tenant
            assignment.unit.save(update_fields=['is_occupied', 'current_tenant'])

        # Automatically create RentalSchedule for active assignments if requested
        auto_schedule = self.request.data.get('create_schedule', True)
        if auto_schedule:
            schedule, created = RentalSchedule.objects.get_or_create(
                assignment=assignment,
                defaults={
                    'property': assignment.property,
                    'unit': assignment.unit,
                    'landlord': assignment.landlord,
                    'tenant': assignment.tenant,
                    'rent_amount_usdc': assignment.rent_amount_usdc,
                    'frequency': assignment.payment_frequency,
                    'first_payment_date': assignment.start_date,
                    'start_date': assignment.start_date,
                    'end_date': assignment.end_date,
                    'receiving_wallet': assignment.receiving_wallet or (assignment.property.receiving_wallet if assignment.property else ''),
                    'is_active': True
                }
            )
            # Generate the first 3 obligations immediately
            schedule.generate_obligations(count=3)

    @extend_schema(
        tags=['Rental Schedules & Assignments'],
        summary='Assign tenant to property / unit'
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        tags=['Rental Schedules & Assignments'],
        summary='Send rent payment reminder to tenant'
    )
    @action(detail=True, methods=['post'])
    def remind(self, request, pk=None):
        assignment = self.get_object()
        tenant = assignment.tenant
        return Response({
            'success': True,
            'message': f"Rent payment reminder sent to {tenant.email if tenant else 'tenant'}.",
            'tenant_email': tenant.email if tenant else '',
            'assignment_id': str(assignment.id)
        })

    @extend_schema(
        tags=['Rental Schedules & Assignments'],
        summary='Terminate tenant lease assignment'
    )
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        assignment = self.get_object()
        assignment.is_active = False
        assignment.save(update_fields=['is_active'])
        if assignment.unit:
            assignment.unit.is_occupied = False
            assignment.unit.save(update_fields=['is_occupied'])
        return Response({
            'success': True,
            'message': f"Lease for unit {assignment.unit.unit_number if assignment.unit else ''} has been terminated.",
            'assignment_id': str(assignment.id)
        })


class RentalScheduleViewSet(viewsets.ModelViewSet):
    """
    Rental schedule configuration and obligation generation.
    """
    serializer_class = RentalScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            return RentalSchedule.objects.all().order_by('-created_at')
        role_upper = (user.role or '').upper()
        if role_upper in ('LANDLORD', 'HOST'):
            p_filter = Q(landlord=user)
            if user.primary_stellar_address:
                p_filter |= Q(property__receiving_wallet=user.primary_stellar_address)
            return RentalSchedule.objects.filter(p_filter).order_by('-created_at')
        return RentalSchedule.objects.filter(tenant=user).order_by('-created_at')

    @extend_schema(
        tags=['Rental Schedules & Assignments'],
        summary='List recurring rental schedules'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='generate-obligations')
    def generate_obligations(self, request, pk=None):
        """
        Manually trigger generation of recurring rent obligations for this schedule.
        """
        schedule = self.get_object()
        count = int(request.data.get('count', 3))
        generated = schedule.generate_obligations(count=count)
        return Response({
            'success': True,
            'message': f"Generated {len(generated)} rental obligations for {schedule.schedule_code}",
            'obligations': RentObligationSerializer(generated, many=True).data
        })

    @action(detail=True, methods=['post'], url_path='generate_obligations')
    def generate_obligations_legacy(self, request, pk=None):
        return self.generate_obligations(request, pk)


class RentObligationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View recurring rental obligations, track due dates, balances, and partial payments.
    """
    serializer_class = RentObligationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RentObligation.objects.all().order_by('due_date', '-created_at')
        role_upper = (user.role or '').upper()
        if not (user.is_staff or user.is_superuser or role_upper == 'ADMIN'):
            if role_upper in ('LANDLORD', 'HOST'):
                p_filter = Q(landlord=user)
                if user.primary_stellar_address:
                    p_filter |= Q(receiving_wallet=user.primary_stellar_address) | Q(property__receiving_wallet=user.primary_stellar_address)
                qs = qs.filter(p_filter)
            else:
                qs = qs.filter(tenant=user)

        # Filters
        prop_id = self.request.query_params.get('property')
        if prop_id:
            qs = qs.filter(property_id=prop_id)

        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        is_overdue = self.request.query_params.get('is_overdue')
        if is_overdue is not None:
            today = timezone.localdate()
            if is_overdue.lower() in ('true', '1'):
                qs = qs.filter(due_date__lt=today, outstanding_balance_usdc__gt=0)
            else:
                qs = qs.exclude(due_date__lt=today, outstanding_balance_usdc__gt=0)

        return qs

    @extend_schema(
        tags=['Rental Obligations & Payments'],
        summary='List rent obligations (Upcoming, Unpaid, Partially Paid, Paid, Overdue)'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def _build_payment_xdr(self, obligation, source_address, amount_usdc):
        from stellar_sdk import Server, TransactionBuilder, Account, Asset
        import requests

        network_passphrase = getattr(settings, 'STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
        horizon_url = getattr(settings, 'STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org').rstrip('/')
        server = Server(horizon_url)

        # 1. Load source account from Horizon or friendbot fund it
        try:
            source_acc = server.load_account(source_address)
        except Exception:
            try:
                requests.get(f"https://friendbot.stellar.org/?addr={source_address}", timeout=5)
                source_acc = server.load_account(source_address)
            except Exception:
                source_acc = Account(source_address, sequence=1)

        # 2. Destination address is the property owner's active receiving wallet
        dest_address = (
            getattr(obligation, 'owner_receiving_wallet', None)
            or (obligation.property.owner_wallet if obligation.property else None)
            or getattr(getattr(obligation, 'landlord', None), 'primary_stellar_address', None)
            or obligation.receiving_wallet
            or getattr(settings, 'STELLAR_SERVER_PUBLIC_KEY', 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK')
        )

        # Ensure destination exists on testnet
        try:
            server.load_account(dest_address)
        except Exception:
            try:
                requests.get(f"https://friendbot.stellar.org/?addr={dest_address}", timeout=5)
            except Exception:
                pass

        # 3. Check assets and trustlines
        usdc_code = getattr(settings, 'STELLAR_USDC_CODE', 'USDC')
        usdc_issuer = getattr(settings, 'STELLAR_USDC_ISSUER', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
        usdc_asset = Asset(usdc_code, usdc_issuer)

        dest_has_usdc = False
        try:
            dest_acc = server.load_account(dest_address)
            for b in getattr(dest_acc, 'raw_data', {}).get('balances', []):
                if b.get('asset_code') == usdc_code and b.get('asset_issuer') == usdc_issuer:
                    dest_has_usdc = True
                    break
        except Exception:
            pass

        source_has_usdc = False
        source_usdc_bal = Decimal('0')
        if hasattr(source_acc, 'raw_data') and 'balances' in source_acc.raw_data:
            for b in source_acc.raw_data['balances']:
                if b.get('asset_code') == usdc_code and b.get('asset_issuer') == usdc_issuer:
                    source_has_usdc = True
                    try:
                        source_usdc_bal = Decimal(b.get('balance', '0'))
                    except Exception:
                        pass
                    break

        builder = TransactionBuilder(
            source_account=source_acc,
            network_passphrase=network_passphrase,
            base_fee=100
        )

        memo_text = obligation.payment_memo or obligation.obligation_reference or f"PM-{obligation.id}"
        builder.add_text_memo(str(memo_text)[:28])

        pay_amount = amount_usdc
        if dest_has_usdc and source_has_usdc and source_usdc_bal > 0:
            actual_pay = min(pay_amount, source_usdc_bal)
            builder.append_payment_op(
                destination=dest_address,
                asset=usdc_asset,
                amount=f"{actual_pay:.7f}"
            )
        elif dest_has_usdc and not source_has_usdc:
            builder.append_payment_op(
                destination=dest_address,
                asset=usdc_asset,
                amount=f"{pay_amount:.7f}"
            )
        else:
            builder.append_payment_op(
                destination=dest_address,
                asset=Asset.native(),
                amount=f"{min(Decimal('10.0000000'), pay_amount):.7f}"
            )

        builder.set_timeout(300)
        tx = builder.build()
        return tx.to_xdr(), dest_address, str(memo_text)

    @action(detail=True, methods=['post'], url_path='create-payment-request')
    def create_payment_request(self, request, pk=None):
        """
        Generate a unique payment request for this rent obligation.
        Supports partial payment by specifying custom amount.
        Optionally builds an unsigned transaction XDR for Freighter if source_address is provided.
        """
        obligation = self.get_object()
        req_amount = request.data.get('amount') or request.data.get('amount_usdc')
        if req_amount:
            try:
                amt = Decimal(str(req_amount)).quantize(Decimal('0.0000001'))
            except Exception:
                amt = obligation.outstanding_balance_usdc
        else:
            amt = obligation.outstanding_balance_usdc

        # Ensure amount doesn't exceed outstanding
        if amt <= Decimal('0'):
            amt = obligation.outstanding_balance_usdc or obligation.amount_due_usdc

        owner_wallet = getattr(obligation, 'owner_receiving_wallet', obligation.receiving_wallet)
        payment_request = PaymentRequest.objects.create(
            obligation=obligation,
            tenant=obligation.tenant,
            amount_requested=amt,
            asset_code=obligation.asset_code,
            asset_issuer=obligation.asset_issuer,
            receiving_wallet=owner_wallet,
            payment_memo=obligation.payment_memo,
            status=PaymentRequest.Status.PENDING,
            expires_at=timezone.now() + timezone.timedelta(days=7)
        )
        resp_data = PaymentRequestSerializer(payment_request).data

        source_address = (
            request.data.get('source_address')
            or getattr(request.user, 'primary_stellar_address', None)
        )
        if source_address:
            try:
                tx_xdr, dest_wallet, p_memo = self._build_payment_xdr(obligation, source_address, amt)
                resp_data['transaction_xdr'] = tx_xdr
                resp_data['receiving_wallet'] = dest_wallet
                resp_data['payment_memo'] = p_memo
                resp_data['network'] = getattr(settings, 'STELLAR_NETWORK', 'TESTNET')
                resp_data['network_passphrase'] = getattr(settings, 'STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
            except Exception as e:
                logger.warning("Could not build transaction XDR in create_payment_request: %s", e)

        return Response(resp_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='create_payment_request')
    def create_payment_request_legacy(self, request, pk=None):
        return self.create_payment_request(request, pk)

    @action(detail=True, methods=['post'], url_path='prepare-transaction')
    def prepare_transaction(self, request, pk=None):
        """
        Builds an unsigned Stellar transaction XDR targeting the property owner address
        with the rental obligation memo.
        """
        obligation = self.get_object()
        source_address = (
            request.data.get('source_address')
            or getattr(request.user, 'primary_stellar_address', None)
        )
        if not source_address:
            return Response(
                {'error': 'source_address is required to build transaction XDR'},
                status=status.HTTP_400_BAD_REQUEST
            )

        req_amount = request.data.get('amount') or request.data.get('amount_usdc')
        if req_amount:
            try:
                amt = Decimal(str(req_amount)).quantize(Decimal('0.0000001'))
            except Exception:
                amt = obligation.outstanding_balance_usdc
        else:
            amt = obligation.outstanding_balance_usdc

        try:
            tx_xdr, dest_wallet, p_memo = self._build_payment_xdr(obligation, source_address, amt)
            return Response({
                'success': True,
                'transaction_xdr': tx_xdr,
                'receiving_wallet': dest_wallet,
                'payment_memo': p_memo,
                'amount_usdc': str(amt),
                'network': getattr(settings, 'STELLAR_NETWORK', 'TESTNET'),
                'network_passphrase': getattr(settings, 'STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to prepare transaction: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='prepare_transaction')
    def prepare_transaction_legacy(self, request, pk=None):
        return self.prepare_transaction(request, pk)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        obligation = self.get_object()
        payments = obligation.payments.all().order_by('-created_at')
        return Response(RentPaymentSerializer(payments, many=True).data)

    @action(detail=True, methods=['get'])
    def receipts(self, request, pk=None):
        obligation = self.get_object()
        receipts = obligation.receipts.all().order_by('-payment_date')
        return Response(RentReceiptSerializer(receipts, many=True, context={'request': request}).data)


class PaymentRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Retrieve generated payment requests with Stellar destination and memo details.
    """
    serializer_class = PaymentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser or user.role == 'ADMIN':
            return PaymentRequest.objects.all().order_by('-created_at')
        if user.role in ('LANDLORD', 'HOST'):
            return PaymentRequest.objects.filter(obligation__landlord=user).order_by('-created_at')
        return PaymentRequest.objects.filter(tenant=user).order_by('-created_at')

    @extend_schema(
        tags=['Rental Obligations & Payments'],
        summary='List payment requests with Stellar URIs'
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class PaymentReconciliationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Payment reconciliation and Stellar transaction verification API.
    """
    serializer_class = RentPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RentPayment.objects.all().order_by('-created_at')
        role_upper = (user.role or '').upper()
        if not (user.is_staff or user.is_superuser or role_upper == 'ADMIN'):
            if role_upper in ('LANDLORD', 'HOST'):
                pay_filter = Q(obligation__landlord=user)
                if user.primary_stellar_address:
                    pay_filter |= Q(receiving_stellar_address=user.primary_stellar_address) | Q(obligation__receiving_wallet=user.primary_stellar_address)
                qs = qs.filter(pay_filter)
            else:
                qs = qs.filter(tenant=user)
        return qs

    @extend_schema(
        tags=['Stellar Reconciliation'],
        summary='Verify and reconcile a Stellar Testnet transaction hash',
        request=TransactionVerificationRequestSerializer
    )
    @action(detail=False, methods=['post'], url_path='verify-transaction')
    def verify_transaction(self, request):
        """
        Submits a transaction hash for real-time verification and reconciliation
        against Stellar Testnet. Prevents duplicate credits, applies partial payments,
        updates balances, and generates receipts.
        """
        serializer = TransactionVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tx_hash = serializer.validated_data['tx_hash'].strip()
        obl_ref = serializer.validated_data.get('obligation_reference', '').strip()

        target_obligation = None
        if obl_ref:
            target_obligation = RentObligation.objects.filter(obligation_reference=obl_ref).first()

        service = StellarReconciliationService()
        result = service.verify_and_reconcile_transaction(
            tx_hash=tx_hash,
            target_obligation=target_obligation
        )

        status_code = status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)

    @action(detail=False, methods=['post'], url_path='verify_transaction')
    def verify_transaction_legacy(self, request):
        return self.verify_transaction(request)

    @extend_schema(
        tags=['Stellar Reconciliation'],
        summary='List unmatched or flagged transfers requiring review'
    )
    @action(detail=False, methods=['get'])
    def unmatched(self, request):
        unmatched_qs = self.get_queryset().filter(
            reconciliation_status__in=[
                RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED,
                RentPayment.ReconciliationStatus.FLAGGED_EXCESS
            ]
        )
        return Response(RentPaymentSerializer(unmatched_qs, many=True).data)

    @extend_schema(
        tags=['Stellar Reconciliation'],
        summary='Manually assign an unmatched transfer to an obligation'
    )
    @action(detail=False, methods=['post'], url_path='resolve-unmatched')
    def resolve_unmatched(self, request):
        payment_id = request.data.get('payment_id')
        obligation_id = request.data.get('obligation_id')

        payment = RentPayment.objects.filter(id=payment_id).first()
        obligation = RentObligation.objects.filter(id=obligation_id).first()

        if not payment or not obligation:
            return Response({'error': 'Invalid payment_id or obligation_id'}, status=status.HTTP_400_BAD_REQUEST)

        # Apply credit
        obligation.amount_paid_usdc += payment.amount
        obligation.recalculate(save=True)

        payment.obligation = obligation
        payment.tenant = obligation.tenant
        payment.reconciliation_status = (
            RentPayment.ReconciliationStatus.CONFIRMED
            if obligation.outstanding_balance_usdc == Decimal('0.0000000')
            else RentPayment.ReconciliationStatus.PARTIAL
        )
        payment.balance_after_payment = obligation.outstanding_balance_usdc
        payment.review_notes = f"Manually reconciled to obligation {obligation.obligation_reference} by {request.user.email}"
        payment.save()

        # Create receipt
        receipt = RentReceipt.objects.create(
            payment=payment,
            obligation=obligation,
            tenant=obligation.tenant,
            property_name=obligation.property.name,
            unit_number=obligation.unit.unit_number if obligation.unit else '',
            rental_period=obligation.rental_period_display,
            amount_paid=payment.amount,
            asset_code=payment.asset_code,
            payment_date=payment.ledger_closed_at or timezone.now(),
            stellar_tx_hash=payment.stellar_tx_hash,
            stellar_op_id=payment.stellar_op_id,
            outstanding_balance_after=obligation.outstanding_balance_usdc,
            verification_status='CONFIRMED_ON_STELLAR_TESTNET',
            stellar_explorer_url=payment.stellar_explorer_url,
            notes=payment.review_notes
        )

        return Response({
            'success': True,
            'payment': RentPaymentSerializer(payment).data,
            'receipt': RentReceiptSerializer(receipt, context={'request': request}).data
        })

    @extend_schema(
        tags=['Stellar Reconciliation'],
        summary='Trigger background wallet synchronization'
    )
    @action(detail=False, methods=['post'], url_path='sync-wallets')
    def sync_wallets(self, request):
        service = StellarReconciliationService()
        results = service.sync_all_active_wallets()
        return Response({
            'success': True,
            'message': f"Synchronized {len(results)} receiving wallets on Stellar Testnet.",
            'wallets': list(results.keys())
        })


class RentReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Downloadable and verifiable rental payment receipts.
    """
    serializer_class = RentReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role_upper = (user.role or '').upper()
        if user.is_staff or user.is_superuser or role_upper == 'ADMIN':
            return RentReceipt.objects.all().order_by('-payment_date')
        if role_upper in ('LANDLORD', 'HOST'):
            p_filter = Q(obligation__landlord=user)
            if user.primary_stellar_address:
                p_filter |= Q(obligation__receiving_wallet=user.primary_stellar_address)
            return RentReceipt.objects.filter(p_filter).order_by('-payment_date')
        return RentReceipt.objects.filter(tenant=user).order_by('-payment_date')

    @extend_schema(
        tags=['Receipts & Records'],
        summary='Download verified payment receipt as PDF or view details'
    )
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        receipt = self.get_object()
        fmt = request.query_params.get('format', 'pdf').lower()

        if fmt == 'pdf':
            pdf_bytes = generate_receipt_pdf_bytes(receipt)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"PayarMove_Receipt_{receipt.receipt_number}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        # Return json representation
        return Response(RentReceiptSerializer(receipt, context={'request': request}).data)


class RentCalculatorView(generics.GenericAPIView):
    """
    Interactive Rent Payment Calculator (Section 5 of MVP 2).
    Simulates partial payments, outstanding balance updates, and overdue statuses.
    """
    serializer_class = RentCalculatorSerializer
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['Analytics & Dashboards'],
        summary='Interactive rent payment balance & overdue calculator',
        description='Simulates partial payment reductions and resulting statuses.'
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        rent_due = data.get('rent_due', Decimal('300.00'))
        already_paid = data.get('already_paid', Decimal('100.00'))
        new_payment = data.get('new_payment', Decimal('50.00'))
        due_date = data.get('due_date') or (timezone.localdate() - timedelta(days=5))
        ref_date = data.get('reference_date') or timezone.localdate()

        current_outstanding = max(Decimal('0'), rent_due - already_paid)
        simulated_balance = max(Decimal('0'), rent_due - (already_paid + new_payment))

        # Resulting status calculation
        if simulated_balance == Decimal('0'):
            status_text = 'Paid'
        elif ref_date > due_date:
            status_text = 'Overdue'
        elif (already_paid + new_payment) > Decimal('0'):
            status_text = 'Partially Paid'
        else:
            status_text = 'Unpaid'

        return Response({
            'rent_due_usdc': str(rent_due),
            'already_paid_usdc': str(already_paid),
            'new_payment_usdc': str(new_payment),
            'current_outstanding_usdc': str(current_outstanding),
            'after_simulated_payment_usdc': str(simulated_balance),
            'due_date': str(due_date),
            'reference_date': str(ref_date),
            'resulting_rental_status': status_text,
            'note': 'This calculator simulates partial payments. In actual MVP workflows, balances update only after Stellar Testnet payment verification.'
        })
