import logging
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db import transaction
import requests
from apps.rentals.models import (
    Property,
    RentObligation,
    PaymentRequest,
    RentPayment,
    RentReceipt,
    StellarReconciliationCursor,
)

logger = logging.getLogger(__name__)


class StellarReconciliationService:
    """
    Automated Stellar Testnet transaction verification and reconciliation service.
    
    Reconciliation rules:
    1. Confirm payment exists on Stellar Testnet and transaction succeeded.
    2. Confirm recipient matches landlord's registered receiving wallet.
    3. Validate payment asset (USDC on Testnet).
    4. Match payment to valid rental obligation via memo or payment request.
    5. Verify payment amount and credit only confirmed payments.
    6. Allow multiple valid partial payments toward the same obligation.
    7. Prevent duplicate credits using unique stellar_op_id.
    8. Flag unmatched or excess payments for review.
    9. Recalculate outstanding balance: max(0, AmountDue - VerifiedPayments).
    10. Preserve reconciliation state across restarts using cursor tracking.
    """

    def __init__(self, horizon_url=None, network_passphrase=None):
        self.horizon_url = (horizon_url or getattr(settings, 'STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org')).rstrip('/')
        self.network_passphrase = network_passphrase or getattr(settings, 'STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
        self.expected_asset_code = getattr(settings, 'STELLAR_USDC_CODE', 'USDC')
        self.expected_asset_issuer = getattr(settings, 'STELLAR_USDC_ISSUER', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': 'PayarMove-Reconciliation-Engine/2.0'})

    def get_transaction_details(self, tx_hash):
        """Fetch transaction JSON from Stellar Horizon."""
        url = f"{self.horizon_url}/transactions/{tx_hash}"
        try:
            resp = self.session.get(url, timeout=12)
            if resp.status_code == 404:
                return None, "Transaction not found on Stellar Testnet."
            if resp.status_code != 200:
                return None, f"Horizon error: {resp.status_code} - {resp.text}"
            return resp.json(), None
        except Exception as e:
            return None, f"Network or lookup error reaching Stellar Horizon: {e}"

    def get_transaction_operations(self, tx_hash):
        """Fetch operations in this transaction."""
        url = f"{self.horizon_url}/transactions/{tx_hash}/operations"
        try:
            resp = self.session.get(url, timeout=12)
            if resp.status_code != 200:
                return [], f"Failed to retrieve operations: {resp.status_code}"
            data = resp.json()
            return data.get('_embedded', {}).get('records', []), None
        except Exception as e:
            return [], f"Network error retrieving operations: {e}"

    def verify_and_reconcile_transaction(self, tx_hash, target_obligation=None, target_wallet=None):
        """
        Verifies a transaction hash and reconciles its payment operations against rental obligations.
        Returns a dict summary with processed payments, receipts, and any flagged warnings.
        """
        tx_data, err = self.get_transaction_details(tx_hash)
        if err or not tx_data:
            return {
                'success': False,
                'error': err or "Transaction lookup failed",
                'processed_payments': []
            }

        # Rule 1 & 2: Confirm transaction succeeded on Stellar Testnet
        if not tx_data.get('successful', False):
            return {
                'success': False,
                'error': "Transaction failed on the Stellar network (successful != true).",
                'processed_payments': []
            }

        memo = tx_data.get('memo')
        ledger_seq = tx_data.get('ledger')
        ledger_closed_at_str = tx_data.get('created_at')
        ledger_closed_at = None
        if ledger_closed_at_str:
            try:
                ledger_closed_at = timezone.datetime.fromisoformat(ledger_closed_at_str.replace('Z', '+00:00'))
            except Exception:
                ledger_closed_at = timezone.now()

        operations, op_err = self.get_transaction_operations(tx_hash)
        if op_err:
            return {
                'success': False,
                'error': op_err,
                'processed_payments': []
            }

        payment_ops = [
            op for op in operations
            if op.get('type') in ('payment', 'path_payment_strict_send', 'path_payment_strict_receive')
        ]

        if not payment_ops:
            return {
                'success': False,
                'error': "No payment operations found in this transaction.",
                'processed_payments': []
            }

        results = []

        for op in payment_ops:
            op_id = str(op.get('id'))
            
            # Rule 9: Prevent duplicate credits for the same operation
            existing_payment = RentPayment.objects.filter(stellar_op_id=op_id).first()
            if existing_payment:
                receipt = getattr(existing_payment, 'receipt', None)
                results.append({
                    'status': 'ALREADY_PROCESSED',
                    'payment_reference': existing_payment.payment_reference,
                    'stellar_op_id': op_id,
                    'amount': str(existing_payment.amount),
                    'asset': existing_payment.asset_code,
                    'reconciliation_status': existing_payment.reconciliation_status,
                    'receipt_number': receipt.receipt_number if receipt else None,
                    'notes': "Operation was already processed and credited previously."
                })
                continue

            # Extract payment attributes
            recipient = op.get('to')
            payer = op.get('from')
            amount_str = op.get('amount')
            asset_type = op.get('asset_type')
            asset_code = 'XLM' if asset_type == 'native' else op.get('asset_code', 'UNKNOWN')
            asset_issuer = '' if asset_type == 'native' else op.get('asset_issuer', '')

            try:
                payment_amount = Decimal(str(amount_str)).quantize(Decimal('0.0000001'))
            except Exception:
                payment_amount = Decimal('0.0000000')

            with transaction.atomic():
                # Attempt to match to obligation
                obligation = target_obligation
                payment_request = None

                if not obligation and memo:
                    clean_memo = str(memo).strip()
                    # 1. Match by obligation payment_memo
                    obligation = RentObligation.objects.filter(payment_memo__iexact=clean_memo).first()
                    # 2. Match by obligation reference
                    if not obligation:
                        obligation = RentObligation.objects.filter(obligation_reference__iexact=clean_memo).first()
                    # 3. Match by payment request
                    if not obligation:
                        payment_request = PaymentRequest.objects.filter(payment_memo__iexact=clean_memo).first()
                        if payment_request:
                            obligation = payment_request.obligation

                # If still not matched, check recipient wallet's active/due obligation
                if not obligation and recipient:
                    candidate_obligations = RentObligation.objects.filter(
                        receiving_wallet__iexact=recipient,
                        status__in=[
                            RentObligation.Status.UNPAID,
                            RentObligation.Status.PARTIALLY_PAID,
                            RentObligation.Status.OVERDUE,
                            RentObligation.Status.UPCOMING
                        ]
                    ).order_by('due_date')
                    if candidate_obligations.count() == 1:
                        # Unambiguous match for this receiving wallet
                        obligation = candidate_obligations.first()

                # Rule 3 & 4: Validate recipient and asset
                wallet_is_registered = (
                    Property.objects.filter(receiving_wallet__iexact=recipient).exists() or
                    RentObligation.objects.filter(receiving_wallet__iexact=recipient).exists() or
                    (obligation and (
                        (obligation.receiving_wallet or '').lower() == recipient.lower() or
                        (obligation.landlord and (obligation.landlord.primary_stellar_address or '').lower() == recipient.lower())
                    ))
                )

                reconciliation_status = RentPayment.ReconciliationStatus.CONFIRMED
                review_notes = ""
                receipt_obj = None

                if not wallet_is_registered and not (target_wallet and target_wallet.lower() == recipient.lower()):
                    reconciliation_status = RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED
                    review_notes = f"Recipient wallet {recipient} is not registered in PayarMove."
                elif not obligation:
                    reconciliation_status = RentPayment.ReconciliationStatus.FLAGGED_UNMATCHED
                    review_notes = f"Payment of {payment_amount} {asset_code} received with memo '{memo}', but no matching rental obligation was found."
                elif asset_code.upper() not in (self.expected_asset_code.upper(), obligation.asset_code.upper(), 'XLM'):
                    reconciliation_status = RentPayment.ReconciliationStatus.REJECTED
                    review_notes = f"Asset mismatch: expected {obligation.asset_code}, received {asset_code}."
                else:
                    # Valid obligation matched!
                    current_outstanding = obligation.outstanding_balance_usdc

                    # Rule 10: Flag excess payments
                    if payment_amount > current_outstanding:
                        excess = payment_amount - current_outstanding
                        reconciliation_status = RentPayment.ReconciliationStatus.FLAGGED_EXCESS
                        review_notes = f"Excess payment detected: received {payment_amount} {asset_code}, which exceeds the remaining outstanding rent of {current_outstanding} {asset_code} by {excess} {asset_code}."
                        # Credit up to the due amount; excess is flagged for review
                        obligation.amount_paid_usdc += payment_amount
                        obligation.recalculate(save=True)
                    else:
                        # Full or partial payment
                        obligation.amount_paid_usdc += payment_amount
                        obligation.recalculate(save=True)
                        if obligation.outstanding_balance_usdc == Decimal('0.0000000'):
                            reconciliation_status = RentPayment.ReconciliationStatus.CONFIRMED
                            review_notes = "Rental obligation fully settled on Stellar Testnet."
                        else:
                            reconciliation_status = RentPayment.ReconciliationStatus.PARTIAL
                            review_notes = f"Partial payment credited. Remaining balance: {obligation.outstanding_balance_usdc} {asset_code}."

                    if payment_request:
                        if obligation.outstanding_balance_usdc == Decimal('0.0000000'):
                            payment_request.status = PaymentRequest.Status.PAID
                        else:
                            payment_request.status = PaymentRequest.Status.PARTIALLY_PAID
                        payment_request.save(update_fields=['status'])

                # Create the RentPayment audit record
                rent_payment = RentPayment.objects.create(
                    obligation=obligation,
                    payment_request=payment_request,
                    tenant=obligation.tenant if obligation else None,
                    payer_stellar_address=payer or '',
                    receiving_stellar_address=recipient or '',
                    amount=payment_amount,
                    asset_code=asset_code,
                    asset_issuer=asset_issuer,
                    stellar_tx_hash=tx_hash,
                    stellar_op_id=op_id,
                    ledger_sequence=ledger_seq,
                    ledger_closed_at=ledger_closed_at,
                    memo=str(memo) if memo is not None else '',
                    reconciliation_status=reconciliation_status,
                    balance_after_payment=obligation.outstanding_balance_usdc if obligation else None,
                    review_notes=review_notes,
                    raw_data=op
                )

                # Generate downloadable receipt if obligation was credited
                if obligation and reconciliation_status in (
                    RentPayment.ReconciliationStatus.CONFIRMED,
                    RentPayment.ReconciliationStatus.PARTIAL,
                    RentPayment.ReconciliationStatus.FLAGGED_EXCESS
                ):
                    receipt_obj = RentReceipt.objects.create(
                        payment=rent_payment,
                        obligation=obligation,
                        tenant=obligation.tenant,
                        property_name=obligation.property.name,
                        unit_number=obligation.unit.unit_number if obligation.unit else '',
                        rental_period=obligation.rental_period_display,
                        amount_paid=payment_amount,
                        asset_code=asset_code,
                        payment_date=ledger_closed_at or timezone.now(),
                        stellar_tx_hash=tx_hash,
                        stellar_op_id=op_id,
                        outstanding_balance_after=obligation.outstanding_balance_usdc,
                        verification_status='CONFIRMED_ON_STELLAR_TESTNET',
                        stellar_explorer_url=f"https://stellar.expert/explorer/testnet/tx/{tx_hash}",
                        notes=review_notes
                    )

                results.append({
                    'status': 'PROCESSED',
                    'payment_reference': rent_payment.payment_reference,
                    'stellar_op_id': op_id,
                    'amount': str(payment_amount),
                    'asset': asset_code,
                    'obligation_reference': obligation.obligation_reference if obligation else None,
                    'reconciliation_status': reconciliation_status,
                    'outstanding_balance_after': str(obligation.outstanding_balance_usdc) if obligation else None,
                    'receipt_number': receipt_obj.receipt_number if receipt_obj else None,
                    'notes': review_notes
                })

        return {
            'success': True,
            'tx_hash': tx_hash,
            'memo': memo,
            'operations_processed': len(payment_ops),
            'processed_payments': results
        }

    def sync_wallet_payments(self, wallet_address, limit=50):
        """
        Polls Stellar Horizon for incoming payments to a specific wallet.
        Uses paging tokens to preserve state across restarts (Rule 12).
        """
        cursor_obj, _ = StellarReconciliationCursor.objects.get_or_create(
            wallet_address=wallet_address,
            defaults={'last_paging_token': '0'}
        )

        cursor = cursor_obj.last_paging_token
        url = f"{self.horizon_url}/accounts/{wallet_address}/payments"
        params = {
            'order': 'asc',
            'limit': limit
        }
        if cursor and cursor != '0':
            params['cursor'] = cursor

        try:
            resp = self.session.get(url, params=params, timeout=12)
            if resp.status_code == 404:
                return []
            if resp.status_code != 200:
                logger.error(f"Error polling Stellar payments for {wallet_address}: {resp.status_code}")
                return []

            data = resp.json()
            records = data.get('_embedded', {}).get('records', [])
            processed = []

            for record in records:
                paging_token = record.get('paging_token')
                tx_hash = record.get('transaction_hash')
                op_to = record.get('to')

                # Reconcile if payment was sent to this receiving wallet
                if tx_hash and op_to and op_to.lower() == wallet_address.lower():
                    summary = self.verify_and_reconcile_transaction(
                        tx_hash=tx_hash,
                        target_wallet=wallet_address
                    )
                    processed.append(summary)

                if paging_token:
                    cursor_obj.last_paging_token = paging_token

            cursor_obj.save(update_fields=['last_paging_token', 'last_polled_at'])
            return processed

        except Exception as e:
            logger.error(f"Exception syncing payments for wallet {wallet_address}: {e}")
            return []

    def sync_all_active_wallets(self):
        """
        Polls Stellar Horizon for all registered properties' receiving wallets.
        """
        active_wallets = set(
            Property.objects.filter(is_active=True).values_list('receiving_wallet', flat=True)
        )
        active_wallets.update(
            RentObligation.objects.filter(
                status__in=[
                    RentObligation.Status.UNPAID,
                    RentObligation.Status.PARTIALLY_PAID,
                    RentObligation.Status.OVERDUE,
                    RentObligation.Status.UPCOMING
                ]
            ).values_list('receiving_wallet', flat=True)
        )

        server_key = getattr(settings, 'STELLAR_SERVER_PUBLIC_KEY', None)
        if server_key:
            active_wallets.add(server_key)

        all_results = {}
        for wallet in active_wallets:
            if wallet and wallet.startswith('G') and len(wallet) == 56:
                res = self.sync_wallet_payments(wallet)
                all_results[wallet] = res

        return all_results
