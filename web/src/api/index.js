const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export const api = {
  // Auth
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  // Search
  searchRoutes: (from, to) => request(`/routes?from=${from}&to=${to}`),
  getTrips: (routeId, date) => request(`/trips?routeId=${routeId}&date=${date}`),
  getSeats: (tripId) => request(`/trips/${tripId}/seats`),

  // Bookings
  createBooking: (body) => request("/bookings", { method: "POST", body: JSON.stringify(body) }),
  getMyBookings: () => request("/bookings/me"),
  getBooking: (id) => request(`/bookings/${id}`),

  mockConfirm: (bookingId) => request(`/payments/mock-confirm/${bookingId}`, { method: "POST" }),
  initiateTelebirr: (bookingId) =>
    request("/payments/telebirr/initiate", { method: "POST", body: JSON.stringify({ bookingId }) }),

  // Admin
  adminGetBuses: () => request("/admin/buses"),
  adminGetRoutes: () => request("/admin/routes"),
  adminCreateBus: (body) => request("/admin/buses", { method: "POST", body: JSON.stringify(body) }),
  adminCreateRoute: (body) => request("/admin/routes", { method: "POST", body: JSON.stringify(body) }),
  adminCreateTrip: (body) => request("/admin/trips", { method: "POST", body: JSON.stringify(body) }),
  adminGetBookings: () => request("/admin/bookings"),
};
