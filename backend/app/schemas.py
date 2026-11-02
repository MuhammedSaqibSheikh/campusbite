from datetime import date, datetime
from typing import Generic, Literal, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .utils import utcnow

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------- auth / users ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Literal["customer", "restaurant_owner", "delivery_partner"] = "customer"
    phone: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=255)
    restaurant_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    cuisine: Optional[str] = Field(default=None, max_length=80)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class UserOut(ORM):
    id: int
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- profile ----------
VehicleType = Literal["bicycle", "scooter", "motorbike", "car", "on_foot"]


def years_between(born: date, today: date) -> int:
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


class ProfileOut(UserOut):
    date_of_birth: Optional[date] = None
    bio: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    created_at: datetime


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30, pattern=r"^[0-9+()\-\s]{6,30}$")
    address: Optional[str] = Field(default=None, max_length=255)
    date_of_birth: Optional[date] = None
    bio: Optional[str] = Field(default=None, max_length=300)
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = Field(default=None, max_length=20)

    @field_validator("date_of_birth")
    @classmethod
    def sensible_dob(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        age = years_between(v, utcnow().date())
        if v > utcnow().date():
            raise ValueError("Date of birth cannot be in the future")
        if age < 13:
            raise ValueError("You must be at least 13 years old")
        if age > 120:
            raise ValueError("Please enter a valid date of birth")
        return v


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


def _luhn_ok(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def card_brand(number: str) -> str:
    if number[:2] in ("34", "37"):
        return "amex"
    if number.startswith("4"):
        return "visa"
    if 51 <= int(number[:2]) <= 55 or 2221 <= int(number[:4]) <= 2720:
        return "mastercard"
    if number.startswith(("6011", "65")) or 644 <= int(number[:3]) <= 649:
        return "discover"
    if number.startswith(("60", "81", "82", "508")):
        return "rupay"
    return "card"


class CardIn(BaseModel):
    """Dummy card. `number` and `cvv` are validated, then discarded; only brand/last4/expiry are stored."""

    cardholder_name: str = Field(min_length=2, max_length=100)
    number: str = Field(min_length=12, max_length=23)
    exp_month: int = Field(ge=1, le=12)
    exp_year: int = Field(ge=2000, le=2100)
    cvv: str = Field(pattern=r"^\d{3,4}$")

    @field_validator("number")
    @classmethod
    def valid_number(cls, v: str) -> str:
        digits = v.replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 12 <= len(digits) <= 19:
            raise ValueError("Card number must be 12-19 digits")
        if not _luhn_ok(digits):
            raise ValueError("Card number is not valid")
        return digits

    @model_validator(mode="after")
    def not_expired(self):
        today = utcnow().date()
        if (self.exp_year, self.exp_month) < (today.year, today.month):
            raise ValueError("Card has expired")
        return self


class CardOut(ORM):
    id: int
    cardholder_name: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool


# ---------- restaurants / menu ----------
class RestaurantOut(ORM):
    id: int
    name: str
    description: Optional[str] = None
    cuisine: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    is_active: bool
    avg_rating: Optional[float] = None
    review_count: int = 0


class RestaurantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    cuisine: Optional[str] = Field(default=None, max_length=80)
    address: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = Field(default=None, max_length=500)
    phone: Optional[str] = Field(default=None, max_length=30)
    opening_hours: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class MenuItemIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    price: float = Field(gt=0, le=100000)
    category: Optional[str] = Field(default=None, max_length=80)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: bool = True


class MenuItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0, le=100000)
    category: Optional[str] = Field(default=None, max_length=80)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: Optional[bool] = None


class AvailabilityIn(BaseModel):
    is_available: bool


class MediaOut(ORM):
    id: int
    kind: str
    url: str


class MenuItemOut(ORM):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str] = None
    price: float
    category: Optional[str] = None
    image_url: Optional[str] = None
    is_available: bool
    media: list[MediaOut] = []


# ---------- orders ----------
class OrderLineIn(BaseModel):
    menu_item_id: int
    quantity: int = Field(ge=1, le=50)


class OrderCreate(BaseModel):
    restaurant_id: int
    delivery_address: str = Field(min_length=5, max_length=255)
    items: list[OrderLineIn] = Field(min_length=1, max_length=50)
    # Optional saved dummy card; only shown on the payment reference.
    payment_card_id: Optional[int] = None


class OrderItemOut(ORM):
    id: int
    menu_item_id: Optional[int] = None
    name: str
    price: float
    quantity: int


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


class ReviewOut(ORM):
    id: int
    order_id: int
    customer_name: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime


class ReturnIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class ReturnDecisionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class ReturnOut(ORM):
    id: int
    order_id: int
    reason: str
    status: str
    owner_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


class ReturnDetailOut(ReturnOut):
    customer_name: str
    order_total: float


class OrderOut(ORM):
    id: int
    customer_id: int
    customer_name: str
    customer_phone: Optional[str] = None
    restaurant_id: int
    restaurant_name: str
    delivery_partner_id: Optional[int] = None
    delivery_partner_name: Optional[str] = None
    status: str
    payment_status: str
    total_amount: float
    delivery_address: str
    created_at: datetime
    status_updated_at: datetime
    items: list[OrderItemOut]
    review: Optional[ReviewOut] = None
    return_request: Optional[ReturnOut] = None


class StatusUpdateIn(BaseModel):
    status: str


class AssignIn(BaseModel):
    delivery_partner_id: int


# ---------- owner extras ----------
class ReminderOut(ORM):
    id: int
    order_id: int
    order_status: str
    message: str
    resolved: bool
    created_at: datetime


class TopItem(BaseModel):
    name: str
    quantity: int


class OwnerStats(BaseModel):
    total_orders: int
    active_orders: int
    delivered_orders: int
    cancelled_orders: int
    refunded_orders: int
    revenue: float
    average_rating: Optional[float]
    review_count: int
    pending_returns: int
    open_reminders: int
    orders_by_status: dict[str, int]
    top_items: list[TopItem]


# ---------- AI ----------
class AIQuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class AIOut(BaseModel):
    answer: str
    orders_considered: int
