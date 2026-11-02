from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import PageParams, paginate, require_roles
from ..models import Order, OrderStatus as S, Role, User
from ..schemas import OrderOut, Page, StatusUpdateIn
from ..services import ORDER_OPTIONS, change_status, load_order

router = APIRouter(prefix="/delivery", tags=["Delivery partner"])

partner_only = require_roles(Role.DELIVERY_PARTNER)
ACTIVE = (S.ASSIGNED, S.OUT_FOR_DELIVERY)
HISTORY = (S.DELIVERED, S.REFUNDED)


@router.get("/orders", response_model=Page[OrderOut])
def assigned_orders(
    status: Optional[str] = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(partner_only),
):
    """Orders still to be delivered. Optional status filter: ASSIGNED or OUT_FOR_DELIVERY."""
    statuses = ACTIVE
    if status:
        if status.upper() not in ACTIVE:
            raise HTTPException(status_code=400, detail="status must be ASSIGNED or OUT_FOR_DELIVERY")
        statuses = (status.upper(),)
    stmt = (
        select(Order)
        .where(Order.delivery_partner_id == user.id, Order.status.in_(statuses))
        .order_by(Order.status_updated_at.desc())
    )
    return paginate(db, stmt, params, options=ORDER_OPTIONS)


@router.get("/history", response_model=Page[OrderOut])
def delivery_history(params: PageParams = Depends(), db: Session = Depends(get_db), user: User = Depends(partner_only)):
    stmt = (
        select(Order)
        .where(Order.delivery_partner_id == user.id, Order.status.in_(HISTORY))
        .order_by(Order.status_updated_at.desc())
    )
    return paginate(db, stmt, params, options=ORDER_OPTIONS)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_delivery_status(
    order_id: int,
    payload: StatusUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(partner_only),
):
    order = load_order(db, order_id)
    if order is None or order.delivery_partner_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    change_status(db, order, payload.status, Role.DELIVERY_PARTNER)
    db.commit()
    return load_order(db, order.id)
