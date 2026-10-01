import { useEffect, useState } from "react";
import { api } from "../api";

const CITIES = ["Addis Ababa", "Hawassa", "Bahir Dar", "Dire Dawa", "Mekelle", "Gondar", "Jimma"];

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input className="input text-sm" {...props} />
    </div>
  );
}

function SelectField({ label, children, ...props }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <select className="input text-sm" {...props}>{children}</select>
    </div>
  );
}

function Msg({ text }) {
  if (!text) return null;
  const ok = text.startsWith("✅");
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
      {text}
    </div>
  );
}

const TABS = ["add trip", "buses", "routes", "bookings"];

export default function AdminPage() {
  const [tab, setTab] = useState("add trip");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Combined "add trip" form state
  const [form, setForm] = useState({
    // bus
    busName: "",
    plateNumber: "",
    totalSeats: "47",
    existingBusId: "",
    busMode: "new",          // "new" | "existing"
    // route
    from: "",
    to: "",
    existingRouteId: "",
    routeMode: "new",        // "new" | "existing"
    // trip
    date: "",
    departureTime: "",
    price: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.adminGetBuses().then(setBuses).catch(() => {});
    api.adminGetRoutes().then(setRoutes).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "bookings") api.adminGetBookings().then(setBookings).catch(() => {});
  }, [tab]);

  const handleAddTrip = async () => {
    setMsg("");
    setLoading(true);
    try {
      // 1. Resolve bus
      let busId;
      if (form.busMode === "existing") {
        busId = Number(form.existingBusId);
      } else {
        if (!form.busName || !form.plateNumber || !form.totalSeats)
          throw new Error("Fill in all bus fields");
        const bus = await api.adminCreateBus({
          operatorName: form.busName,
          plateNumber: form.plateNumber,
          totalSeats: Number(form.totalSeats),
        });
        busId = bus.id;
        setBuses((prev) => [...prev, bus]);
      }

      // 2. Resolve route
      let routeId;
      if (form.routeMode === "existing") {
        routeId = Number(form.existingRouteId);
      } else {
        if (!form.from || !form.to) throw new Error("Select origin and destination");
        if (form.from === form.to) throw new Error("Origin and destination must be different");
        // reuse existing route if it already exists
        const existing = routes.find(
          (r) => r.origin === form.from && r.destination === form.to
        );
        if (existing) {
          routeId = existing.id;
        } else {
          const route = await api.adminCreateRoute({
            origin: form.from,
            destination: form.to,
            distanceKm: 1,   // placeholder — update in Routes tab if needed
          });
          routeId = route.id;
          setRoutes((prev) => [...prev, route]);
        }
      }

      // 3. Create trip + seats
      if (!form.date || !form.departureTime || !form.price)
        throw new Error("Fill in date, time and price");

      await api.adminCreateTrip({
        busId,
        routeId,
        date: form.date,
        departureTime: form.departureTime,
        price: Number(form.price),
      });

      setMsg("✅ Trip created! Seats auto-generated.");
      setForm((f) => ({ ...f, date: "", departureTime: "", price: "" }));
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 fade-up">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Admin Dashboard</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMsg(""); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
              tab === t
                ? "bg-brand text-white shadow-md shadow-brand/20"
                : "bg-white text-gray-500 border border-gray-200 hover:border-brand hover:text-brand"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── ADD TRIP (main form) ── */}
      {tab === "add trip" && (
        <div className="space-y-6">
          <Msg text={msg} />

          {/* Bus section */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">🚌 Bus</h3>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {["new", "existing"].map((m) => (
                  <button
                    key={m}
                    onClick={() => set("busMode", m)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                      form.busMode === m ? "bg-white shadow text-brand" : "text-gray-500"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {form.busMode === "new" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field
                    label="Bus / Company Name"
                    placeholder="e.g. Selam Bus, Sky Bus"
                    value={form.busName}
                    onChange={(e) => set("busName", e.target.value)}
                  />
                </div>
                <Field
                  label="Plate Number"
                  placeholder="AA-12345"
                  value={form.plateNumber}
                  onChange={(e) => set("plateNumber", e.target.value)}
                />
                <Field
                  label="Total Seats"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="47"
                  value={form.totalSeats}
                  onChange={(e) => set("totalSeats", e.target.value)}
                />
              </div>
            ) : (
              <SelectField
                label="Select Existing Bus"
                value={form.existingBusId}
                onChange={(e) => set("existingBusId", e.target.value)}
              >
                <option value="">— pick a bus —</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.operatorName} · {b.plateNumber} ({b.totalSeats} seats)
                  </option>
                ))}
              </SelectField>
            )}
          </div>

          {/* Route section */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">🗺️ Route</h3>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {["new", "existing"].map((m) => (
                  <button
                    key={m}
                    onClick={() => set("routeMode", m)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                      form.routeMode === m ? "bg-white shadow text-brand" : "text-gray-500"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {form.routeMode === "new" ? (
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="From"
                  value={form.from}
                  onChange={(e) => set("from", e.target.value)}
                >
                  <option value="">— origin —</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </SelectField>
                <SelectField
                  label="To"
                  value={form.to}
                  onChange={(e) => set("to", e.target.value)}
                >
                  <option value="">— destination —</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </SelectField>
              </div>
            ) : (
              <SelectField
                label="Select Existing Route"
                value={form.existingRouteId}
                onChange={(e) => set("existingRouteId", e.target.value)}
              >
                <option value="">— pick a route —</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.origin} → {r.destination}
                  </option>
                ))}
              </SelectField>
            )}
          </div>

          {/* Trip details */}
          <div className="card space-y-4">
            <h3 className="font-bold text-gray-900">🎫 Trip Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Date"
                type="date"
                min={today}
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              <Field
                label="Departure Time"
                type="time"
                value={form.departureTime}
                onChange={(e) => set("departureTime", e.target.value)}
              />
              <div className="col-span-2">
                <Field
                  label="Ticket Price (ETB)"
                  type="number"
                  min="1"
                  placeholder="e.g. 350"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            className="btn-primary w-full py-4 text-base"
            onClick={handleAddTrip}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating…
              </span>
            ) : "✅ Create Trip + Auto-generate Seats"}
          </button>
        </div>
      )}

      {/* ── BUSES LIST ── */}
      {tab === "buses" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">{buses.length} buses registered</p>
          {buses.length === 0 && <div className="card text-center text-gray-400 py-10">No buses yet.</div>}
          {buses.map((b) => (
            <div key={b.id} className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-2xl flex-shrink-0">🚌</div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{b.operatorName}</p>
                <p className="text-sm text-gray-400">{b.plateNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-brand">{b.totalSeats} seats</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ROUTES LIST ── */}
      {tab === "routes" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">{routes.length} routes registered</p>
          {routes.length === 0 && <div className="card text-center text-gray-400 py-10">No routes yet.</div>}
          {routes.map((r) => (
            <div key={r.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🗺️</div>
                <div>
                  <p className="font-bold text-gray-900">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-400">{r.distanceKm} km</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BOOKINGS ── */}
      {tab === "bookings" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">{bookings.length} total bookings</p>
          {bookings.length === 0 && <div className="card text-center text-gray-400 py-10">No bookings yet.</div>}
          {bookings.map((b) => (
            <div key={b.id} className="card flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-gray-900">{b.user.name}</p>
                <p className="text-sm text-gray-400">{b.user.email}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {b.trip.route.origin} → {b.trip.route.destination} · {b.trip.date}
                </p>
                <p className="text-xs text-gray-400">{b.seatIds.length} seat{b.seatIds.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-extrabold text-brand">ETB {Number(b.totalPrice).toLocaleString()}</p>
                <span className={`badge mt-1 ${
                  b.paymentStatus === "PAID"
                    ? "bg-green-100 text-green-700"
                    : b.paymentStatus === "FAILED"
                    ? "bg-red-100 text-red-600"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {b.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
