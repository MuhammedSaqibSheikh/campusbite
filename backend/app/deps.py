from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Restaurant, User
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
    except (PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_roles(*roles: str):
    """Authorization is checked against the role stored in the database, not the token."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this resource")
        return user

    return checker


def get_owner_restaurant(
    user: User = Depends(require_roles("restaurant_owner")),
    db: Session = Depends(get_db),
) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.owner_id == user.id))
    if restaurant is None:
        raise HTTPException(status_code=404, detail="No restaurant is linked to this account")
    return restaurant


class PageParams:
    def __init__(
        self,
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=100),
    ):
        self.page = page
        self.page_size = page_size


def paginate(db: Session, stmt, params: PageParams, options: tuple = ()) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(
        stmt.options(*options).offset((params.page - 1) * params.page_size).limit(params.page_size)
    ).all()
    pages = max(1, -(-total // params.page_size))
    return {"items": rows, "total": total, "page": params.page, "page_size": params.page_size, "pages": pages}
