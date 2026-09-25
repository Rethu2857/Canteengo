# Smart College Canteen

A complete demo college-canteen pre-order system.

## Included

### Student
- Student login
- Food categories and search
- Current stock/availability
- Daily menu
- Cart
- Cash at pickup
- Demo online payment
- Thank-you page
- QR pickup code
- My orders
- 20-minute pickup expiry after the order becomes READY

### Admin
- Separate admin login
- Dashboard statistics
- Order management
- Mark order READY / COLLECTED / CANCELLED
- QR verification
- Food and stock management
- Daily menu management
- Full activity/audit log

## Demo accounts

Student:
student@college.edu
student123

Admin:
admin@college.edu
admin123

## Backend

Open PowerShell in the backend folder:

    python -m venv venv
    .\venv\Scripts\activate
    pip install -r requirements.txt
    python seed.py
    python -m uvicorn main:app --reload

If PowerShell blocks uvicorn.exe, use the `python -m uvicorn` command above.

Backend:
http://127.0.0.1:8000

API docs:
http://127.0.0.1:8000/docs

## Frontend

Open a second PowerShell:

    cd frontend
    npm install
    npm run dev

Frontend:
http://127.0.0.1:5173

## Important

The online payment in this project is a DEMO payment flow. It does not charge real money.
For real college deployment, integrate a payment provider and verify the payment on the backend/webhook before marking an order paid.

The 20-minute timer starts when the admin changes an order to READY. If the student does not collect it before the deadline, the backend marks it EXPIRED.

The database is SQLite for easy development. For production, use PostgreSQL.

## Deploying the frontend to Vercel

Deploy the `frontend` folder as a Vercel project. Vercel will detect Vite automatically.
Before deploying, add this project environment variable in Vercel:

    VITE_API_URL=https://your-backend-domain.example.com

The backend must be deployed separately to a service that supports FastAPI. On that
service, set `CORS_ORIGINS` to your Vercel URL, for example:

    CORS_ORIGINS=https://your-project.vercel.app

Keep the trailing slash out of both URLs. For production data, configure PostgreSQL
through `DATABASE_URL` before using the application with real users.
