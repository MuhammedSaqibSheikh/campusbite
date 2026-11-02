import uuid
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from .config import get_settings
from .models import Order, OrderStatus as S, PaymentLedger, PaymentStatus, ReminderLog, Role
from .utils import utcnow

TRANSITIONS: dict[str, set[str]] = {
    S.PLACED: {S.ACCEPTED, S.CANCELLED},
    S.ACCEPTED: {S.PREPARING},
    S.PREPARING: {S.READY},
    S.READY: {S.ASSIGNED},
    S.ASSIGNED: {S.OUT_FOR_DELIVERY},
    S.OUT_FOR_DELIVERY: {S.DELIVERED},
    S.DELIVERED: {S.REFUNDED},
}

# Which status each actor may move an order into. REFUNDED is only reachable via an approved return.
ACTOR_TARGETS: dict[str, set[str]] = {
    Role.CUSTOMER: {S.CANCELLED},
    Role.RESTAURANT_OWNER: {S.ACCEPTED, S.PREPARING, S.READY, S.ASSIGNED},
    Role.DELIVERY_PARTNER: {S.OUT_FOR_DELIVERY, S.DELIVERED},
    "system": {S.REFUNDED},
}

ORDER_OPTIONS = (
    selectinload(Order.items),
    joinedload(Order.customer),
    joinedload(Order.restaurant),
    joinedload(Order.delivery_partner),
    joinedload(Order.review),
    joinedload(Order.return_request),
)


def load_order(db: Session, order_id: int) -> Optional[Order]:
    return db.scalar(select(Order).where(Order.id == order_id).options(*ORDER_OPTIONS))


def apply_order_filters(stmt, status: Optional[str], date_from: Optional[date], date_to: Optional[date]):
    if status:
        if status.upper() not in S.ALL:
            raise HTTPException(status_code=400, detail=f"Unknown status '{status}'")
        stmt = stmt.where(Order.status == status.upper())
    if date_from:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Order.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    return stmt


def change_status(db: Session, order: Order, new_status: str, actor: str) -> None:
    new_status = (new_status or "").upper()
    if new_status not in S.ALL:
        raise HTTPException(status_code=400, detail=f"Unknown status '{new_status}'")
    if new_status not in ACTOR_TARGETS.get(actor, set()):
        raise HTTPException(status_code=403, detail=f"Your role cannot set an order to {new_status}")
    if new_status not in TRANSITIONS.get(order.status, set()):
        if new_status == S.CANCELLED:
            detail = f"Orders can only be cancelled while PLACED (current status: {order.status})"
        else:
            detail = f"Invalid status transition: {order.status} -> {new_status}"
        raise HTTPException(status_code=409, detail=detail)

    order.status = new_status
    order.status_updated_at = utcnow()
    db.execute(update(ReminderLog).where(ReminderLog.order_id == order.id).values(resolved=True))

    if new_status == S.CANCELLED:
        record_refund(db, order)


def record_refund(db: Session, order: Order) -> None:
    db.add(
        PaymentLedger(
            order_id=order.id,
            entry_type="REFUND",
            amount=order.total_amount,
            status="completed",
            reference=f"MOCK-REF-{uuid.uuid4().hex[:10].upper()}",
        )
    )
    order.payment_status = PaymentStatus.REFUNDED


def scan_reminders(db: Session, restaurant_id: Optional[int] = None) -> int:
    """Create a reminder for each PLACED/ACCEPTED order that has sat idle past the threshold."""
    settings = get_settings()
    cutoff = utcnow() - timedelta(minutes=settings.reminder_threshold_minutes)
    stmt = select(Order).where(Order.status.in_([S.PLACED, S.ACCEPTED]), Order.status_updated_at <= cutoff)
    if restaurant_id is not None:
        stmt = stmt.where(Order.restaurant_id == restaurant_id)
    stale = db.scalars(stmt).all()
    if not stale:
        return 0

    open_pairs = set(
        db.execute(
            select(ReminderLog.order_id, ReminderLog.order_status).where(
                ReminderLog.resolved.is_(False), ReminderLog.order_id.in_([o.id for o in stale])
            )
        ).all()
    )
    created = 0
    for order in stale:
        if (order.id, order.status) in open_pairs:
            continue
        minutes = int((utcnow() - order.status_updated_at).total_seconds() // 60)
        db.add(
            ReminderLog(
                restaurant_id=order.restaurant_id,
                order_id=order.id,
                order_status=order.status,
                message=f"Order #{order.id} has been {order.status} for {minutes} minutes without an update.",
            )
        )
        created += 1
    db.commit()
    return created
