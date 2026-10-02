import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Redirecting to TeleBirr…
    </span>
  );
}

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const navigate      = useNavigate();
  const [booking, setBooking] = useState(null);
  const [paying,  setPaying]  = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    api.getBooking(bookingId).then(setBooking).catch((e) => setError(e.message));
  }, [bookingId]);

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const { payUrl } = await api.initiateTelebirr(bookingId);
      window.location.href = payUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  if (error) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate(-1)} className="btn-outline mt-4">Go Back</button>
    </div>
  );

  if (!booking) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-8 fade-up">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-violet-400 mb-6 transition-colors">
        ← Back
      </button>

      <h2 className="text-2xl font-black text-white mb-1">Complete Payment</h2>
      <p className="text-gray-500 text-sm mb-6">Pay securely via TeleBirr</p>

      {/* Booking summary */}
      <div className="glass p-5 mb-6 border border-white/10">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="text-sm text-gray-400 space-y-1">
            <p className="font-bold text-white text-base">
              {booking.trip.route.origin} → {booking.trip.route.destination}
            </p>
            <p>{booking.trip.date} · {booking.trip.departureTime}</p>
            <p>{booking.seatIds.length} seat{booking.seatIds.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              ETB {Number(booking.totalPrice).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/8 my-4" />

        {/* TeleBirr branding */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 flex-shrink-0">
            📱
          </div>
          <div>
            <p className="font-bold text-white text-sm">TeleBirr</p>
            <p className="text-xs text-gray-500">Ethio Telecom Mobile Payment</p>
          </div>
          <div className="ml-auto">
            <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Secure</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      <button
        className="btn-primary w-full py-4 text-base"
        onClick={handlePay}
        disabled={paying}
        style={{ boxShadow: paying ? "none" : "0 0 30px rgba(139,92,246,0.3)" }}
      >
        {paying ? <Spinner /> : `📱 Pay ETB ${Number(booking.totalPrice).toLocaleString()} via TeleBirr`}
      </button>

      <p className="text-center text-xs text-gray-600 mt-4">🔒 Payments are secure and encrypted</p>
    </div>
  );
}
