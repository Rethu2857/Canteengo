import React, { useEffect, useMemo, useState } from "react";
import {
  Search, ShoppingBag, UserRound, LogOut, Plus, Minus,
  ChevronRight, Clock3, ShieldCheck, ClipboardList, Package,
  Boxes, FileText, Utensils, QrCode, CheckCircle2, XCircle,
  LayoutDashboard, CalendarDays, RefreshCw, WalletCards, Download
} from "lucide-react";
import { api } from "./api";

const money = (n) => `₹${Number(n).toFixed(0)}`;
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const foodImage = (food) => {
  if (food.image_url) {
    return food.image_url.startsWith("/") ? `${API}${food.image_url}` : food.image_url;
  }
  const n = encodeURIComponent(food.name);
  return `https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80&sig=${food.id}`;
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function downloadBill(orderId, setToast) {
  try {
    const order = await api.order(orderId);
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const rows = order.items.map(item => `
      <tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td>
      <td>${money(item.unit_price)}</td><td>${money(item.unit_price * item.quantity)}</td></tr>
    `).join("");
    const bill = `<!doctype html><html><head><meta charset="utf-8"><title>Bill #${order.id}</title>
      <style>body{font:16px Arial,sans-serif;max-width:720px;margin:40px auto;color:#20202a}h1{color:#ff4054}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{font-size:20px;text-align:right;font-weight:bold}</style>
      </head><body><h1>CanteenGo</h1><p>Smart College Canteen</p>
      <p><b>Bill:</b> #${order.id}<br><b>Student:</b> ${escapeHtml(user.name)}<br><b>Email:</b> ${escapeHtml(user.email)}<br><b>Payment:</b> ${escapeHtml(order.payment_method)} (${escapeHtml(order.payment_status)})</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="total">Total: ${money(order.total)}</p><p>Thank you for ordering with CanteenGo.</p></body></html>`;
    const blob = new Blob([bill], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `canteen-bill-${order.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    setToast(err.message);
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [selectedRole, setSelectedRole] = useState("student");
  const [cart, setCart] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");
    if (saved && token) {
      const u = JSON.parse(saved);
      setUser(u);
      setView(u.role === "admin" ? "admin" : "home");
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const loginSuccess = (result) => {
    sessionStorage.setItem("token", result.token);
    sessionStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
    setView(result.user.role === "admin" ? "admin" : "home");
    setToast("Welcome back!");
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setUser(null);
    setCart([]);
    setView("login");
  };

  if (!user) {
    return (
      <>
        <Login role={selectedRole} setRole={setSelectedRole} onSuccess={loginSuccess}
          setToast={setToast} />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  if (user.role === "admin") {
    return (
      <>
        <AdminApp user={user} view={view} setView={setView} logout={logout} setToast={setToast} />
        {toast && <Toast text={toast} />}
      </>
    );
  }

  return (
    <>
      <StudentApp
        user={user}
        view={view}
        setView={setView}
        cart={cart}
        setCart={setCart}
        orderId={orderId}
        setOrderId={setOrderId}
        logout={logout}
        setToast={setToast}
      />
      {toast && <Toast text={toast} />}
    </>
  );
}

function Toast({ text }) {
  return <div className="toast">{text}</div>;
}

function Login({ role, setRole, onSuccess, setToast }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [email, setEmail] = useState(role === "admin" ? "admin@college.edu" : "student@college.edu");
  const [password, setPassword] = useState(role === "admin" ? "admin123" : "student123");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRegistering(false);
    setEmail(role === "admin" ? "admin@college.edu" : "student@college.edu");
    setPassword(role === "admin" ? "admin123" : "student123");
  }, [role]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = registering
        ? await api.register({ name, college_id: collegeId, email, password })
        : await api.login({ email, password });
      if (result.user.role !== role) {
        throw new Error(`This account is not a ${role} account.`);
      }
      onSuccess(result);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-art">
        <div className="floating-card fc1">🍗<span>Fresh & Hot</span></div>
        <div className="floating-card fc2">🥤<span>Fresh Juices</span></div>
        <div className="hero-bowl">🍱</div>
        <div>
          <div className="brand-big">Canteen<span>Go</span></div>
          <p>Order before you reach. Save your break time.</p>
        </div>
      </div>

      <div className="login-card">
        <div className="brand">🍱 Canteen<span>Go</span></div>
        <p className="muted">Smart College Canteen</p>

        <div className="role-switch">
          <button className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>
            🎓 Student
          </button>
          <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>
            🧑‍🍳 Admin
          </button>
        </div>

        <form onSubmit={submit}>
          {registering && <>
            <label>Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
            <label>College ID</label>
            <input value={collegeId} onChange={e => setCollegeId(e.target.value)} required />
          </>}
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />

          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />

          <button className="primary-btn full" disabled={loading}>
            {loading ? "Please wait..." : registering ? "Create student account" : `Login as ${role}`}
          </button>
        </form>

        {role === "student" && <button className="secondary-btn full" onClick={() => setRegistering(value => !value)}>
          {registering ? "Back to student login" : "Create a new student account"}
        </button>}
        {!registering && <div className="demo-box">
          <b>Demo account</b>
          <div>{role === "admin" ? "admin@college.edu / admin123" : "student@college.edu / student123"}</div>
        </div>}
      </div>
    </div>
  );
}

function StudentApp({ user, view, setView, cart, setCart, orderId, setOrderId, logout, setToast }) {
  const [foods, setFoods] = useState([]);
  const [menu, setMenu] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  async function load() {
    try {
      const [f, m] = await Promise.all([api.foods(), api.dailyMenu()]);
      setFoods(f);
      setMenu(m);
    } catch (err) {
      setToast(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  const categories = ["All", ...Array.from(new Set(foods.map(x => x.category)))];

  const filtered = useMemo(() => foods.filter(f => {
    const matchesCat = category === "All" || f.category === category;
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  }), [foods, category, search]);

  const add = (food) => {
    if (!food.available) return;
    setCart(prev => {
      const found = prev.find(x => x.id === food.id);
      if (found) {
        return prev.map(x => x.id === food.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...prev, { ...food, qty: 1 }];
    });
    setToast(`${food.name} added to cart`);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev
      .map(x => x.id === id ? { ...x, qty: x.qty + delta } : x)
      .filter(x => x.qty > 0)
    );
  };

  const cartCount = cart.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cart.reduce((s, x) => s + x.qty * x.price, 0);

  const nav = (v) => {
    if (v === "cart" && !cart.length) {
      setToast("Your cart is empty");
      return;
    }
    setView(v);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="logo-btn" onClick={() => setView("home")}>
          🍱 <b>Canteen<span>Go</span></b>
        </button>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => nav("orders")}><ClipboardList size={20}/></button>
          <button className="profile-pill"><UserRound size={17}/> {user.name}</button>
          <button className="icon-btn" onClick={logout}><LogOut size={19}/></button>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="hero">
            <div>
              <span className="eyebrow">SMART COLLEGE CANTEEN</span>
              <h1>Order before you reach.<br/><span>Save your break.</span></h1>
              <p>Pre-order food, choose online payment or cash at pickup, and collect with your QR code.</p>
            </div>
            <div className="hero-food">🍗</div>
          </section>

          {menu.length > 0 && (
            <section className="daily-menu">
              <div>
                <span className="eyebrow">TODAY'S MENU</span>
                <h2>{menu[0].title}</h2>
                <p>{menu[0].description}</p>
              </div>
              <CalendarDays size={34}/>
            </section>
          )}

          <section className="content">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CANTEEN MENU</span>
                <h2>What are you craving?</h2>
              </div>
              <button className="refresh-btn" onClick={load}><RefreshCw size={16}/> Refresh stock</button>
            </div>

            <div className="search-row">
              <div className="searchbox"><Search size={18}/><input placeholder="Search food..." value={search} onChange={e => setSearch(e.target.value)}/></div>
              <div className="category-scroll">
                {categories.map(c => <button key={c} className={category === c ? "chip active" : "chip"} onClick={() => setCategory(c)}>{c}</button>)}
              </div>
            </div>

            <div className="food-grid">
              {filtered.map(food => <FoodCard key={food.id} food={food} add={add}/>)}
            </div>
          </section>
        </>
      )}

      {view === "cart" && (
        <Cart cart={cart} updateQty={updateQty} total={cartTotal}
          goCheckout={() => setView("checkout")} />
      )}

      {view === "checkout" && (
        <Checkout cart={cart} total={cartTotal}
          onOrder={async (method) => {
            try {
              const result = await api.createOrder({
                payment_method: method,
                items: cart.map(x => ({ food_id: x.id, quantity: x.qty }))
              });
              setOrderId(result.id);
              setCart([]);
              if (method === "ONLINE") {
                setView("payment");
              } else {
                setView("thankyou");
              }
            } catch (err) {
              setToast(err.message);
            }
          }}
        />
      )}

      {view === "payment" && (
        <DemoPayment
          orderId={orderId}
          onPaid={async () => {
            try {
              await api.demoPay(orderId);
              setView("thankyou");
            } catch (err) {
              setToast(err.message);
            }
          }}
        />
      )}

      {view === "thankyou" && (
        <ThankYou orderId={orderId} onQR={() => setView("qr")} onOrders={() => setView("orders")} onBill={() => downloadBill(orderId, setToast)}/>
      )}

      {view === "qr" && <QRPage orderId={orderId} onBack={() => setView("orders")}/>}

      {view === "orders" && <MyOrders setOrderId={setOrderId} setView={setView} setToast={setToast}/>} 

      {view === "home" && cart.length > 0 && (
        <button className="floating-cart" onClick={() => nav("cart")}>
          <span><ShoppingBag size={20}/> {cartCount} items</span>
          <b>{money(cartTotal)} <ChevronRight size={18}/></b>
        </button>
      )}
    </div>
  );
}

function FoodCard({ food, add }) {
  const stockClass = food.stock <= 10 ? "low" : "good";
  return (
    <article className="food-card">
      <div className="food-img-wrap">
        <img src={foodImage(food)} alt={food.name}/>
        <span className="food-category">{food.category}</span>
      </div>
      <div className="food-body">
        <h3>{food.name}</h3>
        <p>{food.description}</p>
        <div className="food-bottom">
          <div>
            <b className="price">{money(food.price)}</b>
            <span className={`stock ${stockClass}`}>{food.available ? `${food.stock} available` : "Out of stock"}</span>
          </div>
          <button className="add-btn" disabled={!food.available} onClick={() => add(food)}>
            <Plus size={17}/> Add
          </button>
        </div>
      </div>
    </article>
  );
}

function Cart({ cart, updateQty, total, goCheckout }) {
  return (
    <main className="narrow-page">
      <div className="page-title"><span className="eyebrow">YOUR ORDER</span><h1>Your Cart 🛒</h1></div>
      <div className="cart-list">
        {cart.map(item => (
          <div className="cart-item" key={item.id}>
            <img src={foodImage(item)} alt={item.name}/>
            <div className="cart-info"><b>{item.name}</b><span>{money(item.price)} each</span></div>
            <div className="qty">
              <button onClick={() => updateQty(item.id, -1)}><Minus size={15}/></button>
              <b>{item.qty}</b>
              <button onClick={() => updateQty(item.id, 1)}><Plus size={15}/></button>
            </div>
            <b>{money(item.qty * item.price)}</b>
          </div>
        ))}
      </div>
      <div className="checkout-card">
        <div><span>Total</span><strong>{money(total)}</strong></div>
        <button className="primary-btn full" onClick={goCheckout}>Continue to Checkout <ChevronRight size={18}/></button>
      </div>
    </main>
  );
}

function Checkout({ cart, total, onOrder }) {
  const [method, setMethod] = useState("ONLINE");
  return (
    <main className="narrow-page">
      <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Choose payment</h1></div>
      <div className="checkout-layout">
        <div className="checkout-card">
          <h3>Payment method</h3>
          <button className={`payment-option ${method === "ONLINE" ? "selected" : ""}`} onClick={() => setMethod("ONLINE")}>
            <WalletCards/><div><b>Online Payment</b><span>Demo payment for this project</span></div>
          </button>
          <button className={`payment-option ${method === "CASH" ? "selected" : ""}`} onClick={() => setMethod("CASH")}>
            💵<div><b>Cash at Pickup</b><span>Pay the canteen counter when collecting</span></div>
          </button>
          <div className="payment-note">Your QR pickup code will be generated after the order is confirmed.</div>
        </div>
        <div className="checkout-card">
          <h3>Order summary</h3>
          {cart.map(x => <div className="summary-row" key={x.id}><span>{x.name} × {x.qty}</span><b>{money(x.qty*x.price)}</b></div>)}
          <hr/>
          <div className="summary-row total"><span>Total</span><b>{money(total)}</b></div>
          <button className="primary-btn full" onClick={() => onOrder(method)}>
            {method === "ONLINE" ? "Continue to Payment" : "Place Cash Order"}
          </button>
        </div>
      </div>
    </main>
  );
}

function DemoPayment({ orderId, onPaid }) {
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.paymentQr(orderId), api.order(orderId)])
      .then(([qr, order]) => setPayment({ ...qr, amount: order.total }))
      .catch(err => setError(err.message));
  }, [orderId]);

  return (
    <main className="center-page">
      <div className="payment-card">
        <div className="payment-logo">💳</div>
        <span className="eyebrow">DEMO PAYMENT</span>
        <h1>Complete payment</h1>
        <p>Order #{orderId}</p>
        {error && <div className="error-box">{error}</div>}
        {payment && <>
          <img className="qr-img" src={payment.qr_data_url} alt="UPI payment QR code" />
          <p><b>Scan to pay {money(payment.amount)}</b><br />UPI ID: {payment.upi_id}</p>
          <a className="secondary-btn full" href={payment.upi_url}>Open UPI app</a>
        </>}
        <input placeholder="Card number (demo)" defaultValue="4111 1111 1111 1111"/>
        <div className="two-col"><input placeholder="MM/YY" defaultValue="12/30"/><input placeholder="CVV" defaultValue="123"/></div>
        <button className="primary-btn full" disabled={processing} onClick={async () => {
          setProcessing(true);
          await new Promise(r => setTimeout(r, 800));
          await onPaid();
          setProcessing(false);
        }}>{processing ? "Processing..." : "Pay & Confirm Order"}</button>
        <small>Demo only — no real money is charged.</small>
      </div>
    </main>
  );
}

function ThankYou({ orderId, onQR, onOrders, onBill }) {
  const [order, setOrder] = useState(null);
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api.order(orderId);
        if (!active) return;
        setOrder(next);
        if (next.pickup_deadline) {
          setSeconds(Math.max(0, Math.floor((new Date(next.pickup_deadline).getTime() - Date.now()) / 1000)));
        }
      } catch {}
    };
    load();
    const refresh = setInterval(load, 10000);
    return () => { active = false; clearInterval(refresh); };
  }, [orderId]);

  useEffect(() => {
    if (seconds === null || seconds <= 0) return;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const cashTimer = order?.payment_method === "CASH" && seconds !== null
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : null;
  const cancelled = order?.status === "CANCELLED";

  return (
    <main className="center-page">
      <div className="success-card">
        <div className="success-icon"><CheckCircle2 size={50}/></div>
        <span className="eyebrow">{cancelled ? "ORDER CANCELLED" : "ORDER CONFIRMED"}</span>
        <h1>{cancelled ? "Order cancelled" : "Thank you! 🎉"}</h1>
        <p>{cancelled ? <>Order <b>#{orderId}</b> was cancelled after the 15-minute cash pickup window.</> : <>Your order <b>#{orderId}</b> has been placed successfully.</>}</p>
        {!cancelled && cashTimer && <div className="timer-box"><Clock3/><div><small>Cash pickup deadline</small><b>{cashTimer}</b></div></div>}
        {!cancelled && order?.payment_method === "CASH" && seconds === 0 && <div className="error-box">This cash order has passed its 15-minute pickup window and is being cancelled.</div>}
        {!cancelled && <div className="thank-grid">
          <div><Clock3/><span>Wait for the canteen to mark it READY.</span></div>
          <div><QrCode/><span>Use your QR code when collecting.</span></div>
          <div><ShieldCheck/><span>Once READY, you have 20 minutes to collect.</span></div>
        </div>}
        {!cancelled && <button className="primary-btn full" onClick={onQR}>View QR Code</button>}
        <button className="secondary-btn full" onClick={onBill}><Download size={17}/> Download Bill</button>
        <button className="secondary-btn full" onClick={onOrders}>View My Orders</button>
      </div>
    </main>
  );
}

function OrderCountdown({ deadline, paymentMethod, status }) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    if (paymentMethod !== "CASH" || !deadline || ["CANCELLED", "COLLECTED", "EXPIRED"].includes(status)) {
      setSeconds(null);
      return undefined;
    }
    const update = () => setSeconds(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline, paymentMethod, status]);

  if (seconds === null) return null;
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className="timer-box"><Clock3/><div><small>Cash pickup time left</small><b>{timer}</b></div></div>;
}

function QRPage({ orderId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(null);

  async function load() {
    try {
      const result = await api.qr(orderId);
      setData(result);
      const order = await api.order(orderId);
      if (order.pickup_deadline) {
        const left = Math.max(0, Math.floor((new Date(order.pickup_deadline).getTime() - Date.now()) / 1000));
        setSeconds(left);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  useEffect(() => {
    if (seconds === null || seconds <= 0) return;
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const timer = seconds === null ? "Waiting for READY" :
    `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

  return (
    <main className="center-page">
      <div className="qr-card">
        <span className="eyebrow">PICKUP QR</span>
        <h1>Order #{orderId}</h1>
        {error ? <div className="error-box">{error}</div> : data && <img className="qr-img" src={data.qr_data_url} alt="Order QR code"/>}
        <div className="timer-box"><Clock3/><div><small>Pickup window</small><b>{timer}</b></div></div>
        <p>Show this QR at the canteen counter. The order can be collected only after it is READY.</p>
        <button className="secondary-btn full" onClick={onBack}>Back to My Orders</button>
      </div>
    </main>
  );
}

function MyOrders({ setOrderId, setView, setToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try { setOrders(await api.myOrders()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const refresh = setInterval(load, 10000);
    return () => clearInterval(refresh);
  }, []);

  return (
    <main className="content">
      <div className="page-title"><span className="eyebrow">HISTORY</span><h1>My Orders</h1></div>
      {loading ? <div className="loading">Loading...</div> :
        <div className="orders-grid">
          {orders.map(o => (
            <div className="order-card" key={o.id}>
              <div className="order-top"><b>Order #{o.id}</b><span className={`status ${o.status.toLowerCase()}`}>{o.status}</span></div>
              <div className="order-items">{o.items.map((x,i) => <span key={i}>{x.name} × {x.quantity}</span>)}</div>
              <div className="order-meta"><span>{o.payment_method} · {o.payment_status}</span><strong>{money(o.total)}</strong></div>
              <OrderCountdown deadline={o.pickup_deadline} paymentMethod={o.payment_method} status={o.status}/>
              <button className="secondary-btn full" onClick={() => downloadBill(o.id, setToast)}> <Download size={17}/> Download Bill</button>
              {o.status !== "CANCELLED" && o.status !== "EXPIRED" && o.status !== "COLLECTED" &&
                <button className="secondary-btn full" onClick={() => {setOrderId(o.id); setView("qr");}}>View QR</button>}
            </div>
          ))}
        </div>}
    </main>
  );
}

function AdminApp({ user, view, setView, logout, setToast }) {
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [menus, setMenus] = useState([]);
  const [refresh, setRefresh] = useState(0);

  const loadAll = async () => {
    try {
      const [s,o,f,l,m] = await Promise.all([
        api.adminStats(), api.adminOrders(), api.adminFoods(), api.logs(), api.adminMenus()
      ]);
      setStats(s); setOrders(o); setFoods(f); setLogs(l); setMenus(m);
    } catch (err) { setToast(err.message); }
  };

  useEffect(() => { loadAll(); }, [refresh]);

  async function status(id, next) {
    try {
      await api.updateOrder(id, next);
      setToast(`Order #${id} → ${next}`);
      setRefresh(x => x + 1);
    } catch (err) { setToast(err.message); }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-logo">🍱 <b>Canteen<span>Go</span></b></div>
        <div className="admin-caption">ADMIN PANEL</div>
        {[
          ["admin","Dashboard",LayoutDashboard],
          ["admin-orders","Orders",Package],
          ["admin-foods","Food & Stock",Boxes],
          ["admin-menu","Daily Menu",CalendarDays],
          ["admin-logs","Activity Logs",FileText],
          ["admin-qr","QR Pickup",QrCode],
        ].map(([id,label,Icon]) => (
          <button key={id} className={view === id ? "side-link active" : "side-link"} onClick={() => setView(id)}>
            <Icon size={19}/>{label}
          </button>
        ))}
        <button className="side-link logout-side" onClick={logout}><LogOut size={19}/> Logout</button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div><span className="eyebrow">CANTEEN CONTROL</span><h1>{view === "admin" ? "Dashboard" : view.replace("admin-","")}</h1></div>
          <div className="admin-user"><ShieldCheck size={18}/> {user.name}</div>
        </header>

        {view === "admin" && <AdminDashboard stats={stats} orders={orders} status={status}/>}
        {view === "admin-orders" && <AdminOrders orders={orders} status={status}/>}
        {view === "admin-foods" && <AdminFoods foods={foods} setToast={setToast} refresh={() => setRefresh(x=>x+1)}/>}
        {view === "admin-menu" && <AdminMenu menus={menus} setToast={setToast} refresh={() => setRefresh(x=>x+1)}/>}
        {view === "admin-logs" && <AdminLogs logs={logs}/>}
        {view === "admin-qr" && <AdminQR setToast={setToast} refresh={() => setRefresh(x=>x+1)}/>}
      </main>
    </div>
  );
}

function AdminDashboard({ stats, orders, status }) {
  const cards = [
    ["Orders", stats.orders, "📦"], ["Pending", stats.pending, "🕐"],
    ["Preparing", stats.preparing, "👨‍🍳"], ["Ready", stats.ready, "🔔"],
    ["Collected", stats.collected, "✅"], ["Expired", stats.expired, "⏰"]
  ];
  return (
    <div>
      <div className="stats-grid">{cards.map(([a,b,c]) => <div className="stat-card" key={a}><span>{c}</span><b>{b || 0}</b><small>{a}</small></div>)}</div>
      <div className="admin-panel">
        <div className="panel-title"><h2>Recent Orders</h2><span>20-minute pickup rule</span></div>
        <AdminOrderTable orders={orders.slice(0,8)} status={status}/>
      </div>
    </div>
  );
}

function AdminOrders({ orders, status }) {
  return <div className="admin-panel"><div className="panel-title"><h2>All Orders</h2><span>{orders.length} orders</span></div><AdminOrderTable orders={orders} status={status}/></div>;
}

function AdminOrderTable({ orders, status }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Order</th><th>Student</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td><b>#{o.id}</b></td>
              <td>{o.student_name}<small>{o.college_id}</small></td>
              <td>{o.items.map(x => `${x.name} ×${x.quantity}`).join(", ")}</td>
              <td><b>{money(o.total)}</b></td>
              <td>{o.payment_method}<small>{o.payment_status}</small></td>
              <td><span className={`status ${o.status.toLowerCase()}`}>{o.status}</span></td>
              <td className="actions">
                {o.status === "PENDING" && <button onClick={() => status(o.id,"PREPARING")}>Preparing</button>}
                {o.status === "PREPARING" && <button onClick={() => status(o.id,"READY")}>Ready</button>}
                {o.status === "READY" && <button onClick={() => status(o.id,"COLLECTED")}>Collect</button>}
                {["PENDING","PREPARING"].includes(o.status) && <button className="danger" onClick={() => status(o.id,"CANCELLED")}>Cancel</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminFoods({ foods, setToast, refresh }) {
  const [draft, setDraft] = useState({});
  async function save(food) {
    try {
      await api.updateFood(food.id, {
        stock: Number(draft[food.id]?.stock ?? food.stock),
        price: Number(draft[food.id]?.price ?? food.price)
      });
      setToast(`${food.name} updated`);
      refresh();
    } catch (err) { setToast(err.message); }
  }
  return (
    <div className="admin-panel">
      <div className="panel-title"><h2>Food & Stock</h2><span>Students see this availability live</span></div>
      <div className="stock-list">
        {foods.map(f => (
          <div className="stock-row" key={f.id}>
            <div className="food-mini"><Utensils size={17}/><div><b>{f.name}</b><small>{f.category}</small></div></div>
            <label>Price <input value={draft[f.id]?.price ?? f.price} onChange={e => setDraft({...draft,[f.id]:{...draft[f.id],price:e.target.value}})}/></label>
            <label>Stock <input value={draft[f.id]?.stock ?? f.stock} onChange={e => setDraft({...draft,[f.id]:{...draft[f.id],stock:e.target.value}})}/></label>
            <span className={f.available ? "live-dot" : "off-dot"}>{f.available ? "Available" : "Out"}</span>
            <button className="small-btn" onClick={() => save(f)}>Save</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMenu({ menus, setToast, refresh }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  async function add() {
    try {
      await api.addMenu({menu_date: date, title, description: desc});
      setTitle(""); setDesc(""); setToast("Daily menu added"); refresh();
    } catch (err) { setToast(err.message); }
  }

  return (
    <div className="admin-panel">
      <div className="panel-title"><h2>Daily Menu</h2><span>Publish a special menu for students</span></div>
      <div className="menu-form">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}/>
        <input placeholder="Menu title" value={title} onChange={e => setTitle(e.target.value)}/>
        <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)}/>
        <button className="primary-btn" onClick={add}>Publish Menu</button>
      </div>
      <div className="menu-history">{menus.map(m => <div key={m.id}><b>{m.menu_date} · {m.title}</b><span>{m.description}</span></div>)}</div>
    </div>
  );
}

function AdminLogs({ logs }) {
  return (
    <div className="admin-panel">
      <div className="panel-title"><h2>Activity / Audit Log</h2><span>Every important action is recorded</span></div>
      <div className="log-list">
        {logs.map(l => <div className="log-row" key={l.id}><div className="log-icon">•</div><div><b>{l.action}</b><p>{l.details}</p><small>{l.actor_name} · {l.actor_role} · {new Date(l.created_at+"Z").toLocaleString()}</small></div></div>)}
      </div>
    </div>
  );
}

function AdminQR({ setToast, refresh }) {
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);

  async function verify() {
    try { setResult(await api.verifyQR(token)); }
    catch (err) { setToast(err.message); setResult(null); }
  }

  async function collect() {
    try { await api.collectQR(token); setToast("Order collected"); setResult(null); setToken(""); refresh(); }
    catch (err) { setToast(err.message); }
  }

  return (
    <div className="admin-panel qr-admin">
      <div className="panel-title"><h2>QR Pickup Verification</h2><span>Paste the QR token for this demo</span></div>
      <textarea placeholder="Paste pickup token..." value={token} onChange={e=>setToken(e.target.value)}/>
      <button className="primary-btn" onClick={verify}>Verify QR</button>
      {result && <div className="verify-result">
        <CheckCircle2/><div><b>Valid Order #{result.order.id}</b><span>{result.student_name} · {result.college_id} · {money(result.order.total)}</span></div>
        <button className="primary-btn" onClick={collect}>Collect Order</button>
      </div>}
      <p className="muted">For a production version, add a camera QR scanner and server-side payment verification.</p>
    </div>
  );
}

export default App;
