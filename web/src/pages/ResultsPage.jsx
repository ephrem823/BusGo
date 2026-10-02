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
  const date    = params.get("date");
  const from    = params.get("from");
  const to      = params.get("to");

  useEffect(() => {
    api.getTrips(routeId, date)
      .then(setTrips)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [routeId, date]);

  const fmt = (d) => new Date(d).toLocaleDateString("en-ET", { weekday: "long", month: "long", day: "numeric" });

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
      <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      <p>Finding trips…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 fade-up">

      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-violet-400 mb-6 transition-colors">
        ← Back to search
      </button>

      {/* Route header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-2xl font-black text-white mb-1">
          <span>{from}</span>
          <span className="text-violet-400">→</span>
          <span>{to}</span>
        </div>
        <p className="text-gray-500 text-sm">{fmt(date)} · {trips.length} trip{trips.length !== 1 ? "s" : ""} available</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm mb-6">⚠️ {error}</div>
      )}

      {trips.length === 0 && !error && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🚌</div>
          <p className="text-gray-400 font-medium">No trips available for this date.</p>
          <button onClick={() => navigate(-1)} className="btn-outline mt-4 text-sm">Try another date</button>
        </div>
      )}

      <div className="space-y-3">
        {trips.map((trip, i) => {
          const soldOut    = trip.availableSeats === 0;
          const almostFull = trip.availableSeats > 0 && trip.availableSeats <= 5;
          return (
            <div
              key={trip.id}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-200 p-5 fade-up ${
                soldOut
                  ? "border-white/5 bg-white/3 opacity-50"
                  : "border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-violet-500/5 cursor-pointer"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Glow accent */}
              {!soldOut && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
              )}

              <div className="flex items-center justify-between gap-4">
                {/* Bus icon + info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                    🚌
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">{trip.departureTime}</p>
                    <p className="text-sm text-gray-400 font-medium">{trip.bus?.operatorName ?? trip.operator}</p>
                    <div className="mt-1.5">
                      {soldOut ? (
                        <span className="badge bg-red-500/15 text-red-400 border border-red-500/20">Sold Out</span>
                      ) : almostFull ? (
                        <span className="badge bg-orange-500/15 text-orange-400 border border-orange-500/20 pulse-soft">
                          🔥 {trip.availableSeats} seats left
                        </span>
                      ) : (
                        <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          ✓ {trip.availableSeats} available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 font-medium">per seat</p>
                  <p className="text-2xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
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
