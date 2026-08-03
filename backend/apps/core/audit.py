"""
§8.4 unified admin audit trail. `log_admin_action` is deliberately the
only way an AuditLogEntry ever gets created — a single boring function
every hooked-in view calls, rather than each view constructing its own
AuditLogEntry.objects.create() call with slightly different field
choices. See models.AuditLogEntry for what is/isn't in scope.
"""

from .models import AuditLogEntry


def log_admin_action(actor, action: str, target, details: str = "") -> AuditLogEntry:
    return AuditLogEntry.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_type=type(target).__name__,
        target_id=target.pk,
        target_repr=str(target)[:200],
        details=details,
    )
