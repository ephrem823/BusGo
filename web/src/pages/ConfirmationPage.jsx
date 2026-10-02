import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ConfirmationPage() {
  const { bookingId }  = useParams();
  const [searchParams] = useSearchParams();
  const isMock         = searchParams.get("mock") === "1";
  const [booking, setBooking] = useState(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const load = async () => {
      if (isMock) await api.mockConfirm(bookingId).catch(() => {});
      api.getBooking(bookingId).then(setBooking).catch((e) => setError(e.message));
    };
    load();
  }, [bookingId]);

  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!booking) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  const isPaid = booking.paymentStatus === "PAID";

  return (
    <div className="max-w-md mx-auto px-4 py-12 fade-up">

      {/* Status hero */}
      <div className="text-center mb-8">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 ${
          isPaid
            ? "bg-emerald-500/15 border border-emerald-500/20"
            : "bg-yellow-500/15 border border-yellow-500/20"
        }`}
          style={isPaid ? { boxShadow: "0 0 30px rgba(16,185,129,0.2)" } : {}}>
          {isPaid ? "✅" : "⏳"}
        </div>
        <h2 className="text-2xl font-black text-white">
          {isPaid ? "You're all set!" : "Payment Pending"}
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          {isPaid ? "Your seats are confirmed. Have a safe journey! 🇪🇹" : "Waiting for payment confirmation…"}
        </p>
      </div>

      {/* Ticket card */}
      <div className="rounded-2xl border border-white/10 overflow-hidden"
           style={{ background: "linear-gradient(180deg, #13131f 0%, #0f0f1a 100%)" }}>

        {/* Ticket header */}
        <div className="px-5 py-4 relative overflow-hidden"
             style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(6,182,212,0.3) 100%)" }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
          <div className="relative flex items-center justify-between text-white">
            <div>
              <p className="text-xs opacity-60 font-semibold uppercase tracking-wider">From</p>
              <p className="text-lg font-black">{booking.trip.route.origin}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xl">✈</div>
              <div className="w-16 h-px bg-white/20" />
            </div>
            <div className="text-right">
              <p className="text-xs opacity-60 font-semibold uppercase tracking-wider">To</p>
              <p className="text-lg font-black">{booking.trip.route.destination}</p>
            </div>
          </div>
        </div>

        {/* Ticket details */}
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Booking ID",  value: `#${booking.id}` },
              { label: "Operator",    value: booking.trip.bus.operatorName },
              { label: "Date",        value: booking.trip.date },
              { label: "Departure",   value: booking.trip.departureTime },
              { label: "Seats",       value: booking.seatIds.length },
              { label: "Total",       value: `ETB ${Number(booking.totalPrice).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">{label}</p>
                <p className="font-bold text-gray-200 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Dashed divider */}
          <div className="relative my-5 flex items-center">
            <div className="absolute -left-5 w-4 h-4 rounded-full bg-[#0a0a0f]" />
            <div className="flex-1 border-t border-dashed border-white/10" />
            <div className="absolute -right-5 w-4 h-4 rounded-full bg-[#0a0a0f]" />
          </div>

          <div className="flex justify-center">
            <span className={`badge text-sm px-4 py-1.5 ${
              isPaid
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
            }`}>
              {booking.paymentStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Link to="/my-bookings" className="btn-outline flex-1 justify-center">My Trips</Link>
        <Link to="/" className="btn-primary flex-1 justify-center">Book Another</Link>
      </div>
    </div>
  );
}
