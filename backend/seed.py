import re
from pathlib import Path

from .database import Base, engine, SessionLocal
from .models import User, FoodItem, DailyMenu
from .auth import hash_password

DATASET_DIR = Path(__file__).resolve().parent.parent / "datasets"


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


Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Demo users
if not db.query(User).filter_by(email="student@college.edu").first():
    db.add(User(
        name="Demo Student",
        college_id="STU001",
        email="student@college.edu",
        password_hash=hash_password("student123"),
        role="student"
    ))

if not db.query(User).filter_by(email="admin@college.edu").first():
    db.add(User(
        name="Canteen Admin",
        college_id="ADMIN001",
        email="admin@college.edu",
        password_hash=hash_password("admin123"),
        role="admin"
    ))

# Menu items: prices supplied by the project owner where provided.
# Other suggested prices can be edited from the Admin dashboard.
foods = [
    ("Chicken Rice", "Main Food", "Chicken fried rice", 80, 40),
    ("Chicken Noodles", "Main Food", "Chicken noodles", 80, 40),
    ("Chicken Biryani", "Main Food", "Chicken biryani", 60, 40),
    ("Chicken Manchurian", "Main Food", "Chicken manchurian", 80, 30),
    ("Veg Rice", "Main Food", "Vegetable fried rice", 70, 40),
    ("Veg Noodles", "Main Food", "Vegetable noodles", 70, 40),
    ("Gobi Manchurian", "Main Food", "Gobi manchurian", 70, 30),
    ("Parotta", "Main Food", "Layered parotta", 20, 70),
    ("Kothu Parotta", "Main Food", "Kothu parotta", 60, 40),
    ("Egg Rice", "Main Food", "Egg fried rice", 70, 40),
    ("Egg Noodles", "Main Food", "Egg noodles", 70, 40),

    ("Pani Puri", "Snacks", "Pani puri", 30, 60),
    ("Masala Puri", "Snacks", "Masala puri", 40, 50),
    ("Bread Omelette", "Snacks", "Bread omelette", 35, 40),
    ("Pav Bhaji", "Snacks", "Pav bhaji", 40, 40),
    ("Samosa", "Snacks", "Crispy samosa", 15, 80),
    ("Bajji", "Snacks", "Mixed vegetable bajji", 15, 80),
    ("Bonda", "Snacks", "Bonda", 15, 70),
    ("Puffs", "Snacks", "Vegetable puff", 20, 50),
    ("Lays", "Snacks", "Lays packet", 20, 60),
    ("Biscuits", "Snacks", "Biscuit packet", 10, 80),
    ("Chocolate", "Snacks", "Chocolate", 20, 50),

    ("Onion Bajji", "Evening Snacks", "Hot onion bajji", 15, 60),
    ("Banana Bajji", "Evening Snacks", "Banana bajji", 15, 50),
    ("Potato Bajji", "Evening Snacks", "Potato bajji", 15, 50),
    ("Bread Bajji", "Evening Snacks", "Bread bajji", 20, 40),
    ("Milagai Bajji", "Evening Snacks", "Chilli bajji", 15, 50),
    ("Mysore Bonda", "Evening Snacks", "Mysore bonda", 20, 50),
    ("Masala Vada", "Evening Snacks", "Masala vada", 15, 50),
    ("Cutlet", "Evening Snacks", "Vegetable cutlet", 25, 40),
    ("Egg Puff", "Evening Snacks", "Egg puff", 25, 40),
    ("Chicken Puff", "Evening Snacks", "Chicken puff", 35, 30),
    ("French Fries", "Evening Snacks", "French fries", 50, 30),
    ("Sweet Corn", "Evening Snacks", "Sweet corn", 40, 30),
    ("Sundal", "Evening Snacks", "Sundal", 25, 40),
    ("Maggi", "Evening Snacks", "Masala Maggi", 35, 40),

    ("Orange Juice", "Fresh Juice", "Fresh orange juice", 30, 40),
    ("Watermelon Juice", "Fresh Juice", "Fresh watermelon juice", 30, 40),
    ("Pineapple Juice", "Fresh Juice", "Fresh pineapple juice", 35, 35),
    ("Mosambi Juice", "Fresh Juice", "Fresh mosambi juice", 35, 35),
    ("Lemon Juice", "Fresh Juice", "Fresh lemon juice", 25, 50),
    ("Grape Juice", "Fresh Juice", "Fresh grape juice", 35, 35),
    ("Mango Juice", "Fresh Juice", "Fresh mango juice", 35, 35),
    ("Pomegranate Juice", "Fresh Juice", "Fresh pomegranate juice", 50, 25),
    ("Carrot Juice", "Fresh Juice", "Fresh carrot juice", 35, 30),
    ("Apple Juice", "Fresh Juice", "Fresh apple juice", 40, 30),
    ("Papaya Juice", "Fresh Juice", "Fresh papaya juice", 30, 30),
    ("Mixed Fruit Juice", "Fresh Juice", "Mixed fresh fruit juice", 45, 30),

    ("Coca-Cola", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Pepsi", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Sprite", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Fanta", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("7UP", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Mirinda", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Mountain Dew", "Cool Drinks", "Chilled soft drink", 40, 50),
    ("Maaza", "Cool Drinks", "Mango drink", 40, 40),
    ("Slice", "Cool Drinks", "Mango drink", 40, 40),
    ("Appy Fizz", "Cool Drinks", "Apple drink", 40, 40),

    ("Rose Milk", "Milk & Shakes", "Rose milk", 30, 40),
    ("Badam Milk", "Milk & Shakes", "Badam milk", 35, 35),
    ("Chocolate Milk", "Milk & Shakes", "Chocolate milk", 40, 30),
    ("Cold Coffee", "Milk & Shakes", "Cold coffee", 50, 30),
    ("Vanilla Milkshake", "Milk & Shakes", "Vanilla milkshake", 60, 25),
    ("Chocolate Milkshake", "Milk & Shakes", "Chocolate milkshake", 60, 25),
    ("Strawberry Milkshake", "Milk & Shakes", "Strawberry milkshake", 60, 25),
    ("Mango Milkshake", "Milk & Shakes", "Mango milkshake", 60, 25),
    ("Oreo Milkshake", "Milk & Shakes", "Oreo milkshake", 70, 20),

    ("Tea", "Hot Drinks", "Hot tea", 10, 120),
    ("Coffee", "Hot Drinks", "Hot coffee", 15, 100),
    ("Milk Tea", "Hot Drinks", "Milk tea", 15, 80),
    ("Ginger Tea", "Hot Drinks", "Ginger tea", 15, 60),
    ("Lemon Tea", "Hot Drinks", "Lemon tea", 15, 60),
    ("Mineral Water", "Other Drinks", "Water bottle", 15, 100),
    ("Soda", "Other Drinks", "Soda", 20, 70),
    ("Flavoured Soda", "Other Drinks", "Flavoured soda", 30, 50),
]

if db.query(FoodItem).count() == 0:
    for name, category, desc, price, stock in foods:
        db.add(FoodItem(
            name=name,
            category=category,
            description=desc,
            price=price,
            stock=stock,
            is_available=stock > 0,
            image_url=resolve_dataset_image_url(name)
        ))

# A starter daily menu
if db.query(DailyMenu).count() == 0:
    db.add(DailyMenu(
        menu_date="2026-09-24",
        title="Today's Special",
        description="Chicken Biryani + fresh juice + evening snacks are available today.",
        is_active=True
    ))

db.commit()
db.close()
print("Database created and demo data loaded.")
