from datetime import timedelta

from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.banners.models import MAX_PENALTY_DAYS, PREPAID_GRACE_DAYS, Banner, BannerApplication


class Command(BaseCommand):
    """
    Run once daily (docker-compose exec backend python manage.py
    process_banner_billing — via host cron, or manually). Only handles the
    state transitions that must be *persisted* (going live, going
    overdue/suspended/cancelled); the actual penalty/remaining-amount
    figures shown in the UI are computed live from dates on every request
    (see Banner properties), so a missed or delayed run never makes those
    numbers wrong — it only delays the suspension trigger itself.
    """

    help = "Process daily banner billing: activate scheduled banners, accrue penalties, suspend, auto-cancel."

    def handle(self, *args, **options):
        today = timezone.localdate()
        activated = overdue_flagged = suspended = completed = cancelled = 0

        # 1. Scheduled -> Live
        for banner in Banner.objects.filter(status=Banner.Status.SCHEDULED, live_start_date__lte=today):
            banner.status = Banner.Status.LIVE
            banner.save(update_fields=["status"])
            activated += 1

        # 2. Live past its end date -> Completed (paid/prepaid) or Overdue (postpaid unpaid)
        for banner in Banner.objects.filter(status=Banner.Status.LIVE, live_end_date__lt=today):
            if banner.paid_amount >= banner.total_price:
                banner.status = Banner.Status.COMPLETED
                banner.save(update_fields=["status"])
                completed += 1
            else:
                banner.status = Banner.Status.OVERDUE
                banner.save(update_fields=["status"])
                overdue_flagged += 1

        # 3. Overdue -> settle, escalate penalty, or suspend at MAX_PENALTY_DAYS
        for banner in Banner.objects.filter(status=Banner.Status.OVERDUE):
            if banner.paid_amount >= (banner.total_price + banner.penalty_amount):
                banner.status = Banner.Status.COMPLETED
                banner.save(update_fields=["status"])
                completed += 1
                continue

            current_overdue_days = banner.days_overdue  # live property, capped at MAX_PENALTY_DAYS
            if current_overdue_days > banner.penalty_days_elapsed:
                banner.penalty_days_elapsed = current_overdue_days
                banner.save(update_fields=["penalty_days_elapsed"])

            if current_overdue_days >= MAX_PENALTY_DAYS and banner.vendor.is_active:
                banner.status = Banner.Status.SUSPENDED
                banner.save(update_fields=["status"])
                banner.vendor.is_active = False
                banner.vendor.save(update_fields=["is_active"])
                suspended += 1
                self._notify_admin_of_suspension(banner)

        # 4. Stale unpaid prepaid reservations -> auto-cancel, freeing the slot
        grace_cutoff = timezone.now() - timedelta(days=PREPAID_GRACE_DAYS)
        for banner in Banner.objects.filter(
            status=Banner.Status.AWAITING_PAYMENT,
            application__payment_type=BannerApplication.PaymentType.PREPAID,
            application__decided_at__lt=grace_cutoff,
        ):
            banner.status = Banner.Status.CANCELLED
            banner.save(update_fields=["status"])
            banner.application.status = BannerApplication.Status.CANCELLED
            banner.application.save(update_fields=["status"])
            cancelled += 1

        self.stdout.write(self.style.SUCCESS(
            f"Banner billing processed: {activated} activated, {overdue_flagged} newly overdue, "
            f"{completed} completed, {suspended} suspended, {cancelled} cancelled."
        ))

    @staticmethod
    def _notify_admin_of_suspension(banner):
        admin_email = getattr(django_settings, "ADMIN_NOTIFICATION_EMAIL", "")
        if not admin_email:
            return
        send_mail(
            subject=f"Vendor suspended for nonpayment — Banner #{banner.pk}",
            message=(
                f"Vendor: {banner.vendor.email}\n"
                f"Banner: {banner.headline}\n"
                f"Total owed: Rs.{banner.total_price + banner.penalty_amount}\n"
                f"Paid so far: Rs.{banner.paid_amount}\n\n"
                "Account has been auto-suspended (login blocked) after 3 unpaid days "
                "past the banner's due date. Review for possible legal action."
            ),
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=True,
        )
