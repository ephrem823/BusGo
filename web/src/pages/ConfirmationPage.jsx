import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ConfirmationPage() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const isMock = searchParams.get("mock") === "1";
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // If mock payment, confirm it first then fetch
    const load = async () => {
      if (isMock) await api.mockConfirm(bookingId).catch(() => {});
      api.getBooking(bookingId).then(setBooking).catch((e) => setError(e.message));
    };
    load();
  }, [bookingId]);

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!booking) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  );

  const isPaid = booking.paymentStatus === "PAID";

  return (
    <div className="max-w-md mx-auto px-4 py-12 fade-up">

      {/* Status hero */}
      <div className="text-center mb-8">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 shadow-lg ${
          isPaid ? "bg-green-100 shadow-green-200" : "bg-yellow-100 shadow-yellow-200"
        }`}>
          {isPaid ? "✅" : "⏳"}
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">
          {isPaid ? "You're all set!" : "Payment Pending"}
        </h2>
        <p className="text-gray-400 mt-1 text-sm">
          {isPaid
            ? "Your seats are confirmed. Have a safe journey! 🇪🇹"
            : "Waiting for payment confirmation…"}
        </p>
      </div>

      {/* Ticket card */}
      <div className="card overflow-hidden shadow-lg">

        {/* Ticket header */}
        <div className="bg-gradient-to-r from-brand to-brand-dark px-5 py-4 -mx-5 -mt-5 mb-5">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-xs opacity-70 font-medium uppercase tracking-wide">From</p>
              <p className="text-lg font-bold">{booking.trip.route.origin}</p>
            </div>
            <div className="text-2xl">✈</div>
            <div className="text-right">
              <p className="text-xs opacity-70 font-medium uppercase tracking-wide">To</p>
              <p className="text-lg font-bold">{booking.trip.route.destination}</p>
            </div>
          </div>
        </div>

        {/* Ticket details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Booking ID", value: `#${booking.id}` },
            { label: "Operator", value: booking.trip.bus.operatorName },
            { label: "Date", value: booking.trip.date },
            { label: "Departure", value: booking.trip.departureTime },
            { label: "Seats", value: booking.seatIds.length },
            { label: "Total", value: `ETB ${Number(booking.totalPrice).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="font-semibold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Divider with circles */}
        <div className="relative my-5 flex items-center">
          <div className="absolute -left-5 w-5 h-5 rounded-full bg-[#f5f7ff] border-r border-gray-100" />
          <div className="flex-1 border-t-2 border-dashed border-gray-200" />
          <div className="absolute -right-5 w-5 h-5 rounded-full bg-[#f5f7ff] border-l border-gray-100" />
        </div>

        {/* Status badge */}
        <div className="flex justify-center">
          <span className={`badge text-sm px-4 py-1.5 ${
            isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          }`}>
            {booking.paymentStatus}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Link to="/my-bookings" className="btn-outline flex-1 justify-center">My Trips</Link>
        <Link to="/" className="btn-primary flex-1 justify-center">Book Another</Link>
      </div>
    </div>
  );
}
