import io
from datetime import date

from app.database import SessionLocal
from app.models import PaymentCard

from .conftest import login

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


def _file(content: bytes, name: str, mime: str):
    return {"file": (name, io.BytesIO(content), mime)}


def test_profile_update_and_dob_rules(client):
    customer = login(client, "customer@campusbite.dev")
    res = client.put(
        "/profile",
        headers=customer,
        json={"phone": "+91 98765 43210", "date_of_birth": "2001-05-20", "bio": "Loves biryani"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["date_of_birth"] == "2001-05-20"
    assert client.get("/profile", headers=customer).json()["bio"] == "Loves biryani"

    future = date.today().replace(year=date.today().year + 1).isoformat()
    assert client.put("/profile", headers=customer, json={"date_of_birth": future}).status_code == 422
    # Vehicle details are only for delivery partners.
    assert client.put("/profile", headers=customer, json={"vehicle_type": "car"}).status_code == 422

    driver = login(client, "driver1@campusbite.dev")
    teen = date.today().replace(year=date.today().year - 16).isoformat()
    assert client.put("/profile", headers=driver, json={"date_of_birth": teen}).status_code == 422
    res = client.put("/profile", headers=driver, json={"vehicle_type": "scooter", "vehicle_number": "KA01AB1234"})
    assert res.status_code == 200 and res.json()["vehicle_type"] == "scooter"


def test_cards_never_store_full_number_or_cvv(client):
    customer = login(client, "customer@campusbite.dev")
    bad = {"cardholder_name": "Demo", "number": "4111 1111 1111 1112", "exp_month": 12, "exp_year": 2099, "cvv": "123"}
    assert client.post("/profile/cards", headers=customer, json=bad).status_code == 422
    expired = {**bad, "number": "4111 1111 1111 1111", "exp_year": 2001}
    assert client.post("/profile/cards", headers=customer, json=expired).status_code == 422

    good = {**bad, "number": "4111 1111 1111 1111"}
    res = client.post("/profile/cards", headers=customer, json=good)
    assert res.status_code == 201, res.text
    card = res.json()
    assert card["brand"] == "visa" and card["last4"] == "1111" and card["is_default"] is True
    assert "number" not in card and "cvv" not in card
    assert client.post("/profile/cards", headers=customer, json=good).status_code == 409

    with SessionLocal() as db:
        row = db.get(PaymentCard, card["id"])
        columns = {c.name for c in row.__table__.columns}
        stored = " ".join(str(getattr(row, c)) for c in columns)
    assert not ({"number", "card_number", "cvv"} & columns)
    assert "4111111111111111" not in stored

    # Other users cannot touch this card.
    owner = login(client, "owner1@campusbite.dev")
    assert client.delete(f"/profile/cards/{card['id']}", headers=owner).status_code == 404

    mc = {**good, "number": "5555 5555 5555 4444"}
    second = client.post("/profile/cards", headers=customer, json=mc).json()
    assert second["brand"] == "mastercard" and second["is_default"] is False
    cards = client.post(f"/profile/cards/{second['id']}/default", headers=customer).json()
    assert [c["id"] for c in cards if c["is_default"]] == [second["id"]]
    assert client.delete(f"/profile/cards/{second['id']}", headers=customer).status_code == 204
    remaining = client.get("/profile/cards", headers=customer).json()
    assert remaining[0]["is_default"] is True


def test_avatar_upload_validates_file_type(client):
    driver = login(client, "driver1@campusbite.dev")
    fake = _file(b"<svg onload=alert(1)>", "x.png", "image/png")
    assert client.post("/profile/avatar", headers=driver, files=fake).status_code == 415

    res = client.post("/profile/avatar", headers=driver, files=_file(PNG, "me.png", "image/png"))
    assert res.status_code == 200, res.text
    url = res.json()["avatar_url"]
    assert url.startswith("/media/avatars/") and url.endswith(".png")
    assert client.get(url).status_code == 200
    assert client.get("/auth/me", headers=driver).json()["avatar_url"] == url

    assert client.delete("/profile/avatar", headers=driver).json()["avatar_url"] is None
    assert client.get(url).status_code == 404


def test_password_change(client):
    driver2 = login(client, "driver2@campusbite.dev")
    wrong = {"current_password": "nope-nope", "new_password": "NewPassword@1"}
    assert client.post("/profile/password", headers=driver2, json=wrong).status_code == 400
    ok = {"current_password": "Password@123", "new_password": "NewPassword@1"}
    assert client.post("/profile/password", headers=driver2, json=ok).status_code == 204
    login(client, "driver2@campusbite.dev", "NewPassword@1")
    back = {"current_password": "NewPassword@1", "new_password": "Password@123"}
    assert client.post("/profile/password", headers=driver2, json=back).status_code == 204


def test_owner_dish_media(client):
    owner = login(client, "owner1@campusbite.dev")
    item = client.get("/owner/menu", headers=owner).json()["items"][0]

    res = client.post(f"/owner/menu/{item['id']}/media", headers=owner, files=_file(PNG, "dish.png", "image/png"))
    assert res.status_code == 201, res.text
    photo = res.json()
    assert photo["kind"] == "image"
    res = client.post(f"/owner/menu/{item['id']}/media", headers=owner, files=_file(MP4, "dish.mp4", "video/mp4"))
    assert res.status_code == 201 and res.json()["kind"] == "video"
    video = res.json()

    public = client.get(f"/restaurants/{item['restaurant_id']}/menu", params={"search": item["name"]}).json()["items"][0]
    assert [m["kind"] for m in public["media"]] == ["image", "video"]
    assert public["image_url"] == photo["url"]

    # A different owner and a customer cannot manage this dish's media.
    owner2 = login(client, "owner2@campusbite.dev")
    customer = login(client, "customer@campusbite.dev")
    assert client.post(f"/owner/menu/{item['id']}/media", headers=owner2, files=_file(PNG, "x.png", "image/png")).status_code == 404
    assert client.post(f"/owner/menu/{item['id']}/media", headers=customer, files=_file(PNG, "x.png", "image/png")).status_code == 403
    assert client.post(f"/owner/menu/{item['id']}/media", headers=owner, files=_file(b"MZ\x90\x00", "a.exe", "video/mp4")).status_code == 415

    assert client.delete(f"/owner/menu/{item['id']}/media/{photo['id']}", headers=owner).status_code == 204
    assert client.delete(f"/owner/menu/{item['id']}/media/{video['id']}", headers=owner).status_code == 204
    after = client.get("/owner/menu", headers=owner).json()["items"][0]
    assert after["media"] == [] and after["image_url"] is None
    assert client.get(photo["url"]).status_code == 404


def test_restaurant_cover_and_details(client):
    owner = login(client, "owner1@campusbite.dev")
    res = client.post("/owner/restaurant/image", headers=owner, files=_file(PNG, "cover.png", "image/png"))
    assert res.status_code == 200 and res.json()["image_url"].startswith("/media/restaurants/")
    res = client.put("/owner/restaurant", headers=owner, json={"phone": "080-1234567", "opening_hours": "10:00 - 22:00"})
    assert res.status_code == 200 and res.json()["opening_hours"] == "10:00 - 22:00"
    public = client.get(f"/restaurants/{res.json()['id']}").json()
    assert public["phone"] == "080-1234567" and public["image_url"]
