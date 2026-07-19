from django.contrib.auth.models import UserManager as DjangoUserManager


class UserManager(DjangoUserManager):
    """
    Identical to Django's default UserManager, except create_superuser()
    also sets role=admin. Without this, `python manage.py createsuperuser`
    produces a user with role=customer (the model default), which would
    fail the role check in the admin login endpoint even though
    is_superuser/is_staff are correctly set.
    """

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", self.model.Role.ADMIN)
        extra_fields.setdefault("email_verified", True)
        return super().create_superuser(username, email, password, **extra_fields)
