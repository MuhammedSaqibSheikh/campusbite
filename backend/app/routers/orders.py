import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import PageParams, get_current_user, paginate, require_roles
from ..models import (
    MenuItem,
    Order,
    OrderItem,
    OrderStatus as S,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    ReturnRequest,
    ReturnStatus,
    Review,
    Role,
    User,
)
from ..schemas import OrderCreate, OrderOut, Page, ReturnIn, ReturnOut, ReviewIn, ReviewOut
from ..services import ORDER_OPTIONS, apply_order_filters, change_status, load_order

router = APIRouter(prefix="/orders", tags=["Orders (customer)"])

customer_only = require_roles(Role.CUSTOMER)


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=message)


def _own_order(db: Session, order_id: int, user: User) -> Order:
    order = load_order(db, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("", response_model=OrderOut, status_code=201)
def place_order(payload: OrderCreate, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    restaurant = db.get(Restaurant, payload.restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    quantities: dict[int, int] = {}
    for line in payload.items:
        quantities[line.menu_item_id] = quantities.get(line.menu_item_id, 0) + line.quantity
    if any(q > 50 for q in quantities.values()):
        raise HTTPException(status_code=400, detail="Maximum quantity per dish is 50")

    menu = db.scalars(
        select(MenuItem).where(MenuItem.id.in_(quantities), MenuItem.restaurant_id == restaurant.id)
    ).all()
    if len(menu) != len(quantities):
        raise HTTPException(status_code=400, detail="Some dishes do not belong to this restaurant")
    unavailable = [m.name for m in menu if not m.is_available]
    if unavailable:
        raise HTTPException(status_code=400, detail=f"Currently unavailable: {', '.join(unavailable)}")

    # Prices always come from the database, never from the client.
    total = sum((m.price * quantities[m.id] for m in menu), Decimal("0"))
    order = Order(
        customer_id=user.id,
        restaurant_id=restaurant.id,
        status=S.PLACED,
        total_amount=total,
        delivery_address=payload.delivery_address,
        payment_status=PaymentStatus.MOCK_PAID,
        items=[OrderItem(menu_item_id=m.id, name=m.name, price=m.price, quantity=quantities[m.id]) for m in menu],
    )
    db.add(order)
    db.flush()
    db.add(
        PaymentLedger(
            order_id=order.id,
            entry_type="PAYMENT",
            amount=total,
            status=PaymentStatus.MOCK_PAID,
            reference=f"MOCK-PAY-{uuid.uuid4().hex[:10].upper()}",
        )
    )
    db.commit()
    return load_order(db, order.id)


@router.get("", response_model=Page[OrderOut])
def my_orders(
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    stmt = select(Order).where(Order.customer_id == user.id).order_by(Order.created_at.desc(), Order.id.desc())
    stmt = apply_order_filters(stmt, status, date_from, date_to)
    return paginate(db, stmt, params, options=ORDER_OPTIONS)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = load_order(db, order_id)
    allowed = order is not None and (
        order.customer_id == user.id
        or order.delivery_partner_id == user.id
        or (user.role == Role.RESTAURANT_OWNER and order.restaurant.owner_id == user.id)
    )
    if not allowed:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    order = _own_order(db, order_id, user)
    change_status(db, order, S.CANCELLED, Role.CUSTOMER)
    db.commit()
    return load_order(db, order.id)


@router.post("/{order_id}/review", response_model=ReviewOut, status_code=201)
def review_order(order_id: int, payload: ReviewIn, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    order = _own_order(db, order_id, user)
    if order.status not in (S.DELIVERED, S.REFUNDED):
        raise HTTPException(status_code=409, detail="Only delivered orders can be reviewed")
    if order.review:
        raise HTTPException(status_code=409, detail="This order has already been reviewed")
    review = Review(
        order_id=order.id,
        customer_id=user.id,
        restaurant_id=order.restaurant_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    _commit_or_conflict(db, "This order has already been reviewed")
    return review


@router.post("/{order_id}/return", response_model=ReturnOut, status_code=201)
def request_return(order_id: int, payload: ReturnIn, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    order = _own_order(db, order_id, user)
    if order.status != S.DELIVERED:
        raise HTTPException(status_code=409, detail="Returns can only be requested for delivered orders")
    if order.return_request:
        raise HTTPException(status_code=409, detail="A return has already been requested for this order")
    req = ReturnRequest(order_id=order.id, customer_id=user.id, reason=payload.reason, status=ReturnStatus.PENDING)
    db.add(req)
    _commit_or_conflict(db, "A return has already been requested for this order")
    return req
