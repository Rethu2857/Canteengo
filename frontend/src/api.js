const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }

  return data;
}

export const api = {
  login: (body) => request("/auth/login", {
    method: "POST", body: JSON.stringify(body)
  }),
  register: (body) => request("/auth/register", {
    method: "POST", body: JSON.stringify(body)
  }),
  me: () => request("/me"),
  foods: () => request("/foods"),
  dailyMenu: () => request("/daily-menu"),
  createOrder: (body) => request("/orders", {
    method: "POST", body: JSON.stringify(body)
  }),
  demoPay: (id) => request(`/orders/${id}/demo-pay`, {
    method: "POST"
  }),
  myOrders: () => request("/orders/my"),
  order: (id) => request(`/orders/${id}`),
  qr: (id) => request(`/orders/${id}/qr`),

  adminStats: () => request("/admin/stats"),
  adminOrders: () => request("/admin/orders"),
  updateOrder: (id, status) => request(`/admin/orders/${id}/status`, {
    method: "PATCH", body: JSON.stringify({ status })
  }),
  verifyQR: (token) => request("/admin/verify-qr", {
    method: "POST", body: JSON.stringify({ token })
  }),
  collectQR: (token) => request("/admin/collect-by-token", {
    method: "POST", body: JSON.stringify({ token })
  }),
  adminFoods: () => request("/admin/foods"),
  updateFood: (id, body) => request(`/admin/foods/${id}`, {
    method: "PATCH", body: JSON.stringify(body)
  }),
  addFood: (body) => request("/admin/foods", {
    method: "POST", body: JSON.stringify(body)
  }),
  adminMenus: () => request("/admin/daily-menu"),
  addMenu: (body) => request("/admin/daily-menu", {
    method: "POST", body: JSON.stringify(body)
  }),
  logs: () => request("/admin/logs")
};
