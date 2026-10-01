import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const routeId = params.get("routeId");
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");

  useEffect(() => {
    api.getTrips(routeId, date)
      .then(setTrips)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [routeId, date]);

  const fmt = (d) => new Date(d).toLocaleDateString("en-ET", { weekday: "long", month: "long", day: "numeric" });

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-400">
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      <p>Finding trips…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-up">

      {/* Header */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand mb-6 transition-colors">
        ← Back to search
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2 text-2xl font-extrabold text-gray-900">
          <span>{from}</span>
          <span className="text-brand text-xl">→</span>
          <span>{to}</span>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-8">
        {fmt(date)} · {trips.length} trip{trips.length !== 1 ? "s" : ""} available
      </p>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error}</div>
      )}

      {trips.length === 0 && !error && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🚌</div>
          <p className="text-gray-500 font-medium">No trips available for this date.</p>
          <button onClick={() => navigate(-1)} className="btn-outline mt-4 text-sm">Try another date</button>
        </div>
      )}

      <div className="space-y-4">
        {trips.map((trip, i) => {
          const soldOut = trip.availableSeats === 0;
          const almostFull = trip.availableSeats > 0 && trip.availableSeats <= 5;
          return (
            <div
              key={trip.id}
              className={`card fade-up hover:shadow-md hover:border-brand/20 transition-all duration-200 ${soldOut ? "opacity-60" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between gap-4">

                {/* Left: time + operator */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/10 to-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                    🚌
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{trip.departureTime}</p>
                    <p className="text-sm text-gray-500 font-medium">{trip.bus?.operatorName ?? trip.operator}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {soldOut ? (
                        <span className="badge bg-red-100 text-red-600">Sold Out</span>
                      ) : almostFull ? (
                        <span className="badge bg-orange-100 text-orange-600 pulse-soft">
                          🔥 {trip.availableSeats} seats left
                        </span>
                      ) : (
                        <span className="badge bg-green-100 text-green-700">
                          {trip.availableSeats} seats available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: price + CTA */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400 font-medium">per seat</p>
                  <p className="text-2xl font-extrabold text-brand">
                    ETB {Number(trip.price).toLocaleString()}
                  </p>
                  <button
                    className={`mt-2 text-sm ${soldOut ? "btn-ghost cursor-not-allowed" : "btn-primary"}`}
                    disabled={soldOut}
                    onClick={() => navigate(`/seats/${trip.id}`)}
                  >
                    {soldOut ? "Sold Out" : "Select Seats →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
