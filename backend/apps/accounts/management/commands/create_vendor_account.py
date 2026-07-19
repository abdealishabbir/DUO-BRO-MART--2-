import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.utils import send_vendor_credentials_email

User = get_user_model()


class Command(BaseCommand):
    """
    Dev/testing stand-in for §4.3: "after admin approves the application,
    the system generates a temporary password and emails vendor
    credentials." Phase 6 replaces this command with the real admin-panel
    approval action calling the same underlying logic.

    Usage:
        python manage.py create_vendor_account vendor@example.com --name "Ali's Store"
    """

    help = "Create a vendor account with a temporary password (dev stand-in for admin approval)."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--name", default="")

    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"A user with email {email} already exists.")

        temp_password = secrets.token_urlsafe(9)
        first_name, _, last_name = options["name"].partition(" ")

        user = User.objects.create(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.VENDOR,
            email_verified=True,
            must_change_password=True,
        )
        user.set_password(temp_password)
        user.save()

        try:
            send_vendor_credentials_email(user, temp_password)
            email_status = "Credentials email sent (check console output in dev)."
        except Exception as exc:  # pragma: no cover — surfaced to the operator either way
            email_status = f"Could not send email ({exc}); share the password below manually."

        self.stdout.write(self.style.SUCCESS(f"Vendor account created: {email}"))
        self.stdout.write(f"Temporary password: {temp_password}")
        self.stdout.write(email_status)
