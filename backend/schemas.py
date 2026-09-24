from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    college_id: str
    email: EmailStr
    password: str = Field(min_length=6)


class CartItem(BaseModel):
    food_id: int
    quantity: int = Field(gt=0, le=50)


class CreateOrderRequest(BaseModel):
    payment_method: str
    items: List[CartItem]


class StatusRequest(BaseModel):
    status: str


class FoodCreate(BaseModel):
    name: str
    category: str
    description: str = ""
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    image_url: str = ""


class FoodUpdate(BaseModel):
    stock: Optional[int] = Field(default=None, ge=0)
    price: Optional[float] = Field(default=None, gt=0)
    is_available: Optional[bool] = None
    category: Optional[str] = None


class DailyMenuCreate(BaseModel):
    menu_date: str
    title: str
    description: str = ""


class VerifyQRRequest(BaseModel):
    token: str
