from datetime import timedelta

from app.database import SessionLocal
from app.models import Order, ReminderLog
from app.services import scan_reminders
from app.utils import utcnow

from .conftest import login


def _owner1_restaurant(client):
    return client.get("/owner/restaurant", headers=login(client, "owner1@campusbite.dev")).json()


def _place_order(client, headers):
    restaurant = _owner1_restaurant(client)
    menu = client.get(f"/restaurants/{restaurant['id']}/menu").json()["items"]
    res = client.post(
        "/orders",
        headers=headers,
        json={
            "restaurant_id": restaurant["id"],
            "delivery_address": "Hostel Block C",
            "items": [{"menu_item_id": menu[0]["id"], "quantity": 2}],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_full_order_lifecycle_with_return(client):
    customer = login(client, "customer@campusbite.dev")
    owner = login(client, "owner1@campusbite.dev")
    driver = login(client, "driver1@campusbite.dev")

    order = _place_order(client, customer)
    oid = order["id"]
    assert order["status"] == "PLACED"
    assert order["payment_status"] == "mock_paid"

    # invalid jumps are rejected
    res = client.patch(f"/owner/orders/{oid}/status", headers=owner, json={"status": "READY"})
    assert res.status_code == 409

    for status in ("ACCEPTED", "PREPARING", "READY"):
        res = client.patch(f"/owner/orders/{oid}/status", headers=owner, json={"status": status})
        assert res.status_code == 200, res.text

    partners = client.get("/owner/delivery-partners", headers=owner).json()
    res = client.post(f"/owner/orders/{oid}/assign", headers=owner, json={"delivery_partner_id": partners[0]["id"]})
    assert res.status_code == 200 and res.json()["status"] == "ASSIGNED"

    # only the assigned partner can progress it
    other = login(client, "driver2@campusbite.dev")
    assert client.patch(f"/delivery/orders/{oid}/status", headers=other, json={"status": "OUT_FOR_DELIVERY"}).status_code == 404
    assert client.patch(f"/delivery/orders/{oid}/status", headers=driver, json={"status": "DELIVERED"}).status_code == 409
    assert client.patch(f"/delivery/orders/{oid}/status", headers=driver, json={"status": "OUT_FOR_DELIVERY"}).status_code == 200
    assert client.patch(f"/delivery/orders/{oid}/status", headers=driver, json={"status": "DELIVERED"}).status_code == 200

    # delivered orders cannot be cancelled
    assert client.post(f"/orders/{oid}/cancel", headers=customer).status_code == 409

    assert client.post(f"/orders/{oid}/review", headers=customer, json={"rating": 5, "comment": "Great"}).status_code == 201
    assert client.post(f"/orders/{oid}/review", headers=customer, json={"rating": 4}).status_code == 409

    ret = client.post(f"/orders/{oid}/return", headers=customer, json={"reason": "Food was cold"})
    assert ret.status_code == 201
    assert client.post(f"/orders/{oid}/return", headers=customer, json={"reason": "Again please"}).status_code == 409

    res = client.post(f"/owner/returns/{ret.json()['id']}/approve", headers=owner, json={})
    assert res.status_code == 200 and res.json()["status"] == "approved"
    final = client.get(f"/orders/{oid}", headers=customer).json()
    assert final["status"] == "REFUNDED" and final["payment_status"] == "refunded"


def test_cancel_only_when_placed(client):
    customer = login(client, "customer@campusbite.dev")
    owner = login(client, "owner1@campusbite.dev")
    order = _place_order(client, customer)
    client.patch(f"/owner/orders/{order['id']}/status", headers=owner, json={"status": "ACCEPTED"})
    assert client.post(f"/orders/{order['id']}/cancel", headers=customer).status_code == 409

    second = _place_order(client, customer)
    res = client.post(f"/orders/{second['id']}/cancel", headers=customer)
    assert res.status_code == 200 and res.json()["status"] == "CANCELLED"
    assert res.json()["payment_status"] == "refunded"


def test_role_and_ownership_enforcement(client):
    customer = login(client, "customer@campusbite.dev")
    owner2 = login(client, "owner2@campusbite.dev")
    assert client.get("/owner/orders", headers=customer).status_code == 403
    assert client.get("/delivery/orders", headers=customer).status_code == 403
    assert client.get("/orders").status_code == 401

    order = _place_order(client, customer)
    assert client.patch(f"/owner/orders/{order['id']}/status", headers=owner2, json={"status": "ACCEPTED"}).status_code == 404

    reg = client.post(
        "/auth/register",
        json={"name": "Other Person", "email": "other@example.com", "password": "Password@123"},
    )
    assert reg.status_code == 201
    stranger = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    assert client.get(f"/orders/{order['id']}", headers=stranger).status_code == 404
    assert client.post(f"/orders/{order['id']}/cancel", headers=stranger).status_code == 404


def test_menu_search_and_price_filter(client):
    rid = _owner1_restaurant(client)["id"]
    res = client.get(f"/restaurants/{rid}/menu", params={"max_price": 100})
    assert res.status_code == 200
    assert all(i["price"] <= 100 for i in res.json()["items"])
    res = client.get(f"/restaurants/{rid}/menu", params={"search": "biryani"})
    assert [i["name"] for i in res.json()["items"]] == ["Chicken Biryani"]


def test_reminder_scan_creates_one_reminder_per_stale_order(client):
    customer = login(client, "customer@campusbite.dev")
    order = _place_order(client, customer)
    with SessionLocal() as db:
        db.get(Order, order["id"]).status_updated_at = utcnow() - timedelta(minutes=30)
        db.commit()
        assert scan_reminders(db) >= 1
        assert scan_reminders(db) == 0
        assert db.query(ReminderLog).filter_by(order_id=order["id"], resolved=False).count() == 1

    owner = login(client, "owner1@campusbite.dev")
    res = client.get("/owner/reminders", headers=owner)
    assert any(r["order_id"] == order["id"] for r in res.json()["items"])
    assert client.get("/owner/stats", headers=owner).json()["open_reminders"] >= 1


def test_ai_requires_configuration_and_customer_role(client):
    customer = login(client, "customer@campusbite.dev")
    owner = login(client, "owner1@campusbite.dev")
    assert client.post("/ai/summary", headers=customer).status_code == 503
    assert client.post("/ai/ask", headers=owner, json={"question": "what did I spend?"}).status_code == 403
