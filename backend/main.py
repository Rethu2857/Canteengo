from datetime import datetime, timedelta
import os
import secrets
import base64
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode

import qrcode
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .database import Base, engine, get_db
from .models import User, FoodItem, Order, OrderItem, ActivityLog, DailyMenu
from .schemas import (
    LoginRequest, RegisterRequest, CreateOrderRequest, StatusRequest,
    FoodCreate, FoodUpdate, DailyMenuCreate, VerifyQRRequest
)
from .auth import hash_password, verify_password, create_token, current_user, require_admin

Base.metadata.create_all(bind=engine)
from . import seed as _seed

DATASET_DIR = Path(__file__).resolve().parent.parent / "datasets"

app = FastAPI(title="Smart College Canteen API", version="1.0")
app.mount("/dataset", StaticFiles(directory=str(DATASET_DIR)), name="dataset")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "https://canteengo-1694.vercel.app"
    ).split(",") if origin.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):(5173|5174|5175|4173|3000)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PICKUP_MINUTES = 20


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def resolve_dataset_image_url(name: str) -> str:
    if not name:
        return ""

    target = normalize_name(name)
    if not target:
        return ""

    for file in sorted(DATASET_DIR.iterdir()):
        if not file.is_file():
            continue
        if normalize_name(file.stem) == target:
            return f"/dataset/{file.name}"

    for file in sorted(DATASET_DIR.iterdir()):
        if not file.is_file():
            continue
        if target in normalize_name(file.stem):
            return f"/dataset/{file.name}"

    return ""


def add_log(db, user, action, details=""):
    db.add(ActivityLog(
        user_id=user.id if user else None,
        actor_name=user.name if user else "SYSTEM",
        actor_role=user.role if user else "SYSTEM",
        action=action,
        details=details,
        created_at=datetime.utcnow()
    ))


def expire_orders(db):
    now = datetime.utcnow()
    orders = db.query(Order).filter(
        Order.status == "READY",
        Order.pickup_deadline != None,
        Order.pickup_deadline < now
    ).all()

    changed = False
    for order in orders:
        order.status = "EXPIRED"
        order.cancelled_at = now
        add_log(
            db,
            order.user,
            "ORDER_EXPIRED",
            f"Order #{order.id} expired after 20 minutes."
        )
        changed = True

    if changed:
        db.commit()


def food_to_dict(food):
    image_url = food.image_url or resolve_dataset_image_url(food.name)
    return {
        "id": food.id,
        "name": food.name,
        "category": food.category,
        "description": food.description,
        "price": food.price,
        "stock": food.stock,
        "available": bool(food.is_available and food.stock > 0),
        "image_url": image_url
    }


def order_to_dict(db, order):
    items = db.query(OrderItem).filter_by(order_id=order.id).all()
    return {
        "id": order.id,
        "total": order.total,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "status": order.status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "ready_at": order.ready_at.isoformat() if order.ready_at else None,
        "pickup_deadline": order.pickup_deadline.isoformat() if order.pickup_deadline else None,
        "collected_at": order.collected_at.isoformat() if order.collected_at else None,
        "items": [
            {
                "food_id": item.food_id,
                "name": item.food.name if item.food else "Food",
                "quantity": item.quantity,
                "unit_price": item.unit_price
            }
            for item in items
        ]
    }


@app.get("/")
def root():
    return {"message": "Smart College Canteen API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=data.email).first():
        raise HTTPException(400, "Email already registered")
    if db.query(User).filter_by(college_id=data.college_id).first():
        raise HTTPException(400, "College ID already registered")

    user = User(
        name=data.name,
        college_id=data.college_id,
        email=data.email,
        password_hash=hash_password(data.password),
        role="student"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    add_log(db, user, "REGISTER", "Student account created")
    db.commit()

    return {
        "message": "Registration successful",
        "token": create_token(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "college_id": user.college_id,
            "role": user.role
        }
    }


@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    add_log(db, user, "LOGIN", "Successful login")
    db.commit()

    return {
        "token": create_token(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "college_id": user.college_id,
            "role": user.role
        }
    }


@app.get("/foods")
def foods(db: Session = Depends(get_db)):
    return [food_to_dict(x) for x in db.query(FoodItem).order_by(FoodItem.category, FoodItem.name).all()]


@app.get("/daily-menu")
def daily_menu(db: Session = Depends(get_db)):
    today = datetime.now().strftime("%Y-%m-%d")
    rows = db.query(DailyMenu).filter(
        DailyMenu.menu_date == today,
        DailyMenu.is_active == True
    ).order_by(desc(DailyMenu.id)).all()

    return [
        {
            "id": x.id,
            "menu_date": x.menu_date,
            "title": x.title,
            "description": x.description,
            "is_active": x.is_active
        }
        for x in rows
    ]


@app.get("/me")
def me(user=Depends(current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "college_id": user.college_id,
        "role": user.role
    }


@app.post("/orders")
def create_order(
    data: CreateOrderRequest,
    user=Depends(current_user),
    db: Session = Depends(get_db)
):
    expire_orders(db)

    method = data.payment_method.upper()
    if method not in ("ONLINE", "CASH"):
        raise HTTPException(400, "Payment method must be ONLINE or CASH")

    if not data.items:
        raise HTTPException(400, "Cart is empty")

    total = 0
    checked_items = []

    for requested in data.items:
        food = db.get(FoodItem, requested.food_id)
        if not food or not food.is_available:
            raise HTTPException(400, f"Food #{requested.food_id} is unavailable")
        if food.stock < requested.quantity:
            raise HTTPException(
                400,
                f"Only {food.stock} of {food.name} is available"
            )

        total += food.price * requested.quantity
        checked_items.append((food, requested.quantity))

    # Reserve/decrement stock when order is created.
    for food, qty in checked_items:
        food.stock -= qty
        if food.stock == 0:
            food.is_available = False

    now = datetime.utcnow()
    order = Order(
        user_id=user.id,
        total=round(total, 2),
        payment_method=method,
        payment_status="PENDING" if method == "CASH" else "PENDING",
        status="PENDING",
        pickup_token=secrets.token_urlsafe(24),
        created_at=now
    )
    db.add(order)
    db.flush()

    for food, qty in checked_items:
        db.add(OrderItem(
            order_id=order.id,
            food_id=food.id,
            quantity=qty,
            unit_price=food.price
        ))

    add_log(
        db,
        user,
        "ORDER_CREATED",
        f"Order #{order.id} created. Total ₹{order.total}. Payment={method}"
    )
    db.commit()
    db.refresh(order)

    return order_to_dict(db, order)


@app.post("/orders/{order_id}/demo-pay")
def demo_pay(
    order_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db)
):
    order = db.get(Order, order_id)
    if not order or order.user_id != user.id:
        raise HTTPException(404, "Order not found")

    if order.payment_method != "ONLINE":
        raise HTTPException(400, "This order uses cash at pickup")

    if order.status in ("CANCELLED", "EXPIRED"):
        raise HTTPException(400, "Order is no longer active")

    # Demo payment only. Replace with real gateway/webhook for production.
    order.payment_status = "PAID"
    add_log(db, user, "ONLINE_PAYMENT_CONFIRMED",
            f"Demo online payment confirmed for Order #{order.id}")
    db.commit()

    return {"message": "Payment successful", "order": order_to_dict(db, order)}


@app.get("/orders/my")
def my_orders(user=Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    orders = db.query(Order).filter(
        Order.user_id == user.id
    ).order_by(desc(Order.id)).all()
    return [order_to_dict(db, x) for x in orders]


@app.get("/orders/{order_id}")
def get_order(order_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    order = db.get(Order, order_id)

    if not order:
        raise HTTPException(404, "Order not found")

    if user.role != "admin" and order.user_id != user.id:
        raise HTTPException(403, "Not allowed")

    return order_to_dict(db, order)


@app.get("/orders/{order_id}/qr")
def get_order_qr(order_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    expire_orders(db)
    order = db.get(Order, order_id)

    if not order:
        raise HTTPException(404, "Order not found")
    if user.role != "admin" and order.user_id != user.id:
        raise HTTPException(403, "Not allowed")
    if order.status in ("CANCELLED", "EXPIRED"):
        raise HTTPException(400, "QR is no longer valid")

    payload = f"CANTEEN_ORDER|{order.id}|{order.pickup_token}"
    img = qrcode.make(payload)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "order_id": order.id,
        "status": order.status,
        "token": order.pickup_token,
        "qr_data_url": f"data:image/png;base64,{encoded}"
    }


@app.get("/orders/{order_id}/payment-qr")
def get_payment_qr(order_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)

    if not order or order.user_id != user.id:
        raise HTTPException(404, "Order not found")
    if order.payment_method != "ONLINE":
        raise HTTPException(400, "This order uses cash at pickup")

    upi_id = os.getenv("UPI_ID", "rethanyasri9@okaxis")
    payee_name = os.getenv("UPI_PAYEE_NAME", "CanteenGo")
    upi_payload = "upi://pay?" + urlencode({
        "pa": upi_id,
        "pn": payee_name,
        "am": f"{order.total:.2f}",
        "cu": "INR",
        "tn": f"CanteenGo Order {order.id}"
    })
    buffer = BytesIO()
    qrcode.make(upi_payload).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "order_id": order.id,
        "amount": order.total,
        "upi_id": upi_id,
        "qr_data_url": f"data:image/png;base64,{encoded}"
    }


# ---------------- ADMIN ----------------

@app.get("/admin/stats")
def admin_stats(admin=Depends(require_admin), db: Session = Depends(get_db)):
    expire_orders(db)

    orders = db.query(Order).all()
    return {
        "orders": len(orders),
        "pending": sum(1 for x in orders if x.status == "PENDING"),
        "preparing": sum(1 for x in orders if x.status == "PREPARING"),
        "ready": sum(1 for x in orders if x.status == "READY"),
        "collected": sum(1 for x in orders if x.status == "COLLECTED"),
        "expired": sum(1 for x in orders if x.status == "EXPIRED"),
        "cancelled": sum(1 for x in orders if x.status == "CANCELLED"),
        "food_items": db.query(FoodItem).count()
    }


@app.get("/admin/orders")
def admin_orders(admin=Depends(require_admin), db: Session = Depends(get_db)):
    expire_orders(db)
    orders = db.query(Order).order_by(desc(Order.id)).all()
    result = []

    for order in orders:
        data = order_to_dict(db, order)
        data["student_name"] = order.user.name
        data["student_email"] = order.user.email
        data["college_id"] = order.user.college_id
        result.append(data)

    return result


@app.patch("/admin/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    data: StatusRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    new_status = data.status.upper()
    allowed = {"PENDING", "PREPARING", "READY", "COLLECTED", "CANCELLED"}

    if new_status not in allowed:
        raise HTTPException(400, "Invalid status")

    now = datetime.utcnow()

    if new_status == "READY":
        if order.payment_method == "ONLINE" and order.payment_status != "PAID":
            raise HTTPException(400, "Online payment is not confirmed")
        order.ready_at = now
        order.pickup_deadline = now + timedelta(minutes=PICKUP_MINUTES)

    if new_status == "COLLECTED":
        if order.status != "READY":
            raise HTTPException(400, "Only READY orders can be collected")
        if order.pickup_deadline and now > order.pickup_deadline:
            order.status = "EXPIRED"
            order.cancelled_at = now
            add_log(db, order.user, "ORDER_EXPIRED",
                    f"Order #{order.id} expired before collection.")
            db.commit()
            raise HTTPException(400, "Pickup window expired")

        if order.payment_method == "CASH":
            order.payment_status = "PAID"
            add_log(db, admin, "CASH_RECEIVED",
                    f"Cash received for Order #{order.id}")

        order.collected_at = now

    if new_status == "CANCELLED":
        if order.status == "COLLECTED":
            raise HTTPException(400, "Collected order cannot be cancelled")

        # Return stock for an admin cancellation.
        items = db.query(OrderItem).filter_by(order_id=order.id).all()
        for item in items:
            food = db.get(FoodItem, item.food_id)
            if food:
                food.stock += item.quantity
                food.is_available = True

        order.cancelled_at = now

    old_status = order.status
    order.status = new_status

    add_log(
        db,
        admin,
        "ORDER_STATUS_CHANGED",
        f"Order #{order.id}: {old_status} -> {new_status}"
    )
    db.commit()

    return order_to_dict(db, order)


@app.post("/admin/verify-qr")
def verify_qr(
    data: VerifyQRRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    expire_orders(db)
    token = data.token.strip()

    order = db.query(Order).filter(Order.pickup_token == token).first()
    if not order:
        raise HTTPException(404, "Invalid QR / pickup code")

    if order.status == "EXPIRED":
        raise HTTPException(400, "Order expired")
    if order.status == "CANCELLED":
        raise HTTPException(400, "Order cancelled")
    if order.status == "COLLECTED":
        raise HTTPException(400, "Order already collected")

    if order.status != "READY":
        raise HTTPException(400, f"Order is currently {order.status}")

    if order.pickup_deadline and datetime.utcnow() > order.pickup_deadline:
        order.status = "EXPIRED"
        order.cancelled_at = datetime.utcnow()
        add_log(db, order.user, "ORDER_EXPIRED",
                f"Order #{order.id} expired during QR verification.")
        db.commit()
        raise HTTPException(400, "Order expired")

    return {
        "valid": True,
        "order": order_to_dict(db, order),
        "student_name": order.user.name,
        "college_id": order.user.college_id
    }


@app.post("/admin/collect-by-token")
def collect_by_token(
    data: VerifyQRRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    token = data.token.strip()
    order = db.query(Order).filter(Order.pickup_token == token).first()

    if not order:
        raise HTTPException(404, "Invalid pickup code")
    if order.status != "READY":
        raise HTTPException(400, f"Order is {order.status}")

    if order.pickup_deadline and datetime.utcnow() > order.pickup_deadline:
        order.status = "EXPIRED"
        order.cancelled_at = datetime.utcnow()
        add_log(db, order.user, "ORDER_EXPIRED",
                f"Order #{order.id} expired before collection.")
        db.commit()
        raise HTTPException(400, "Pickup window expired")

    if order.payment_method == "CASH":
        order.payment_status = "PAID"
        add_log(db, admin, "CASH_RECEIVED",
                f"Cash received for Order #{order.id}")

    order.status = "COLLECTED"
    order.collected_at = datetime.utcnow()

    add_log(db, admin, "ORDER_COLLECTED",
            f"Order #{order.id} collected by student.")
    db.commit()

    return order_to_dict(db, order)


@app.get("/admin/foods")
def admin_foods(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return [food_to_dict(x) for x in db.query(FoodItem).order_by(FoodItem.id).all()]


@app.post("/admin/foods")
def admin_add_food(
    data: FoodCreate,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    food = FoodItem(
        name=data.name,
        category=data.category,
        description=data.description,
        price=data.price,
        stock=data.stock,
        is_available=data.stock > 0,
        image_url=data.image_url or resolve_dataset_image_url(data.name)
    )
    db.add(food)
    db.flush()
    add_log(db, admin, "FOOD_ADDED", f"Added {food.name}")
    db.commit()
    return food_to_dict(food)


@app.patch("/admin/foods/{food_id}")
def admin_update_food(
    food_id: int,
    data: FoodUpdate,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    food = db.get(FoodItem, food_id)
    if not food:
        raise HTTPException(404, "Food not found")

    if data.stock is not None:
        food.stock = data.stock
    if data.price is not None:
        food.price = data.price
    if data.is_available is not None:
        food.is_available = data.is_available
    if data.category is not None:
        food.category = data.category

    if food.stock == 0:
        food.is_available = False

    add_log(
        db,
        admin,
        "STOCK_OR_FOOD_UPDATED",
        f"{food.name}: stock={food.stock}, price={food.price}, available={food.is_available}"
    )
    db.commit()
    return food_to_dict(food)


@app.get("/admin/daily-menu")
def admin_daily_menu(admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(DailyMenu).order_by(desc(DailyMenu.id)).all()
    return [
        {
            "id": x.id,
            "menu_date": x.menu_date,
            "title": x.title,
            "description": x.description,
            "is_active": x.is_active
        }
        for x in rows
    ]


@app.post("/admin/daily-menu")
def admin_create_daily_menu(
    data: DailyMenuCreate,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    menu = DailyMenu(
        menu_date=data.menu_date,
        title=data.title,
        description=data.description,
        is_active=True
    )
    db.add(menu)
    add_log(db, admin, "DAILY_MENU_CREATED",
            f"{data.menu_date}: {data.title}")
    db.commit()
    db.refresh(menu)

    return {
        "id": menu.id,
        "menu_date": menu.menu_date,
        "title": menu.title,
        "description": menu.description,
        "is_active": menu.is_active
    }


@app.get("/admin/logs")
def admin_logs(admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(ActivityLog).order_by(desc(ActivityLog.id)).limit(500).all()
    return [
        {
            "id": x.id,
            "actor_name": x.actor_name,
            "actor_role": x.actor_role,
            "action": x.action,
            "details": x.details,
            "created_at": x.created_at.isoformat()
        }
        for x in rows
    ]
