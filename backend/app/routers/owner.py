from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..deps import PageParams, get_owner_restaurant, paginate
from ..media import delete_media_file, save_upload
from ..models import (
    MenuItem,
    MenuItemMedia,
    Order,
    OrderItem,
    OrderStatus as S,
    ReminderLog,
    Restaurant,
    ReturnRequest,
    ReturnStatus,
    Review,
    Role,
    User,
)
from ..schemas import (
    AssignIn,
    AvailabilityIn,
    MediaOut,
    MenuItemIn,
    MenuItemOut,
    MenuItemUpdate,
    OrderOut,
    OwnerStats,
    Page,
    ReminderOut,
    RestaurantOut,
    RestaurantUpdate,
    ReturnDecisionIn,
    ReturnDetailOut,
    StatusUpdateIn,
    TopItem,
    UserOut,
)
from ..services import ORDER_OPTIONS, apply_order_filters, change_status, load_order, record_refund, scan_reminders
from ..utils import utcnow
from .restaurants import attach_ratings

router = APIRouter(prefix="/owner", tags=["Restaurant owner"])

ACTIVE_STATUSES = (S.PLACED, S.ACCEPTED, S.PREPARING, S.READY, S.ASSIGNED, S.OUT_FOR_DELIVERY)


def _restaurant_order(db: Session, order_id: int, restaurant: Restaurant) -> Order:
    order = load_order(db, order_id)
    if order is None or order.restaurant_id != restaurant.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _menu_item(db: Session, item_id: int, restaurant: Restaurant) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None or item.restaurant_id != restaurant.id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


# ---------- restaurant ----------
@router.get("/restaurant", response_model=RestaurantOut)
def my_restaurant(restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    return attach_ratings(db, [restaurant])[0]


@router.put("/restaurant", response_model=RestaurantOut)
def update_restaurant(
    payload: RestaurantUpdate, restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in ("name", "is_active"):
            continue
        setattr(restaurant, field, value)
    db.commit()
    return attach_ratings(db, [restaurant])[0]


@router.post("/restaurant/image", response_model=RestaurantOut)
def upload_restaurant_image(
    file: UploadFile = File(...), restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)
):
    url, _ = save_upload(file, "restaurants")
    old = restaurant.image_url
    restaurant.image_url = url
    db.commit()
    delete_media_file(old)
    return attach_ratings(db, [restaurant])[0]


@router.delete("/restaurant/image", response_model=RestaurantOut)
def remove_restaurant_image(restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    old = restaurant.image_url
    restaurant.image_url = None
    db.commit()
    delete_media_file(old)
    return attach_ratings(db, [restaurant])[0]


# ---------- menu ----------
@router.get("/menu", response_model=Page[MenuItemOut])
def list_menu(
    params: PageParams = Depends(),
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    stmt = select(MenuItem).where(MenuItem.restaurant_id == restaurant.id).order_by(MenuItem.category, MenuItem.name)
    return paginate(db, stmt, params)


@router.post("/menu", response_model=MenuItemOut, status_code=201)
def add_menu_item(
    payload: MenuItemIn, restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)
):
    item = MenuItem(restaurant_id=restaurant.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return item


@router.put("/menu/{item_id}", response_model=MenuItemOut)
def update_menu_item(
    item_id: int,
    payload: MenuItemUpdate,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    item = _menu_item(db, item_id, restaurant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in ("name", "price", "is_available"):
            continue
        setattr(item, field, value)
    db.commit()
    return item


@router.patch("/menu/{item_id}/availability", response_model=MenuItemOut)
def set_availability(
    item_id: int,
    payload: AvailabilityIn,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    item = _menu_item(db, item_id, restaurant)
    item.is_available = payload.is_available
    db.commit()
    return item


@router.delete("/menu/{item_id}", status_code=204)
def delete_menu_item(item_id: int, restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    item = _menu_item(db, item_id, restaurant)
    files = [m.url for m in item.media] + [item.image_url]
    db.delete(item)
    db.commit()
    for url in set(files):
        delete_media_file(url)


# ---------- dish photos & videos ----------
@router.post("/menu/{item_id}/media", response_model=MediaOut, status_code=201)
def add_menu_media(
    item_id: int,
    file: UploadFile = File(...),
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    item = _menu_item(db, item_id, restaurant)
    limit = get_settings().max_media_per_dish
    if len(item.media) >= limit:
        raise HTTPException(status_code=409, detail=f"A dish can have at most {limit} photos/videos")
    url, kind = save_upload(file, "dishes", allow_video=True)
    media = MenuItemMedia(menu_item_id=item.id, kind=kind, url=url)
    db.add(media)
    # The first photo becomes the dish thumbnail.
    if kind == "image" and not item.image_url:
        item.image_url = url
    db.commit()
    return media


@router.delete("/menu/{item_id}/media/{media_id}", status_code=204)
def delete_menu_media(
    item_id: int,
    media_id: int,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    item = _menu_item(db, item_id, restaurant)
    media = next((m for m in item.media if m.id == media_id), None)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    item.media.remove(media)
    if item.image_url == media.url:
        item.image_url = next((m.url for m in item.media if m.kind == "image"), None)
    db.commit()
    delete_media_file(media.url)


# ---------- orders ----------
@router.get("/orders", response_model=Page[OrderOut])
def restaurant_orders(
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    params: PageParams = Depends(),
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    stmt = select(Order).where(Order.restaurant_id == restaurant.id).order_by(Order.created_at.desc(), Order.id.desc())
    stmt = apply_order_filters(stmt, status, date_from, date_to)
    return paginate(db, stmt, params, options=ORDER_OPTIONS)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    payload: StatusUpdateIn,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    order = _restaurant_order(db, order_id, restaurant)
    if payload.status.upper() == S.ASSIGNED:
        raise HTTPException(status_code=400, detail="Use the assign endpoint to assign a delivery partner")
    change_status(db, order, payload.status, Role.RESTAURANT_OWNER)
    db.commit()
    return load_order(db, order.id)


@router.get("/delivery-partners", response_model=list[UserOut])
def delivery_partners(_: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.role == Role.DELIVERY_PARTNER).order_by(User.name)).all()


@router.post("/orders/{order_id}/assign", response_model=OrderOut)
def assign_delivery_partner(
    order_id: int,
    payload: AssignIn,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    order = _restaurant_order(db, order_id, restaurant)
    partner = db.get(User, payload.delivery_partner_id)
    if partner is None or partner.role != Role.DELIVERY_PARTNER:
        raise HTTPException(status_code=400, detail="Selected user is not a delivery partner")
    if order.status != S.READY:
        raise HTTPException(status_code=409, detail=f"Delivery partners can only be assigned to READY orders (current: {order.status})")
    change_status(db, order, S.ASSIGNED, Role.RESTAURANT_OWNER)
    order.delivery_partner_id = partner.id
    db.commit()
    return load_order(db, order.id)


# ---------- returns ----------
@router.get("/returns", response_model=Page[ReturnDetailOut])
def list_returns(
    status: Optional[str] = None,
    params: PageParams = Depends(),
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    stmt = (
        select(ReturnRequest)
        .join(Order, Order.id == ReturnRequest.order_id)
        .where(Order.restaurant_id == restaurant.id)
        .order_by(ReturnRequest.created_at.desc())
    )
    if status:
        stmt = stmt.where(ReturnRequest.status == status.lower())
    return paginate(db, stmt, params, options=(joinedload(ReturnRequest.order).joinedload(Order.customer),))


def _pending_return(db: Session, return_id: int, restaurant: Restaurant) -> ReturnRequest:
    req = db.scalar(
        select(ReturnRequest)
        .join(Order, Order.id == ReturnRequest.order_id)
        .where(ReturnRequest.id == return_id, Order.restaurant_id == restaurant.id)
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Return request not found")
    if req.status != ReturnStatus.PENDING:
        raise HTTPException(status_code=409, detail=f"This request was already {req.status}")
    return req


@router.post("/returns/{return_id}/approve", response_model=ReturnDetailOut)
def approve_return(
    return_id: int,
    payload: ReturnDecisionIn,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    req = _pending_return(db, return_id, restaurant)
    order = req.order
    change_status(db, order, S.REFUNDED, "system")
    record_refund(db, order)
    req.status = ReturnStatus.APPROVED
    req.owner_note = payload.note
    req.resolved_at = utcnow()
    db.commit()
    return req


@router.post("/returns/{return_id}/reject", response_model=ReturnDetailOut)
def reject_return(
    return_id: int,
    payload: ReturnDecisionIn,
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    req = _pending_return(db, return_id, restaurant)
    req.status = ReturnStatus.REJECTED
    req.owner_note = payload.note
    req.resolved_at = utcnow()
    db.commit()
    return req


# ---------- reminders & stats ----------
@router.get("/reminders", response_model=Page[ReminderOut])
def reminders(
    params: PageParams = Depends(),
    restaurant: Restaurant = Depends(get_owner_restaurant),
    db: Session = Depends(get_db),
):
    stmt = (
        select(ReminderLog)
        .where(ReminderLog.restaurant_id == restaurant.id, ReminderLog.resolved.is_(False))
        .order_by(ReminderLog.created_at.desc())
    )
    return paginate(db, stmt, params)


@router.post("/reminders/scan")
def run_reminder_scan(restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    return {"created": scan_reminders(db, restaurant.id)}


@router.get("/stats", response_model=OwnerStats)
def stats(restaurant: Restaurant = Depends(get_owner_restaurant), db: Session = Depends(get_db)):
    by_status = dict(
        db.execute(
            select(Order.status, func.count(Order.id)).where(Order.restaurant_id == restaurant.id).group_by(Order.status)
        ).all()
    )
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.restaurant_id == restaurant.id, Order.status == S.DELIVERED
        )
    )
    avg_rating, review_count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.restaurant_id == restaurant.id)
    ).one()
    pending_returns = db.scalar(
        select(func.count(ReturnRequest.id))
        .join(Order, Order.id == ReturnRequest.order_id)
        .where(Order.restaurant_id == restaurant.id, ReturnRequest.status == ReturnStatus.PENDING)
    )
    open_reminders = db.scalar(
        select(func.count(ReminderLog.id)).where(
            ReminderLog.restaurant_id == restaurant.id, ReminderLog.resolved.is_(False)
        )
    )
    top = db.execute(
        select(OrderItem.name, func.sum(OrderItem.quantity).label("qty"))
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.restaurant_id == restaurant.id, Order.status.notin_([S.CANCELLED, S.REFUNDED]))
        .group_by(OrderItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    ).all()
    return OwnerStats(
        total_orders=sum(by_status.values()),
        active_orders=sum(by_status.get(s, 0) for s in ACTIVE_STATUSES),
        delivered_orders=by_status.get(S.DELIVERED, 0),
        cancelled_orders=by_status.get(S.CANCELLED, 0),
        refunded_orders=by_status.get(S.REFUNDED, 0),
        revenue=float(revenue or 0),
        average_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
        review_count=review_count,
        pending_returns=pending_returns or 0,
        open_reminders=open_reminders or 0,
        orders_by_status=by_status,
        top_items=[TopItem(name=n, quantity=int(q)) for n, q in top],
    )
