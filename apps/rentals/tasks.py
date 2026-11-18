import logging
from celery import shared_task
from django.utils import timezone
from apps.rentals.models import RentalSchedule, RentObligation
from apps.rentals.services.stellar_reconciliation import StellarReconciliationService

logger = logging.getLogger(__name__)


@shared_task(name='apps.rentals.tasks.generate_recurring_rent_obligations_task')
def generate_recurring_rent_obligations_task(lookahead_months=2):
    """
    Periodically runs to check all active rental schedules and generate
    upcoming recurring rent obligations.
    """
    logger.info("Starting recurring rent obligation generation task...")
    active_schedules = RentalSchedule.objects.filter(is_active=True)
    today = timezone.localdate()
    target_date = today.replace(day=1)

    # look ahead up to 2 months
    for _ in range(lookahead_months):
        target_date = target_date.replace(month=(target_date.month % 12) + 1, year=target_date.year + (target_date.month // 12))

    total_generated = 0
    for schedule in active_schedules:
        try:
            created = schedule.generate_obligations(count=3, up_to_date=target_date)
            total_generated += len(created)
        except Exception as e:
            logger.error(f"Error generating obligations for schedule {schedule.schedule_code}: {e}")

    logger.info(f"Generated {total_generated} new rent obligations.")
    return total_generated


@shared_task(name='apps.rentals.tasks.update_overdue_obligations_task')
def update_overdue_obligations_task():
    """
    Checks all obligations where due_date < current_date and outstanding_balance > 0,
    and updates their lifecycle status to OVERDUE.
    """
    logger.info("Running overdue obligation status refresh...")
    today = timezone.localdate()
    unsettled = RentObligation.objects.filter(
        outstanding_balance_usdc__gt=0,
        due_date__lt=today
    ).exclude(status=RentObligation.Status.OVERDUE)

    count = 0
    for obl in unsettled:
        obl.recalculate(save=True)
        count += 1

    logger.info(f"Updated {count} obligations to OVERDUE status.")
    return count


@shared_task(name='apps.rentals.tasks.poll_stellar_testnet_payments_task')
def poll_stellar_testnet_payments_task():
    """
    Monitors Stellar Testnet Horizon payments for all registered receiving wallets.
    Reconciles payments, prevents duplicate credits, flags unmatched/excess transfers,
    and creates receipts.
    """
    logger.info("Polling Stellar Testnet for incoming rental payments...")
    try:
        service = StellarReconciliationService()
        results = service.sync_all_active_wallets()
        return {'status': 'SUCCESS', 'wallets_polled': len(results)}
    except Exception as e:
        logger.error(f"Error polling Stellar payments: {e}")
        return {'status': 'ERROR', 'error': str(e)}

