const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export const api = {
  // Auth
  requestOtp: (body) => request("/auth/otp/request", { method: "POST", body: JSON.stringify(body) }),
  verifyOtp: (body) => request("/auth/otp/verify", { method: "POST", body: JSON.stringify(body) }),
  getProfile: () => request("/auth/me"),
  updateProfile: (body) => request("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  deleteAccount: () => request("/auth/me", { method: "DELETE" }),

  // Search
  searchRoutes: (from, to) => request(`/routes?${new URLSearchParams({ from, to })}`),
  getTrips: (routeId, date) =>
    request(`/trips?${new URLSearchParams({ routeId: String(routeId), date })}`),
  getTrip: (tripId) => request(`/trips/${tripId}`),
  getSeats: (tripId) => request(`/trips/${tripId}/seats`),

  // Bookings
  createBooking: (body) => request("/bookings", { method: "POST", body: JSON.stringify(body) }),
  getMyBookings: () => request("/bookings/me"),
  getBooking: (id) => request(`/bookings/${id}`),
  updateBooking: (id, body) => request(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  cancelBooking: (id) => request(`/bookings/${id}`, { method: "DELETE" }),

  mockConfirm: (bookingId) => request(`/payments/mock-confirm/${bookingId}`, { method: "POST" }),
  initiateTelebirr: (bookingId) =>
    request("/payments/telebirr/initiate", { method: "POST", body: JSON.stringify({ bookingId }) }),
  initiateStripe: (bookingId) =>
    request("/payments/stripe/initiate", { method: "POST", body: JSON.stringify({ bookingId }) }),
  getPaymentStatus: (bookingId) => request(`/payments/bookings/${bookingId}/status`),
  refundBooking: (bookingId, reason) => request(`/payments/bookings/${bookingId}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }),

  // Admin
  adminGetBuses: () => request("/admin/buses"),
  adminGetRoutes: () => request("/admin/routes"),
  adminCreateBus: (body) => request("/admin/buses", { method: "POST", body: JSON.stringify(body) }),
  adminCreateRoute: (body) => request("/admin/routes", { method: "POST", body: JSON.stringify(body) }),
  adminCreateTrip: (body) => request("/admin/trips", { method: "POST", body: JSON.stringify(body) }),
  adminGetTrips: () => request("/admin/trips"),
  adminGetTrip: (id) => request(`/admin/trips/${id}`),
  adminUpdateTrip: (id, body) => request(`/admin/trips/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminDeleteTrip: (id) => request(`/admin/trips/${id}`, { method: "DELETE" }),
  adminUpdateUserRole: (id, role) => request(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  }),
  adminGetBookings: () => request("/admin/bookings"),
};
