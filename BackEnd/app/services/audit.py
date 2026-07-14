from flask import request

from ..extensions import db
from ..models import AuditLog, ClaimEvent


def record_claim_event(claim_id, status, note=None, actor_id=None):
    """Append a claim status event (timeline for tracking)."""
    event = ClaimEvent(
        claim_id=claim_id, status=status, note=note, actor_id=actor_id
    )
    db.session.add(event)
    db.session.commit()
    return event


def log_action(actor_id, action, entity=None, entity_id=None, meta=None):
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        meta=meta,
        ip=request.remote_addr if request else None,
    )
    db.session.add(entry)
    db.session.commit()
    return entry
