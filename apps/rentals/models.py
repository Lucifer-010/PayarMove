from django.db import models
from django.conf import settings
from decimal import Decimal
import secrets
from apps.core.models import TimestampedBaseModel

class Vehicle(TimestampedBaseModel):
    class Category(models.TextChoices):
        SUV = 'SUV', 'SUV'
        SEDAN = 'Sedan', 'Sedan'
        COMPACT = 'Compact', 'Compact'
        VAN = 'Van', 'Van'
        LUXURY = 'Luxury', 'Luxury'
        ELECTRIC = 'Electric', 'Electric'

    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='vehicles')
    make_model = models.CharField(max_length=100) # e.g. "Mercedes-Benz G-Class G63 AMG"
    registration_number = models.CharField(max_length=50) # e.g. "KDA 123X"
    location = models.CharField(max_length=150, default='Westlands, Nairobi, Kenya')
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.SUV)
    year = models.PositiveIntegerField(default=2024)

    # Detailed vehicle specifications
    seats = models.PositiveIntegerField(default=5)
    doors = models.PositiveIntegerField(default=4)
    transmission = models.CharField(max_length=30, default='Automatic')
    fuel_type = models.CharField(max_length=30, default='Gasoline')

    # Metrics & Ratings
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('5.00'))
    reviews_count = models.PositiveIntegerField(default=14)
    trips_count = models.PositiveIntegerField(default=28)

    # Pricing in USDC
    daily_rate_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('50.0000000'))
    hourly_rate_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('15.0000000'))
    deposit_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('100.0000000'))

    # Logistics & Media
    pickup_instructions = models.TextField(
        default='Instant unlock via Stellar Soroban smart lock code after escrow funding. Pick up from verified secure parking.'
    )
    image_url = models.TextField(blank=True, null=True)
    images = models.JSONField(default=list, blank=True)
    features = models.JSONField(default=list, blank=True)
    rules = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.hourly_rate_usdc or self.hourly_rate_usdc == Decimal('15.0000000'):
            self.hourly_rate_usdc = (self.daily_rate_usdc / Decimal('24')).quantize(Decimal('0.0000001'))
        if self.image_url and (not self.images or len(self.images) == 0):
            self.images = [self.image_url]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.make_model} ({self.location}) - Host: {self.host.email}"


class SavedVehicle(TimestampedBaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_vehicles')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='favorited_by')

    class Meta:
        unique_together = ('user', 'vehicle')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} saved {self.vehicle.make_model}"


class Rental(TimestampedBaseModel):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        AWAITING_PAYMENT = 'AWAITING_PAYMENT', 'Awaiting Escrow Deposit'
        CONFIRMED = 'CONFIRMED', 'Confirmed & Funded'
        ACTIVE = 'ACTIVE', 'Active / In Progress'
        COMPLETED = 'COMPLETED', 'Completed & Settled'
        CANCELLED = 'CANCELLED', 'Cancelled & Refunded'
        DISPUTED = 'DISPUTED', 'Dispute Pending Arbitration'

    rental_code = models.CharField(max_length=30, unique=True, db_index=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name='rentals')
    renter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='renter_bookings')
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='host_bookings')
    
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.CharField(max_length=10, default='09:00', blank=True)
    end_time = models.CharField(max_length=10, default='11:00', blank=True)
    total_days = models.PositiveIntegerField(default=1)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('24.00'))

    rental_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7)
    deposit_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7)
    total_due_usdc = models.DecimalField(max_digits=18, decimal_places=7)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)

    def save(self, *args, **kwargs):
        if not self.rental_code:
            random_suffix = secrets.token_hex(3).upper()
            self.rental_code = f"RENT-{random_suffix}"
        
        # Calculate pricing and duration
        if self.start_date and self.end_date:
            from datetime import date, datetime
            s_date = self.start_date
            if isinstance(s_date, str):
                s_date = datetime.strptime(s_date, "%Y-%m-%d").date()
            e_date = self.end_date
            if isinstance(e_date, str):
                e_date = datetime.strptime(e_date, "%Y-%m-%d").date()

            delta = (e_date - s_date).days
            self.total_days = max(1, delta)

            # Determine total_hours if not explicitly provided, <= 0, or default 24 with multi-day
            if not self.total_hours or Decimal(str(self.total_hours)) <= 0 or (self.total_days > 1 and self.total_hours == Decimal('24.00')):
                try:
                    s_str = f"{s_date} {self.start_time or '09:00'}"
                    e_str = f"{e_date} {self.end_time or '11:00'}"
                    dt_start = datetime.strptime(s_str, "%Y-%m-%d %H:%M")
                    dt_end = datetime.strptime(e_str, "%Y-%m-%d %H:%M")
                    diff_secs = (dt_end - dt_start).total_seconds()
                    calc_h = max(1, round(diff_secs / 3600))
                    self.total_hours = Decimal(str(calc_h))
                except Exception:
                    self.total_hours = Decimal(str(self.total_days * 24))

            hours_dec = Decimal(str(self.total_hours))

            # Hourly rate from vehicle (fallback to daily / 24)
            hourly = self.vehicle.hourly_rate_usdc
            if not hourly or hourly <= 0:
                hourly = (self.vehicle.daily_rate_usdc / Decimal('24')).quantize(Decimal('0.0000001'))

            # Compute rental amount based on days or custom hours
            if not self.rental_amount_usdc or self.rental_amount_usdc <= 0:
                if self.total_days > 0 and (not self.start_time or self.start_time == '09:00') and (not self.end_time or self.end_time == '11:00'):
                    self.rental_amount_usdc = (self.vehicle.daily_rate_usdc * Decimal(str(self.total_days))).quantize(Decimal('0.0000001'))
                else:
                    self.rental_amount_usdc = (hourly * hours_dec).quantize(Decimal('0.0000001'))

            if not self.deposit_amount_usdc or self.deposit_amount_usdc <= 0:
                self.deposit_amount_usdc = self.vehicle.deposit_amount_usdc

            self.total_due_usdc = (self.rental_amount_usdc + self.deposit_amount_usdc).quantize(Decimal('0.0000001'))

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.rental_code}: {self.vehicle.make_model} ({self.status}) - {self.total_hours} hrs"


# ============================================================================
# PayarMove MVP 2: Rental Schedule Management & Stellar Property Rental Models
# ============================================================================

import calendar
from datetime import date, datetime, timedelta
from django.utils import timezone


import builtins


def add_months(source_date, months):
    """Safely adds months to a date handling variable month lengths."""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class Property(TimestampedBaseModel):
    """
    Rental property record managed by a landlord or property manager.
    """
    class PropertyType(models.TextChoices):
        APARTMENT = 'APARTMENT', 'Apartment / Flat'
        RESIDENTIAL_HOUSE = 'RESIDENTIAL_HOUSE', 'Single-Family House'
        MULTI_FAMILY = 'MULTI_FAMILY', 'Multi-Family Complex'
        COMMERCIAL = 'COMMERCIAL', 'Commercial / Office Space'
        VILLA = 'VILLA', 'Villa'
        STUDIO = 'STUDIO', 'Studio Unit'
        OTHER = 'OTHER', 'Other Property'

    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='managed_properties'
    )
    name = models.CharField(max_length=150)
    property_type = models.CharField(
        max_length=30,
        choices=PropertyType.choices,
        default=PropertyType.APARTMENT
    )
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, default='Nairobi')
    state_province = models.CharField(max_length=100, blank=True, default='')
    postal_code = models.CharField(max_length=30, blank=True, default='')
    country = models.CharField(max_length=100, default='Kenya')
    description = models.TextField(blank=True, default='')

    # Receiving wallet on Stellar Testnet for rent collections
    receiving_wallet = models.CharField(
        max_length=56,
        help_text="Stellar Testnet G... public key for rent payments"
    )
    default_asset_code = models.CharField(max_length=12, default='USDC')
    default_asset_issuer = models.CharField(
        max_length=56,
        blank=True,
        default='GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    )

    image_url = models.TextField(blank=True, null=True)
    images = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Properties'

    def save(self, *args, **kwargs):
        if not self.receiving_wallet and self.landlord and getattr(self.landlord, 'primary_stellar_address', None):
            self.receiving_wallet = self.landlord.primary_stellar_address
        if not self.receiving_wallet:
            self.receiving_wallet = getattr(settings, 'STELLAR_SERVER_PUBLIC_KEY', 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT')
        if self.image_url and (not self.images or len(self.images) == 0):
            self.images = [self.image_url]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.city}) - Landlord: {self.landlord.email}"


class RentalUnit(TimestampedBaseModel):
    """
    Specific unit or room within a property.
    """
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='units'
    )
    unit_number = models.CharField(max_length=50, help_text="e.g. Apt 4B, Unit 101, Penthouse")
    floor = models.CharField(max_length=30, blank=True, default='')
    bedrooms = models.PositiveIntegerField(default=1)
    bathrooms = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('1.0'))
    square_feet = models.PositiveIntegerField(null=True, blank=True)
    rent_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('300.0000000'))
    deposit_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('0.0000000'))
    is_occupied = models.BooleanField(default=False)
    current_tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rented_units'
    )

    class Meta:
        ordering = ['unit_number']
        unique_together = ('property', 'unit_number')

    def __str__(self):
        return f"{self.property.name} - Unit {self.unit_number}"


class TenantAssignment(TimestampedBaseModel):
    """
    Assigns a tenant to a property or rental unit.
    """
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active Tenancy'
        PENDING = 'PENDING', 'Pending Commencement'
        TERMINATED = 'TERMINATED', 'Terminated'
        COMPLETED = 'COMPLETED', 'Completed / Expired'

    class PaymentFrequency(models.TextChoices):
        MONTHLY = 'MONTHLY', 'Monthly'
        QUARTERLY = 'QUARTERLY', 'Quarterly'
        BI_ANNUAL = 'BI_ANNUAL', 'Bi-Annual (Every 6 Months)'
        ANNUAL = 'ANNUAL', 'Annual (Yearly)'
        WEEKLY = 'WEEKLY', 'Weekly'

    assignment_code = models.CharField(max_length=32, unique=True, db_index=True)
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    unit = models.ForeignKey(
        RentalUnit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assignments'
    )
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='landlord_assignments'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='tenant_assignments'
    )
    rent_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7)
    deposit_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('0.0000000'))
    payment_frequency = models.CharField(
        max_length=20,
        choices=PaymentFrequency.choices,
        default=PaymentFrequency.MONTHLY
    )
    billing_day_of_month = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    receiving_wallet = models.CharField(max_length=56)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.assignment_code:
            self.assignment_code = f"ASG-{secrets.token_hex(4).upper()}"
        if not self.receiving_wallet:
            self.receiving_wallet = self.property.receiving_wallet
        if self.unit:
            self.unit.is_occupied = (self.status == self.Status.ACTIVE)
            self.unit.current_tenant = self.tenant if self.status == self.Status.ACTIVE else None
            self.unit.save(update_fields=['is_occupied', 'current_tenant'])
        super().save(*args, **kwargs)

    def __str__(self):
        unit_str = f" - Unit {self.unit.unit_number}" if self.unit else ""
        return f"{self.assignment_code}: {self.tenant.email} at {self.property.name}{unit_str}"


class RentalSchedule(TimestampedBaseModel):
    """
    Configures recurring rent obligations, due dates, amounts, frequencies, and wallets.
    """
    schedule_code = models.CharField(max_length=32, unique=True, db_index=True)
    assignment = models.OneToOneField(
        TenantAssignment,
        on_delete=models.CASCADE,
        related_name='schedule'
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    unit = models.ForeignKey(
        RentalUnit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='schedules'
    )
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='landlord_schedules'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='tenant_schedules'
    )

    rent_amount_usdc = models.DecimalField(max_digits=18, decimal_places=7)
    asset_code = models.CharField(max_length=12, default='USDC')
    asset_issuer = models.CharField(max_length=56, blank=True, default='')

    frequency = models.CharField(
        max_length=20,
        choices=TenantAssignment.PaymentFrequency.choices,
        default=TenantAssignment.PaymentFrequency.MONTHLY
    )
    first_payment_date = models.DateField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    receiving_wallet = models.CharField(max_length=56)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.schedule_code:
            self.schedule_code = f"SCH-{secrets.token_hex(4).upper()}"
        if not self.property_id and self.assignment:
            self.property = self.assignment.property
        if not self.unit_id and self.assignment and self.assignment.unit:
            self.unit = self.assignment.unit
        if not self.landlord_id and self.assignment:
            self.landlord = self.assignment.landlord
        if not self.tenant_id and self.assignment:
            self.tenant = self.assignment.tenant
        if not self.rent_amount_usdc and self.assignment:
            self.rent_amount_usdc = self.assignment.rent_amount_usdc
        if not self.receiving_wallet and self.assignment:
            self.receiving_wallet = self.assignment.receiving_wallet
        if not self.asset_issuer:
            self.asset_issuer = getattr(
                settings,
                'STELLAR_USDC_ISSUER',
                'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
            )
        super().save(*args, **kwargs)

    def generate_obligations(self, count=1, up_to_date=None):
        """
        Generates recurring rent obligations based on the configured schedule.
        """
        generated = []
        current_date = self.first_payment_date

        # Determine interval in months
        step_months = 1
        if self.frequency == TenantAssignment.PaymentFrequency.QUARTERLY:
            step_months = 3
        elif self.frequency == TenantAssignment.PaymentFrequency.BI_ANNUAL:
            step_months = 6
        elif self.frequency == TenantAssignment.PaymentFrequency.ANNUAL:
            step_months = 12

        # Check existing obligations to avoid duplicates
        existing_due_dates = set(
            self.obligations.values_list('due_date', flat=True)
        )

        iterations = 0
        max_iterations = count or 12

        while iterations < max_iterations:
            if up_to_date and current_date > up_to_date:
                break
            if self.end_date and current_date > self.end_date:
                break

            if current_date not in existing_due_dates:
                # Compute period boundaries
                if self.frequency == TenantAssignment.PaymentFrequency.WEEKLY:
                    period_start = current_date
                    period_end = current_date + timedelta(days=6)
                else:
                    period_start = date(current_date.year, current_date.month, 1)
                    period_end = add_months(period_start, step_months) - timedelta(days=1)

                memo_suffix = secrets.token_hex(4).upper()
                payment_memo = f"PM-{memo_suffix}"

                obligation = RentObligation(
                    schedule=self,
                    assignment=self.assignment,
                    property=self.property,
                    unit=self.unit,
                    landlord=self.landlord,
                    tenant=self.tenant,
                    period_start_date=period_start,
                    period_end_date=period_end,
                    due_date=current_date,
                    amount_due_usdc=self.rent_amount_usdc,
                    amount_paid_usdc=Decimal('0.0000000'),
                    outstanding_balance_usdc=self.rent_amount_usdc,
                    asset_code=self.asset_code,
                    asset_issuer=self.asset_issuer,
                    receiving_wallet=self.receiving_wallet,
                    payment_memo=payment_memo,
                )
                obligation.recalculate(save=False)
                obligation.save()
                generated.append(obligation)
                existing_due_dates.add(current_date)

            # Advance date
            if self.frequency == TenantAssignment.PaymentFrequency.WEEKLY:
                current_date = current_date + timedelta(days=7)
            else:
                current_date = add_months(current_date, step_months)
            iterations += 1

        return generated

    def __str__(self):
        return f"{self.schedule_code} - {self.tenant.email} ({self.frequency} {self.rent_amount_usdc} {self.asset_code})"


class RentObligation(TimestampedBaseModel):
    """
    Individual rent obligation for a specific billing period.
    Supports partial payments, automatic outstanding balance recalculation,
    and due-date / overdue tracking.
    """
    class Status(models.TextChoices):
        UPCOMING = 'UPCOMING', 'Upcoming (Not Yet Due)'
        UNPAID = 'UNPAID', 'Unpaid (Due)'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid in Full'
        OVERDUE = 'OVERDUE', 'Overdue'

    obligation_reference = models.CharField(max_length=36, unique=True, db_index=True)
    schedule = models.ForeignKey(
        RentalSchedule,
        on_delete=models.CASCADE,
        related_name='obligations'
    )
    assignment = models.ForeignKey(
        TenantAssignment,
        on_delete=models.CASCADE,
        related_name='obligations'
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='obligations'
    )
    unit = models.ForeignKey(
        RentalUnit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='obligations'
    )
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='landlord_obligations'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='tenant_obligations'
    )

    period_start_date = models.DateField()
    period_end_date = models.DateField()
    due_date = models.DateField(db_index=True)

    amount_due_usdc = models.DecimalField(max_digits=18, decimal_places=7)
    amount_paid_usdc = models.DecimalField(max_digits=18, decimal_places=7, default=Decimal('0.0000000'))
    outstanding_balance_usdc = models.DecimalField(max_digits=18, decimal_places=7)

    asset_code = models.CharField(max_length=12, default='USDC')
    asset_issuer = models.CharField(max_length=56, blank=True, default='')
    receiving_wallet = models.CharField(max_length=56)

    # Unique 28-character max Stellar memo for payment matching
    payment_memo = models.CharField(max_length=28, unique=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING,
        db_index=True
    )

    class Meta:
        ordering = ['due_date', '-created_at']

    def recalculate(self, save=True):
        """
        Updates outstanding balance and computes lifecycle status.
        Formula: OutstandingRent = max(0, AmountDue - VerifiedPayments)
        Overdue status is calculated independently of payment progress:
        due date passed with outstanding balance > 0 -> OVERDUE.
        """
        self.amount_paid_usdc = max(Decimal('0.0000000'), Decimal(str(self.amount_paid_usdc)))
        self.outstanding_balance_usdc = max(
            Decimal('0.0000000'),
            (self.amount_due_usdc - self.amount_paid_usdc).quantize(Decimal('0.0000001'))
        )

        today = timezone.localdate()

        if self.outstanding_balance_usdc == Decimal('0.0000000'):
            self.status = self.Status.PAID
        elif today > self.due_date and self.outstanding_balance_usdc > Decimal('0.0000000'):
            self.status = self.Status.OVERDUE
        elif self.amount_paid_usdc > Decimal('0.0000000'):
            self.status = self.Status.PARTIALLY_PAID
        elif today >= self.due_date:
            self.status = self.Status.UNPAID
        else:
            self.status = self.Status.UPCOMING

        if save and self.pk:
            self.save(update_fields=['amount_paid_usdc', 'outstanding_balance_usdc', 'status', 'updated_at'])

    def save(self, *args, **kwargs):
        if not self.obligation_reference:
            year = self.due_date.year if self.due_date else timezone.now().year
            rand_code = secrets.token_hex(3).upper()
            self.obligation_reference = f"OBL-{year}-{rand_code}"
        if not self.payment_memo:
            self.payment_memo = f"PM-{secrets.token_hex(4).upper()}"
        if self.outstanding_balance_usdc is None:
            self.outstanding_balance_usdc = max(
                Decimal('0.0000000'),
                self.amount_due_usdc - (self.amount_paid_usdc or Decimal('0.0000000'))
            )
        super().save(*args, **kwargs)

    @builtins.property
    def is_overdue(self):
        return timezone.localdate() > self.due_date and self.outstanding_balance_usdc > Decimal('0.0000000')

    @builtins.property
    def is_fully_paid(self):
        return self.outstanding_balance_usdc == Decimal('0.0000000')

    @builtins.property
    def rental_period_display(self):
        return f"{self.period_start_date.strftime('%b %d, %Y')} – {self.period_end_date.strftime('%b %d, %Y')}"

    def __str__(self):
        return f"{self.obligation_reference} - {self.tenant.email} ({self.status}: {self.amount_paid_usdc}/{self.amount_due_usdc} {self.asset_code})"


class PaymentRequest(TimestampedBaseModel):
    """
    Generated payment request for a specific rental obligation.
    Provides Stellar payment destination, asset, requested amount, memo,
    and clickable/scannable Stellar URI.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Payment'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid in Full'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'

    request_reference = models.CharField(max_length=36, unique=True, db_index=True)
    obligation = models.ForeignKey(
        RentObligation,
        on_delete=models.CASCADE,
        related_name='payment_requests'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='payment_requests'
    )
    amount_requested = models.DecimalField(max_digits=18, decimal_places=7)
    asset_code = models.CharField(max_length=12, default='USDC')
    asset_issuer = models.CharField(max_length=56, blank=True, default='')
    receiving_wallet = models.CharField(max_length=56)
    payment_memo = models.CharField(max_length=28, db_index=True)
    memo_type = models.CharField(max_length=12, default='MEMO_TEXT')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.request_reference:
            year = timezone.now().year
            self.request_reference = f"REQ-{year}-{secrets.token_hex(3).upper()}"
        if not self.payment_memo and self.obligation:
            self.payment_memo = self.obligation.payment_memo
        if not self.receiving_wallet and self.obligation:
            self.receiving_wallet = self.obligation.receiving_wallet
        if not self.asset_code and self.obligation:
            self.asset_code = self.obligation.asset_code
        if not self.asset_issuer and self.obligation:
            self.asset_issuer = self.obligation.asset_issuer
        super().save(*args, **kwargs)

    @property
    def stellar_uri(self):
        """
        Standard SEP-0007 / web+stellar URI for instant wallet payments.
        """
        uri = f"web+stellar:pay?destination={self.receiving_wallet}&amount={self.amount_requested}&asset_code={self.asset_code}"
        if self.asset_issuer:
            uri += f"&asset_issuer={self.asset_issuer}"
        if self.payment_memo:
            uri += f"&memo={self.payment_memo}&memo_type=MEMO_TEXT"
        return uri

    def __str__(self):
        return f"{self.request_reference}: {self.amount_requested} {self.asset_code} for {self.obligation.obligation_reference}"


class RentPayment(TimestampedBaseModel):
    """
    Record of a verified Stellar Testnet rental payment.
    Tracks individual payment operations (preventing duplicate credits),
    links to obligation, updates balances, and preserves raw transaction details.
    """
    class ReconciliationStatus(models.TextChoices):
        CONFIRMED = 'CONFIRMED', 'Confirmed & Reconciled'
        PARTIAL = 'PARTIAL', 'Partial Payment Reconciled'
        FLAGGED_UNMATCHED = 'FLAGGED_UNMATCHED', 'Flagged - Unmatched Transfer'
        FLAGGED_EXCESS = 'FLAGGED_EXCESS', 'Flagged - Excess / Overpayment'
        REJECTED = 'REJECTED', 'Rejected'

    payment_reference = models.CharField(max_length=36, unique=True, db_index=True)
    obligation = models.ForeignKey(
        RentObligation,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='payments'
    )
    payment_request = models.ForeignKey(
        PaymentRequest,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='payments'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rent_payments'
    )

    payer_stellar_address = models.CharField(max_length=56, db_index=True)
    receiving_stellar_address = models.CharField(max_length=56, db_index=True)
    amount = models.DecimalField(max_digits=18, decimal_places=7)
    asset_code = models.CharField(max_length=12, default='USDC')
    asset_issuer = models.CharField(max_length=56, blank=True, default='')

    # Blockchain tracking
    stellar_tx_hash = models.CharField(max_length=64, db_index=True)
    # Individual payment operation ID preventing duplicate credits in multi-op transactions
    stellar_op_id = models.CharField(max_length=64, unique=True, db_index=True)
    ledger_sequence = models.PositiveIntegerField(null=True, blank=True)
    ledger_closed_at = models.DateTimeField(null=True, blank=True)
    memo = models.CharField(max_length=64, blank=True, null=True)

    reconciliation_status = models.CharField(
        max_length=25,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.CONFIRMED,
        db_index=True
    )
    balance_after_payment = models.DecimalField(max_digits=18, decimal_places=7, null=True, blank=True)
    review_notes = models.TextField(blank=True, default='')
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-ledger_closed_at', '-created_at']

    def save(self, *args, **kwargs):
        if not self.payment_reference:
            year = timezone.now().year
            self.payment_reference = f"PAY-{year}-{secrets.token_hex(3).upper()}"
        super().save(*args, **kwargs)

    @property
    def stellar_explorer_url(self):
        return f"https://stellar.expert/explorer/testnet/tx/{self.stellar_tx_hash}"

    def __str__(self):
        return f"{self.payment_reference}: {self.amount} {self.asset_code} [{self.reconciliation_status}] - Tx: {self.stellar_tx_hash[:8]}..."


class RentReceipt(TimestampedBaseModel):
    """
    Downloadable and verifiable rental payment receipt.
    Includes all required fields: Receipt reference, Tenant identifier,
    Property/unit, Rental period, Amount/asset, Confirmed payment date,
    Stellar tx hash, Outstanding balance after payment, and Verification status.
    """
    receipt_number = models.CharField(max_length=36, unique=True, db_index=True)
    payment = models.OneToOneField(
        RentPayment,
        on_delete=models.CASCADE,
        related_name='receipt'
    )
    obligation = models.ForeignKey(
        RentObligation,
        on_delete=models.CASCADE,
        related_name='receipts'
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='rent_receipts'
    )

    property_name = models.CharField(max_length=150)
    unit_number = models.CharField(max_length=50, blank=True, default='')
    rental_period = models.CharField(max_length=100)
    amount_paid = models.DecimalField(max_digits=18, decimal_places=7)
    asset_code = models.CharField(max_length=12, default='USDC')
    payment_date = models.DateTimeField()
    stellar_tx_hash = models.CharField(max_length=64)
    stellar_op_id = models.CharField(max_length=64, blank=True, default='')
    outstanding_balance_after = models.DecimalField(max_digits=18, decimal_places=7)
    verification_status = models.CharField(
        max_length=40,
        default='CONFIRMED_ON_STELLAR_TESTNET'
    )
    stellar_explorer_url = models.URLField(max_length=255)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            year = timezone.now().year
            self.receipt_number = f"RCP-{year}-{secrets.token_hex(4).upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.receipt_number} for {self.tenant.email} ({self.amount_paid} {self.asset_code})"


class StellarReconciliationCursor(TimestampedBaseModel):
    """
    Persists the last processed Horizon paging token per receiving wallet.
    Preserves reconciliation records when the monitoring service restarts.
    """
    wallet_address = models.CharField(max_length=56, unique=True, db_index=True)
    last_paging_token = models.CharField(max_length=64, default='0')
    last_polled_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cursor for {self.wallet_address[:6]}...{self.wallet_address[-4:]}: {self.last_paging_token}"
