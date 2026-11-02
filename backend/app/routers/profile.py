from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..media import delete_media_file, save_upload
from ..models import PaymentCard, Role, User
from ..schemas import CardIn, CardOut, PasswordChangeIn, ProfileOut, ProfileUpdate, years_between, card_brand
from ..security import hash_password, verify_password
from ..utils import utcnow

router = APIRouter(prefix="/profile", tags=["Profile"])

MAX_CARDS = 5


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    if user.role != Role.DELIVERY_PARTNER and ({"vehicle_type", "vehicle_number"} & data.keys()):
        if data.get("vehicle_type") or data.get("vehicle_number"):
            raise HTTPException(status_code=422, detail="Vehicle details are only for delivery partners")
        data.pop("vehicle_type", None)
        data.pop("vehicle_number", None)
    dob = data.get("date_of_birth")
    if dob and user.role == Role.DELIVERY_PARTNER and years_between(dob, utcnow().date()) < 18:
        raise HTTPException(status_code=422, detail="Delivery partners must be at least 18 years old")
    if "name" in data and not data["name"]:
        data.pop("name")
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(user, field, value)
    db.commit()
    return user


@router.post("/avatar", response_model=ProfileOut)
def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    url, _ = save_upload(file, "avatars")
    old = user.avatar_url
    user.avatar_url = url
    db.commit()
    delete_media_file(old)
    return user


@router.delete("/avatar", response_model=ProfileOut)
def remove_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    old = user.avatar_url
    user.avatar_url = None
    db.commit()
    delete_media_file(old)
    return user


@router.post("/password", status_code=204)
def change_password(payload: PasswordChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current one")
    user.password_hash = hash_password(payload.new_password)
    db.commit()


# ---------- dummy payment cards ----------
def _cards(db: Session, user: User) -> list[PaymentCard]:
    return db.scalars(
        select(PaymentCard).where(PaymentCard.user_id == user.id).order_by(PaymentCard.is_default.desc(), PaymentCard.id)
    ).all()


def _own_card(db: Session, card_id: int, user: User) -> PaymentCard:
    card = db.get(PaymentCard, card_id)
    if card is None or card.user_id != user.id:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/cards", response_model=list[CardOut])
def list_cards(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _cards(db, user)


@router.post("/cards", response_model=CardOut, status_code=201)
def add_card(payload: CardIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = _cards(db, user)
    if len(existing) >= MAX_CARDS:
        raise HTTPException(status_code=409, detail=f"You can save up to {MAX_CARDS} cards")
    last4 = payload.number[-4:]
    if any(c.last4 == last4 and (c.exp_month, c.exp_year) == (payload.exp_month, payload.exp_year) for c in existing):
        raise HTTPException(status_code=409, detail="This card is already saved")
    # Only non-sensitive details are persisted; the full number and CVV are dropped here.
    card = PaymentCard(
        user_id=user.id,
        cardholder_name=payload.cardholder_name.strip(),
        brand=card_brand(payload.number),
        last4=last4,
        exp_month=payload.exp_month,
        exp_year=payload.exp_year,
        is_default=not existing,
    )
    db.add(card)
    db.commit()
    return card


@router.post("/cards/{card_id}/default", response_model=list[CardOut])
def make_default(card_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = _own_card(db, card_id, user)
    for card in _cards(db, user):
        card.is_default = card.id == target.id
    db.commit()
    return _cards(db, user)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    card = _own_card(db, card_id, user)
    was_default = card.is_default
    db.delete(card)
    db.flush()
    if was_default:
        remaining = _cards(db, user)
        if remaining:
            remaining[0].is_default = True
    db.commit()
