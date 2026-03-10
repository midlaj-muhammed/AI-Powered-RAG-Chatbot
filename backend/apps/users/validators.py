import re
from django.core.exceptions import ValidationError


class CustomPasswordValidator:
    """Enforce at least 1 uppercase, 1 number, 1 special character."""

    def validate(self, password, user=None):
        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                "Password must contain at least one uppercase letter.",
                code="password_no_upper",
            )
        if not re.search(r"\d", password):
            raise ValidationError(
                "Password must contain at least one digit.",
                code="password_no_digit",
            )
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
            raise ValidationError(
                "Password must contain at least one special character.",
                code="password_no_special",
            )

    def get_help_text(self):
        return "Your password must contain at least one uppercase letter, one digit, and one special character."
