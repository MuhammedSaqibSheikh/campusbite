from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    MenuItem,
    Order,
    OrderItem,
    OrderStatus as S,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    Role,
    User,
)
from .security import hash_password
from .utils import utcnow

DEMO_PASSWORD = "Password@123"

MENUS = {
    "Spice Route": ("Indian", "North and South Indian classics.", [
        ("Paneer Butter Masala", "Creamy tomato gravy with paneer", 220, "Mains"),
        ("Chicken Biryani", "Hyderabadi style, with raita", 260, "Mains"),
        ("Garlic Naan", "Tandoor baked", 40, "Breads"),
        ("Masala Dosa", "Crisp dosa with potato filling", 120, "Breakfast"),
        ("Mango Lassi", "Chilled and sweet", 70, "Drinks"),
    ]),
    "Campus Pizza Co.": ("Italian", "Wood-fired pizzas and pasta.", [
        ("Margherita Pizza", "Mozzarella and basil", 249, "Pizza"),
        ("Farmhouse Pizza", "Loaded with veggies", 329, "Pizza"),
        ("Penne Arrabbiata", "Spicy tomato sauce", 199, "Pasta"),
        ("Garlic Bread", "Toasted with herb butter", 99, "Sides"),
        ("Cold Coffee", "Blended with ice cream", 110, "Drinks"),
    ]),
}


def _user(db: Session, name: str, email: str, role: str, **extra) -> User:
    user = User(name=name, email=email, password_hash=hash_password(DEMO_PASSWORD), role=role, **extra)
    db.add(user)
    db.flush()
    return user


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return

    customer = _user(db, "Demo Customer", "customer@campusbite.dev", Role.CUSTOMER,
                     phone="9000000001", address="Hostel Block C, Room 214")
    _user(db, "Demo Driver One", "driver1@campusbite.dev", Role.DELIVERY_PARTNER, phone="9000000011")
    _user(db, "Demo Driver Two", "driver2@campusbite.dev", Role.DELIVERY_PARTNER, phone="9000000012")

    restaurants = []
    for idx, (name, (cuisine, description, items)) in enumerate(MENUS.items(), start=1):
        owner = _user(db, f"Owner {name}", f"owner{idx}@campusbite.dev", Role.RESTAURANT_OWNER)
        restaurant = Restaurant(owner_id=owner.id, name=name, cuisine=cuisine, description=description,
                                address="Campus Food Court")
        restaurant.menu_items = [
            MenuItem(name=n, description=d, price=Decimal(p), category=c) for n, d, p, c in items
        ]
        db.add(restaurant)
        restaurants.append(restaurant)
    db.flush()

    # A little history so the AI insights work straight away.
    now = utcnow()
    for days_ago, restaurant in ((1, restaurants[0]), (3, restaurants[1]), (10, restaurants[0])):
        dishes = restaurant.menu_items[:2]
        total = sum((m.price * 1 for m in dishes), Decimal(0))
        order = Order(
            customer_id=customer.id,
            restaurant_id=restaurant.id,
            status=S.DELIVERED,
            payment_status=PaymentStatus.MOCK_PAID,
            total_amount=total,
            delivery_address=customer.address,
            created_at=now - timedelta(days=days_ago),
            status_updated_at=now - timedelta(days=days_ago),
            items=[OrderItem(menu_item_id=m.id, name=m.name, price=m.price, quantity=1) for m in dishes],
        )
        db.add(order)
        db.flush()
        db.add(PaymentLedger(order_id=order.id, entry_type="PAYMENT", amount=total,
                             status=PaymentStatus.MOCK_PAID, reference=f"SEED-{order.id}"))
    db.commit()
