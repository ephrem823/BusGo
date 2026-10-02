import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const STATUS = {
  PAID:     { cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20", icon: "✅" },
  PENDING:  { cls: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",   icon: "⏳" },
  FAILED:   { cls: "bg-red-500/15 text-red-400 border border-red-500/20",             icon: "❌" },
  REFUNDED: { cls: "bg-gray-500/15 text-gray-400 border border-gray-500/20",          icon: "↩️" },
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.getMyBookings().then(setBookings).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white">My Trips</h2>
          <p className="text-gray-500 text-sm mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>
        <Link to="/" className="btn-primary text-sm">+ New Booking</Link>
      </div>

      {bookings.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🎫</div>
          <p className="text-gray-300 font-medium mb-1">No trips booked yet</p>
          <p className="text-gray-500 text-sm mb-5">Your bookings will appear here</p>
          <Link to="/" className="btn-primary text-sm">Search Buses</Link>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b, i) => {
          const s = STATUS[b.paymentStatus] ?? STATUS.PENDING;
          return (
            <Link
              key={b.id}
              to={`/confirmation/${b.id}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200 fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-xl flex-shrink-0">
                  🚌
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">
                    {b.trip.route.origin} → {b.trip.route.destination}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {b.trip.date} · {b.trip.departureTime} · {b.trip.bus.operatorName}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {b.seatIds.length} seat{b.seatIds.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    ETB {Number(b.totalPrice).toLocaleString()}
                  </p>
                  <span className={`badge mt-1.5 ${s.cls}`}>{s.icon} {b.paymentStatus}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
