from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    college_id = Column(String(80), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    category = Column(String(60), nullable=False)
    description = Column(String(500), default="")
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    is_available = Column(Boolean, default=True)
    image_url = Column(String(500), default="")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total = Column(Float, nullable=False)
    payment_method = Column(String(20), nullable=False)  # ONLINE/CASH
    payment_status = Column(String(30), nullable=False)  # PAID/PENDING/REFUNDED
    status = Column(String(30), nullable=False, default="PENDING")
    pickup_token = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False)
    ready_at = Column(DateTime)
    pickup_deadline = Column(DateTime)
    collected_at = Column(DateTime)
    cancelled_at = Column(DateTime)

    user = relationship("User")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    food_id = Column(Integer, ForeignKey("food_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    food = relationship("FoodItem")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    actor_name = Column(String(120), default="")
    actor_role = Column(String(20), default="")
    action = Column(String(100), nullable=False)
    details = Column(String(1000), default="")
    created_at = Column(DateTime, nullable=False)


class DailyMenu(Base):
    __tablename__ = "daily_menus"

    id = Column(Integer, primary_key=True)
    menu_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    title = Column(String(150), nullable=False)
    description = Column(String(500), default="")
    is_active = Column(Boolean, default=True)
