from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import PageParams, paginate
from ..models import MenuItem, Restaurant, Review
from ..schemas import MenuItemOut, Page, RestaurantOut, ReviewOut

router = APIRouter(prefix="/restaurants", tags=["Restaurants"])


def attach_ratings(db: Session, restaurants: list[Restaurant]) -> list[Restaurant]:
    ids = [r.id for r in restaurants]
    stats = {}
    if ids:
        rows = db.execute(
            select(Review.restaurant_id, func.avg(Review.rating), func.count(Review.id))
            .where(Review.restaurant_id.in_(ids))
            .group_by(Review.restaurant_id)
        ).all()
        stats = {rid: (float(avg), cnt) for rid, avg, cnt in rows}
    for r in restaurants:
        avg, cnt = stats.get(r.id, (None, 0))
        r.avg_rating = round(avg, 2) if avg is not None else None
        r.review_count = cnt
    return restaurants


@router.get("", response_model=Page[RestaurantOut])
def list_restaurants(
    search: Optional[str] = Query(None, max_length=100),
    cuisine: Optional[str] = Query(None, max_length=80),
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    stmt = select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.name)
    if search:
        stmt = stmt.where(Restaurant.name.ilike(f"%{search}%"))
    if cuisine:
        stmt = stmt.where(Restaurant.cuisine.ilike(cuisine))
    result = paginate(db, stmt, params)
    attach_ratings(db, result["items"])
    return result


@router.get("/{restaurant_id}", response_model=RestaurantOut)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return attach_ratings(db, [restaurant])[0]


@router.get("/{restaurant_id}/menu", response_model=Page[MenuItemOut])
def restaurant_menu(
    restaurant_id: int,
    search: Optional[str] = Query(None, max_length=100),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    category: Optional[str] = Query(None, max_length=80),
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    stmt = select(MenuItem).where(MenuItem.restaurant_id == restaurant_id).order_by(MenuItem.category, MenuItem.name)
    if search:
        stmt = stmt.where(MenuItem.name.ilike(f"%{search}%"))
    if min_price is not None:
        stmt = stmt.where(MenuItem.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(MenuItem.price <= max_price)
    if category:
        stmt = stmt.where(MenuItem.category.ilike(category))
    return paginate(db, stmt, params)


@router.get("/{restaurant_id}/reviews", response_model=Page[ReviewOut])
def restaurant_reviews(restaurant_id: int, params: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(Review).where(Review.restaurant_id == restaurant_id).order_by(Review.created_at.desc())
    return paginate(db, stmt, params, options=(joinedload(Review.customer),))
