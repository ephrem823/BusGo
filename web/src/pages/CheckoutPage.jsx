import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { api } from "../api";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const METHODS = [
  {
    id: "CHAPA",
    label: "Chapa",
    desc: "TeleBirr, CBE Birr, Amole, Card & more",
    icon: "🇪🇹",
    recommended: true,
  },
  {
    id: "TELEBIRR",
    label: "TeleBirr",
    desc: "Pay directly via TeleBirr",
    icon: "📱",
  },
  {
    id: "CBE",
    label: "CBE Birr",
    desc: "Commercial Bank of Ethiopia",
    icon: "🏦",
  },
  {
    id: "STRIPE",
    label: "Card",
    desc: "International debit / credit card",
    icon: "💳",
  },
];

function StripeForm({ bookingId, totalPrice }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError("");
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/confirmation/${bookingId}` },
    });
    if (err) setError(err.message);
    setPaying(false);
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
      <button type="submit" className="btn-primary w-full py-3" disabled={paying || !stripe}>
        {paying ? <Spinner /> : `Pay ETB ${Number(totalPrice).toLocaleString()}`}
      </button>
    </form>
  );
}

function RedirectPayButton({ label, icon, onPay, totalPrice }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const { payUrl } = await onPay();
      window.location.href = payUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-2.5 text-sm">
          ⚠️ {error}
        </div>
      )}
      <button className="btn-primary w-full py-3.5 text-base" onClick={handlePay} disabled={paying}>
        {paying ? <Spinner /> : `${icon} Pay ETB ${Number(totalPrice).toLocaleString()} via ${label}`}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      Redirecting…
    </span>
  );
}

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [method, setMethod] = useState("CHAPA");
  const [clientSecret, setClientSecret] = useState("");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [loadingStripe, setLoadingStripe] = useState(false);

  useEffect(() => {
    api.getBooking(bookingId).then(setBooking).catch((e) => setError(e.message));
  }, [bookingId]);

  useEffect(() => {
    if (method !== "STRIPE" || clientSecret) return;
    setLoadingStripe(true);
    api.createPaymentIntent(bookingId)
      .then((d) => setClientSecret(d.clientSecret))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingStripe(false));
  }, [method]);

  if (error) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <p className="text-red-500">{error}</p>
      <button onClick={() => navigate(-1)} className="btn-outline mt-4">Go Back</button>
    </div>
  );

  if (!booking) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-8 fade-up">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand mb-6 transition-colors">
        ← Back
      </button>

      <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Complete Payment</h2>
      <p className="text-gray-400 text-sm mb-6">Choose how you'd like to pay</p>

      {/* Booking summary */}
      <div className="glass p-4 mb-6 flex items-center justify-between gap-4">
        <div className="text-sm text-gray-600 space-y-0.5">
          <p className="font-semibold text-gray-900">
            {booking.trip.route.origin} → {booking.trip.route.destination}
          </p>
          <p>{booking.trip.date} · {booking.trip.departureTime}</p>
          <p>{booking.seatIds.length} seat{booking.seatIds.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-extrabold text-brand">
            ETB {Number(booking.totalPrice).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payment method selector */}
      <div className="space-y-2 mb-6">
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
              method === m.id
                ? "border-brand bg-brand/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="text-2xl">{m.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">{m.label}</span>
                {m.recommended && (
                  <span className="badge bg-brand/10 text-brand text-[10px]">Recommended</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
              method === m.id ? "border-brand bg-brand" : "border-gray-300"
            }`}>
              {method === m.id && (
                <div className="w-full h-full rounded-full bg-white scale-50" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Payment form */}
      <div className="card">
        {method === "CHAPA" && (
          <RedirectPayButton
            label="Chapa"
            icon="🇪🇹"
            totalPrice={booking.totalPrice}
            onPay={() => api.initiateChapa(bookingId)}
          />
        )}
        {method === "TELEBIRR" && (
          <RedirectPayButton
            label="TeleBirr"
            icon="📱"
            totalPrice={booking.totalPrice}
            onPay={() => api.initiateTelebirr(bookingId)}
          />
        )}
        {method === "CBE" && (
          <RedirectPayButton
            label="CBE Birr"
            icon="🏦"
            totalPrice={booking.totalPrice}
            onPay={() => api.initiateCbe(bookingId)}
          />
        )}
        {method === "STRIPE" && (
          loadingStripe
            ? <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
            : clientSecret
              ? <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripeForm bookingId={bookingId} totalPrice={booking.totalPrice} />
                </Elements>
              : null
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        🔒 Payments are secure and encrypted
      </p>
    </div>
  );
}
