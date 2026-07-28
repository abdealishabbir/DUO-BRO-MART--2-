from django.core.management.base import BaseCommand, CommandError

from apps.accounts.utils import provision_vendor_account


class Command(BaseCommand):
    """
    Dev/testing stand-in for §4.3: create a vendor account directly
    without going through a public application first. The real §6.5
    admin-panel approval flow (VendorApplicationViewSet.approve) calls
    the same underlying provision_vendor_account() helper.

    Usage:
        python manage.py create_vendor_account vendor@example.com --name "Ali's Store"
    """

    help = "Create a vendor account with a temporary password (dev stand-in for admin approval)."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--name", default="")

    def handle(self, *args, **options):
        first_name, _, last_name = options["name"].partition(" ")
        try:
            user, temp_password, email_status = provision_vendor_account(options["email"], first_name, last_name)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Vendor account created: {user.email}"))
        self.stdout.write(f"Temporary password: {temp_password}")
        self.stdout.write(email_status)
