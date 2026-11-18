import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import User
from apps.rentals.models import (
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
from apps.rentals.services.stellar_reconciliation import StellarReconciliationService
from apps.rentals.services.receipt_generator import generate_receipt_pdf_bytes


class MVP2RentalAndReconciliationTests(TestCase):
    """
    Validation tests matching Section 6 of project_mvp2.txt:
    1. Create rental schedule
    2. Assign tenant to rental unit
    3. Generate recurring rent obligation
    4. Create payment request
    5. Make full Stellar payment
    6. Make partial payment
    7. Make multiple partial payments
    8. Payment with incorrect recipient
    9. Payment with incorrect asset
    10. Duplicate payment processing
    11. Payment without matching obligation
    12. Due date passes with balance (Overdue)
    13. Overpayment (Excess flagged)
    14. Generate downloadable receipt
    15. Transaction monitoring restarts (Cursor persistence)
    """

    def setUp(self):
        self.client = APIClient()

        # Users
        self.landlord = User.objects.create_user(
            email='landlord@test.com',
            username='landlord_test',
            password='Password123!',
            role=User.Role.LANDLORD,
            primary_stellar_address='GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK'
        )
        self.tenant = User.objects.create_user(
            email='tenant@test.com',
            username='tenant_test',
            password='Password123!',
            role=User.Role.TENANT,
            primary_stellar_address='GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT'
        )

        # Scenario 1 & 2: Property, Unit & Tenant Assignment
        self.property = Property.objects.create(
            landlord=self.landlord,
            name='Ocean View Heights',
            property_type=Property.PropertyType.APARTMENT,
            address='101 Beach Road',
            city='Mombasa',
            receiving_wallet=self.landlord.primary_stellar_address
        )

        self.unit = RentalUnit.objects.create(
            property=self.property,
            unit_number='Unit 3C',
            bedrooms=2,
            rent_amount_usdc=Decimal('300.0000000')
        )

        self.assignment = TenantAssignment.objects.create(
            property=self.property,
            unit=self.unit,
            landlord=self.landlord,
            tenant=self.tenant,
            rent_amount_usdc=Decimal('300.0000000'),
            start_date=timezone.localdate(),
            receiving_wallet=self.property.receiving_wallet
        )

        self.schedule = RentalSchedule.objects.create(
            assignment=self.assignment,
            property=self.property,
            unit=self.unit,
            landlord=self.landlord,
            tenant=self.tenant,
            rent_amount_usdc=Decimal('300.0000000'),
            first_payment_date=timezone.localdate(),
            start_date=timezone.localdate(),
            receiving_wallet=self.property.receiving_wallet
        )

    def test_scenario_1_and_2_schedule_and_tenant_assignment(self):
        """Test Scenario 1 & 2: Rental schedule saved and tenant linked correctly."""
        self.assertIsNotNone(self.schedule.schedule_code)
        self.assertEqual(self.assignment.tenant, self.tenant)
        self.assertEqual(self.unit.current_tenant, self.tenant)
        self.assertTrue(self.unit.is_occupied)

    def test_scenario_3_generate_recurring_obligation(self):
        """Test Scenario 3: Recurring rent obligation generated with unique reference."""
        obligations = self.schedule.generate_obligations(count=1)
        self.assertEqual(len(obligations), 1)
        obl = obligations[0]
        self.assertTrue(obl.obligation_reference.startswith('OBL-'))
        self.assertTrue(obl.payment_memo.startswith('PM-'))
        self.assertEqual(obl.amount_due_usdc, Decimal('300.0000000'))
        self.assertEqual(obl.outstanding_balance_usdc, Decimal('300.0000000'))

    def test_scenario_4_create_payment_request(self):
        """Test Scenario 4: Create payment request with correct amount and Stellar URI."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        req = PaymentRequest.objects.create(
            obligation=obl,
            tenant=self.tenant,
            amount_requested=Decimal('150.0000000') # partial payment request
        )
        self.assertEqual(req.payment_memo, obl.payment_memo)
        self.assertIn('web+stellar:pay', req.stellar_uri)
        self.assertIn('amount=150.0000000', req.stellar_uri)
        self.assertIn(obl.payment_memo, req.stellar_uri)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_5_full_stellar_payment(self, mock_details, mock_ops):
        """Test Scenario 5: Full Stellar payment marks obligation PAID with balance 0."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        tx_hash = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff'
        mock_details.return_value = ({
            'successful': True,
            'memo': obl.payment_memo,
            'ledger': 123456,
            'created_at': '2026-11-18T10:00:00Z'
        }, None)

        mock_ops.return_value = ([{
            'id': 'op_test_full_01',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '300.0000000',
            'asset_type': 'credit_alphanum4',
            'asset_code': 'USDC',
            'asset_issuer': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
        }], None)

        service = StellarReconciliationService()
        result = service.verify_and_reconcile_transaction(tx_hash)

        self.assertTrue(result['success'])
        obl.refresh_from_db()
        self.assertEqual(obl.amount_paid_usdc, Decimal('300.0000000'))
        self.assertEqual(obl.outstanding_balance_usdc, Decimal('0.0000000'))
        self.assertEqual(obl.status, RentObligation.Status.PAID)
        self.assertTrue(RentReceipt.objects.filter(obligation=obl).exists())

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_6_and_7_multiple_partial_payments(self, mock_details, mock_ops):
        """Test Scenario 6 & 7: Multiple partial payments update cumulative balance accurately."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        service = StellarReconciliationService()

        # 1st payment: 100 USDC -> outstanding becomes 200 USDC
        mock_details.return_value = ({
            'successful': True,
            'memo': obl.payment_memo,
            'ledger': 123456,
            'created_at': '2026-11-18T10:00:00Z'
        }, None)
        mock_ops.return_value = ([{
            'id': 'op_test_part_01',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '100.0000000',
            'asset_code': 'USDC'
        }], None)

        service.verify_and_reconcile_transaction('hash_part_1')
        obl.refresh_from_db()
        self.assertEqual(obl.amount_paid_usdc, Decimal('100.0000000'))
        self.assertEqual(obl.outstanding_balance_usdc, Decimal('200.0000000'))
        self.assertEqual(obl.status, RentObligation.Status.PARTIALLY_PAID)

        # 2nd payment: 150 USDC -> outstanding becomes 50 USDC
        mock_ops.return_value = ([{
            'id': 'op_test_part_02',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '150.0000000',
            'asset_code': 'USDC'
        }], None)

        service.verify_and_reconcile_transaction('hash_part_2')
        obl.refresh_from_db()
        self.assertEqual(obl.amount_paid_usdc, Decimal('250.0000000'))
        self.assertEqual(obl.outstanding_balance_usdc, Decimal('50.0000000'))
        self.assertEqual(obl.status, RentObligation.Status.PARTIALLY_PAID)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_8_incorrect_recipient(self, mock_details, mock_ops):
        """Test Scenario 8: Payment with incorrect recipient wallet is flagged as unmatched."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        mock_details.return_value = ({'successful': True, 'memo': obl.payment_memo}, None)
        mock_ops.return_value = ([{
            'id': 'op_test_wrong_recip',
            'type': 'payment',
            'to': 'G_UNKNOWN_STRANGER_WALLET_NOT_REGISTERED_IN_PAYARMOVE',
            'from': self.tenant.primary_stellar_address,
            'amount': '300.0000000',
            'asset_code': 'USDC'
        }], None)

        service = StellarReconciliationService()
        result = service.verify_and_reconcile_transaction('hash_wrong_recipient')

        self.assertTrue(result['success'])
        p = RentPayment.objects.get(stellar_op_id='op_test_wrong_recip')
        self.assertEqual(p.reconciliation_status, RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_9_incorrect_asset(self, mock_details, mock_ops):
        """Test Scenario 9: Payment with unexpected asset (e.g. BTC/ETH on testnet) is rejected."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        mock_details.return_value = ({'successful': True, 'memo': obl.payment_memo}, None)
        mock_ops.return_value = ([{
            'id': 'op_test_wrong_asset',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '300.0000000',
            'asset_code': 'DOGE'
        }], None)

        service = StellarReconciliationService()
        service.verify_and_reconcile_transaction('hash_wrong_asset')

        p = RentPayment.objects.get(stellar_op_id='op_test_wrong_asset')
        self.assertEqual(p.reconciliation_status, RentPayment.ReconciliationStatus.REJECTED)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_10_duplicate_payment_prevention(self, mock_details, mock_ops):
        """Test Scenario 10: Reprocessing the same operation credits funds only once."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        mock_details.return_value = ({'successful': True, 'memo': obl.payment_memo}, None)
        mock_ops.return_value = ([{
            'id': 'op_test_dup_001',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '100.0000000',
            'asset_code': 'USDC'
        }], None)

        service = StellarReconciliationService()
        # First call: credits 100 USDC
        service.verify_and_reconcile_transaction('hash_dup_test')
        obl.refresh_from_db()
        self.assertEqual(obl.amount_paid_usdc, Decimal('100.0000000'))

        # Second call with same operation ID: should NOT credit again
        res2 = service.verify_and_reconcile_transaction('hash_dup_test')
        self.assertEqual(res2['processed_payments'][0]['status'], 'ALREADY_PROCESSED')
        obl.refresh_from_db()
        self.assertEqual(obl.amount_paid_usdc, Decimal('100.0000000'))
        self.assertEqual(RentPayment.objects.filter(stellar_op_id='op_test_dup_001').count(), 1)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_11_payment_without_matching_obligation(self, mock_details, mock_ops):
        """Test Scenario 11: Payment without matching obligation reference is flagged for review."""
        mock_details.return_value = ({'successful': True, 'memo': 'NO_SUCH_MEMO_OR_OBLIGATION'}, None)
        mock_ops.return_value = ([{
            'id': 'op_test_unmatched_001',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '250.0000000',
            'asset_code': 'USDC'
        }], None)

        service = StellarReconciliationService()
        service.verify_and_reconcile_transaction('hash_unmatched_test')

        p = RentPayment.objects.get(stellar_op_id='op_test_unmatched_001')
        self.assertEqual(p.reconciliation_status, RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED)
        self.assertIsNone(p.obligation)

    def test_scenario_12_due_date_passes_with_balance_marked_overdue(self):
        """Test Scenario 12: Due date passes with outstanding balance -> Marked OVERDUE."""
        past_date = timezone.localdate() - datetime.timedelta(days=10)
        obl = RentObligation.objects.create(
            schedule=self.schedule,
            assignment=self.assignment,
            property=self.property,
            unit=self.unit,
            landlord=self.landlord,
            tenant=self.tenant,
            period_start_date=past_date - datetime.timedelta(days=20),
            period_end_date=past_date - datetime.timedelta(days=1),
            due_date=past_date,
            amount_due_usdc=Decimal('300.0000000'),
            amount_paid_usdc=Decimal('100.0000000'),
            outstanding_balance_usdc=Decimal('200.0000000'),
            receiving_wallet=self.property.receiving_wallet
        )
        obl.recalculate(save=True)
        self.assertEqual(obl.status, RentObligation.Status.OVERDUE)
        self.assertTrue(obl.is_overdue)

    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_operations')
    @patch('apps.rentals.services.stellar_reconciliation.StellarReconciliationService.get_transaction_details')
    def test_scenario_13_overpayment_flagged_excess(self, mock_details, mock_ops):
        """Test Scenario 13: Overpayment beyond outstanding balance is flagged as FLAGGED_EXCESS."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        mock_details.return_value = ({'successful': True, 'memo': obl.payment_memo}, None)
        mock_ops.return_value = ([{
            'id': 'op_test_excess_01',
            'type': 'payment',
            'to': self.property.receiving_wallet,
            'from': self.tenant.primary_stellar_address,
            'amount': '500.0000000', # 500 USDC for 300 USDC rent
            'asset_code': 'USDC'
        }], None)

        service = StellarReconciliationService()
        service.verify_and_reconcile_transaction('hash_excess_test')

        p = RentPayment.objects.get(stellar_op_id='op_test_excess_01')
        self.assertEqual(p.reconciliation_status, RentPayment.ReconciliationStatus.FLAGGED_EXCESS)
        self.assertIn('Excess payment detected', p.review_notes)

    def test_scenario_14_downloadable_pdf_receipt(self):
        """Test Scenario 14: PDF receipt contains all required details and generates binary PDF bytes."""
        obligations = self.schedule.generate_obligations(count=1)
        obl = obligations[0]

        payment = RentPayment.objects.create(
            obligation=obl,
            tenant=self.tenant,
            payer_stellar_address=self.tenant.primary_stellar_address,
            receiving_stellar_address=self.property.receiving_wallet,
            amount=Decimal('300.0000000'),
            asset_code='USDC',
            stellar_tx_hash='abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            stellar_op_id='op_receipt_test_01',
            ledger_closed_at=timezone.now(),
            reconciliation_status=RentPayment.ReconciliationStatus.CONFIRMED,
            balance_after_payment=Decimal('0.0000000')
        )

        receipt = RentReceipt.objects.create(
            payment=payment,
            obligation=obl,
            tenant=self.tenant,
            property_name=self.property.name,
            unit_number=self.unit.unit_number,
            rental_period=obl.rental_period_display,
            amount_paid=Decimal('300.0000000'),
            asset_code='USDC',
            payment_date=timezone.now(),
            stellar_tx_hash=payment.stellar_tx_hash,
            stellar_op_id=payment.stellar_op_id,
            outstanding_balance_after=Decimal('0.0000000'),
            verification_status='CONFIRMED_ON_STELLAR_TESTNET',
            stellar_explorer_url=payment.stellar_explorer_url
        )

        pdf_bytes = generate_receipt_pdf_bytes(receipt)
        self.assertTrue(pdf_bytes.startswith(b'%PDF-'))
        self.assertGreater(len(pdf_bytes), 1000)

    def test_scenario_15_cursor_preserves_restart_state(self):
        """Test Scenario 15: Cursor persistence preserves sync checkpoint across service restarts."""
        cursor, created = StellarReconciliationCursor.objects.get_or_create(
            wallet_address='GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
            defaults={'last_paging_token': '123456789'}
        )
        cursor.last_paging_token = '987654321'
        cursor.save()

        # Simulate service restart
        cursor_reloaded = StellarReconciliationCursor.objects.get(
            wallet_address='GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK'
        )
        self.assertEqual(cursor_reloaded.last_paging_token, '987654321')

    def test_interactive_rent_calculator_endpoint(self):
        """Test Section 5: Rent Calculator API endpoint."""
        response = self.client.post('/api/v1/rentals/calculator/', {
            'rent_due': '300.00',
            'already_paid': '100.00',
            'new_payment': '50.00',
            'due_date': '2026-11-01',
            'reference_date': '2026-11-13'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['current_outstanding_usdc'], '200.0000000')
        self.assertEqual(data['after_simulated_payment_usdc'], '150.0000000')
        self.assertEqual(data['resulting_rental_status'], 'Overdue')

    def test_property_detail_and_preview_endpoints(self):
        """Test Property detail preview and units API endpoints for public and tenant access."""
        # 1. Anonymous guest access to property detail
        guest_client = APIClient()
        response = guest_client.get(f'/api/v1/rentals/properties/{self.property.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['id'], str(self.property.id))
        self.assertEqual(data['name'], 'Ocean View Heights')
        self.assertEqual(len(data.get('units', [])), 1)

        # 2. Units nested action endpoint
        units_resp = guest_client.get(f'/api/v1/rentals/properties/{self.property.id}/units/')
        self.assertEqual(units_resp.status_code, status.HTTP_200_OK)
        units_data = units_resp.json()
        self.assertEqual(len(units_data), 1)
        self.assertEqual(units_data[0]['unit_number'], 'Unit 3C')

        # 3. Authenticated tenant preview
        self.client.force_authenticate(user=self.tenant)
        auth_resp = self.client.get(f'/api/v1/rentals/properties/{self.property.id}/')
        self.assertEqual(auth_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(auth_resp.json()['name'], 'Ocean View Heights')

    def test_self_service_tenant_lease_application(self):
        """Test tenant applying for a vacant unit creates assignment and schedule."""
        # Create a new vacant unit
        vacant_unit = RentalUnit.objects.create(
            property=self.property,
            unit_number='Unit 4D',
            bedrooms=3,
            bathrooms=Decimal('2.5'),
            rent_amount_usdc=Decimal('500.0000000'),
            deposit_amount_usdc=Decimal('500.0000000'),
            is_occupied=False
        )

        self.client.force_authenticate(user=self.tenant)
        response = self.client.post('/api/v1/rentals/assignments/', {
            'property': str(self.property.id),
            'unit': str(vacant_unit.id),
            'rent_amount_usdc': '500.0000000',
            'deposit_amount_usdc': '500.0000000',
            'monthly_due_day': 1,
            'start_date': str(datetime.date.today())
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignment_data = response.json()
        self.assertEqual(assignment_data['unit'], str(vacant_unit.id))

        # Verify unit is marked occupied
        vacant_unit.refresh_from_db()
        self.assertTrue(vacant_unit.is_occupied)
        self.assertEqual(vacant_unit.current_tenant, self.tenant)

        # Verify schedule and obligation were created
        schedule = RentalSchedule.objects.filter(unit=vacant_unit, tenant=self.tenant).first()
        self.assertIsNotNone(schedule)
        self.assertTrue(schedule.is_active)
        self.assertTrue(RentObligation.objects.filter(schedule=schedule).exists())

    def test_property_owner_wallet_retrieval_and_auto_sync(self):
        """
        Verify property automatically retrieves owner wallet, auto-syncs when owner updates wallet,
        and auto-syncs obligations when admin changes property owner.
        """
        # 1. Property retrieves owner's wallet
        self.assertEqual(self.property.owner_wallet, self.landlord.primary_stellar_address)

        # 2. Owner updates wallet -> Property and active obligations auto-sync
        new_wallet = 'GC5TEGJWJAOG25QDNGCNX5AOOW7G4MOLYAHGFLFSGHL37L6ZGJXZS6A4'
        self.landlord.primary_stellar_address = new_wallet
        self.landlord.save()

        self.property.refresh_from_db()
        self.assertEqual(self.property.owner_wallet, new_wallet)
        self.assertEqual(self.property.receiving_wallet, new_wallet)

        # 3. Admin changes property owner to another landlord
        new_landlord = User.objects.create_user(
            username='landlord2',
            email='landlord2@payarmove.com',
            password='password123',
            role=User.Role.LANDLORD,
            primary_stellar_address='GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT'
        )
        self.property.landlord = new_landlord
        self.property.save()

        self.property.refresh_from_db()
        self.assertEqual(self.property.owner_wallet, 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT')
        self.assertEqual(self.property.receiving_wallet, 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT')

        # 4. Check API serialization reflects owner's live wallet
        resp = self.client.get(f'/api/v1/rentals/properties/{self.property.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()['receiving_wallet'], 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT')

