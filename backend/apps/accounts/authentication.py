from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Identical to simplejwt's default header-based auth, except the raw
    token is read from the `dbm_access` HttpOnly cookie set at login
    (accounts/views.py) rather than an `Authorization: Bearer ...` header.
    Keeping tokens out of JS-accessible storage is the point (§4.4.3) —
    localStorage is readable by any injected script; an HttpOnly cookie
    is not.
    """

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
