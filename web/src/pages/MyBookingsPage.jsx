import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const STATUS = {
  PAID:     { cls: "bg-green-100 text-green-700",  icon: "✅" },
  PENDING:  { cls: "bg-yellow-100 text-yellow-700", icon: "⏳" },
  FAILED:   { cls: "bg-red-100 text-red-600",       icon: "❌" },
  REFUNDED: { cls: "bg-gray-100 text-gray-600",     icon: "↩️" },
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyBookings().then(setBookings).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">My Trips</h2>
          <p className="text-gray-400 text-sm mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>
        <Link to="/" className="btn-primary text-sm">+ New Booking</Link>
      </div>

      {bookings.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🎫</div>
          <p className="text-gray-500 font-medium mb-1">No trips booked yet</p>
          <p className="text-gray-400 text-sm mb-5">Your bookings will appear here</p>
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
              className="card block hover:shadow-md hover:border-brand/20 transition-all duration-200 fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-4">

                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand/10 to-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                  🚌
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 truncate">
                      {b.trip.route.origin} → {b.trip.route.destination}
                    </p>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {b.trip.date} · {b.trip.departureTime} · {b.trip.bus.operatorName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.seatIds.length} seat{b.seatIds.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Price + status */}
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-brand">ETB {Number(b.totalPrice).toLocaleString()}</p>
                  <span className={`badge mt-1 ${s.cls}`}>
                    {s.icon} {b.paymentStatus}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
