import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../api/AuthContext";

function buildLayout(seats) {
  const by = {};
  seats.forEach((s) => (by[s.seatNumber] = s));
  if (seats.length === 47) {
    return [
      { type: "normal", left: [by[1],  by[2]],  right: [by[3],  by[4]]  },
      { type: "normal", left: [by[5],  by[6]],  right: [by[7],  by[8]]  },
      { type: "normal", left: [by[9],  by[10]], right: [by[11], by[12]] },
      { type: "normal", left: [by[13], by[14]], right: [by[15], by[16]] },
      { type: "normal", left: [by[17], by[18]], right: [by[19], by[20]] },
      { type: "door",   left: [by[21], by[22]], right: null               },
      { type: "normal", left: [by[23], by[24]], right: [by[25], by[26]] },
      { type: "normal", left: [by[27], by[28]], right: [by[29], by[30]] },
      { type: "normal", left: [by[31], by[32]], right: [by[33], by[34]] },
      { type: "normal", left: [by[35], by[36]], right: [by[37], by[38]] },
      { type: "normal", left: [by[39], by[40]], right: [by[41], by[42]] },
      { type: "back",   seats: [by[43], by[44], by[45], by[46], by[47]] },
    ];
  }

  // Dynamic layout for arbitrary fleet seat counts
  const sorted = [...seats].sort((a, b) => a.seatNumber - b.seatNumber);
  const rows = [];
  let i = 0;
  while (i < sorted.length) {
    const remaining = sorted.length - i;
    if (remaining <= 5 && remaining >= 3 && i > 0) {
      rows.push({ type: "back", seats: sorted.slice(i) });
      break;
    }
    const chunk = sorted.slice(i, i + 4);
    rows.push({
      type: "normal",
      left: [chunk[0], chunk[1]].filter(Boolean),
      right: [chunk[2], chunk[3]].filter(Boolean),
    });
    i += 4;
  }
  return rows;
}

function SeatBtn({ seat, selected, onToggle }) {
  if (!seat) return <div className="w-10 h-11" />;
  const isTaken    = seat.status !== "AVAILABLE";
  const isSelected = selected.includes(seat.id);

  return (
    <button
      onClick={() => onToggle(seat)}
      disabled={isTaken}
      title={`Seat ${seat.seatNumber}`}
      className={`w-10 h-11 rounded-t-xl rounded-b-sm text-[11px] font-bold
                  transition-all duration-150 active:scale-95 relative border
        ${isTaken
          ? "bg-white/3 border-white/5 text-gray-700 cursor-not-allowed"
          : isSelected
          ? "bg-gradient-to-b from-violet-500 to-violet-700 border-violet-400 text-white scale-105"
          : "bg-white/8 border-white/15 text-gray-400 hover:border-violet-500/60 hover:text-violet-300 hover:bg-violet-500/15"
        }`}
      style={isSelected ? { boxShadow: "0 0 12px rgba(139,92,246,0.6), 0 0 24px rgba(139,92,246,0.2)" } : {}}
    >
      {isTaken ? "✕" : seat.seatNumber}
      {/* Seat base */}
      <span className={`absolute bottom-0 left-1 right-1 h-[3px] rounded-full ${
        isTaken ? "bg-white/5" : isSelected ? "bg-cyan-400" : "bg-white/10"
      }`} />
    </button>
  );
}

export default function SeatsPage() {
  const { tripId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [seats,    setSeats]   = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [booking,  setBooking] = useState(false);
  const [error,    setError]   = useState("");

  useEffect(() => {
    api.getSeats(tripId)
      .then(setSeats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  const toggle = (seat) => {
    if (seat.status !== "AVAILABLE") return;
    setSelected((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
    );
  };

  const handleBook = async () => {
    if (!user) return navigate("/login");
    setBooking(true);
    setError("");
    try {
      const result = await api.createBooking({ tripId: Number(tripId), seatIds: selected });
      navigate(`/checkout/${result.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  const rows      = buildLayout(seats);
  const available = seats.filter((s) => s.status === "AVAILABLE").length;
  const taken     = seats.filter((s) => s.status !== "AVAILABLE").length;

  return (
    <div className="max-w-sm mx-auto px-4 py-8 pb-32 fade-up">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-violet-400 mb-5 transition-colors">
        ← Back
      </button>

      <h2 className="text-xl font-black text-white mb-1">Pick Your Seats</h2>
      <p className="text-sm text-gray-500 mb-5">{available} of {seats.length} seats available</p>

      {/* Legend */}
      <div className="flex gap-5 text-xs mb-5">
        {[
          { cls: "bg-white/8 border-white/15",                    label: "Available" },
          { cls: "bg-violet-600 border-violet-400",               label: "Selected",
            style: { boxShadow: "0 0 8px rgba(139,92,246,0.5)" } },
          { cls: "bg-white/3 border-white/5",                     label: "Taken"     },
        ].map(({ cls, label, style }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-5 h-6 rounded-t-lg rounded-b-sm border ${cls}`} style={style} />
            <span className="text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Bus shell */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-500/10"
           style={{ background: "linear-gradient(180deg, #13131f 0%, #0f0f1a 100%)" }}>

        {/* Ambient glow inside bus */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-48 bg-violet-600/8 rounded-full blur-3xl" />
        </div>

        {/* Front header */}
        <div className="relative px-3 py-3 border-b border-white/8"
             style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(6,182,212,0.2) 100%)" }}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 text-center border border-white/10">
              <p className="text-[10px] text-gray-400 font-medium">DRIVER</p>
              <p className="text-sm">🧑‍✈️</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-px h-3 bg-white/10" />
              <span className="text-[9px] text-gray-600 font-semibold tracking-widest uppercase">Aisle</span>
              <div className="w-px h-3 bg-white/10" />
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 text-center border border-white/10">
              <p className="text-[10px] text-gray-400 font-medium">FRONT DOOR</p>
              <p className="text-sm">🚪</p>
            </div>
          </div>
          {/* Windshield line */}
          <div className="mt-2 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        </div>

        {/* Seat rows */}
        <div className="p-3 space-y-1.5 relative z-10">
          {rows.map((row, ri) => (
            <div key={ri} className="flex items-center justify-center gap-1.5">

              {row.type === "back" && (
                <>
                  {/* Back row label */}
                  <div className="absolute left-3 text-[9px] text-gray-700 font-semibold uppercase tracking-wider">Back</div>
                  {row.seats.map((seat, si) => (
                    <SeatBtn key={si} seat={seat} selected={selected} onToggle={toggle} />
                  ))}
                </>
              )}

              {(row.type === "normal" || row.type === "door") && (
                <>
                  {row.left.map((seat, si) => (
                    <SeatBtn key={si} seat={seat} selected={selected} onToggle={toggle} />
                  ))}

                  {/* Aisle */}
                  <div className="w-5 flex items-center justify-center">
                    <div className="w-px h-8 bg-white/5" />
                  </div>

                  {row.type === "door" ? (
                    <div className="flex gap-1.5">
                      <div className="w-10 h-11 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 flex items-center justify-center">
                        <span className="text-[9px] text-cyan-600 font-semibold text-center leading-tight">Mini<br/>Door</span>
                      </div>
                      <div className="w-10 h-11" />
                    </div>
                  ) : (
                    row.right.map((seat, si) => (
                      <SeatBtn key={si} seat={seat} selected={selected} onToggle={toggle} />
                    ))
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Rear bumper */}
        <div className="border-t border-white/8 py-2 text-center"
             style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(139,92,246,0.2) 100%)" }}>
          <p className="text-[9px] text-gray-600 font-semibold tracking-[0.3em] uppercase">Rear</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Total",     value: seats.length,    color: "text-gray-300" },
          { label: "Available", value: available,        color: "text-emerald-400" },
          { label: "Taken",     value: taken,            color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 rounded-xl border border-white/8 py-2">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/8 px-4 py-4 z-40"
           style={{ background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-sm mx-auto flex items-center justify-between gap-4">
          <div>
            {selected.length === 0 ? (
              <p className="text-sm text-gray-600">Tap seats to select</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">{selected.length} seat{selected.length !== 1 ? "s" : ""} selected</p>
                <p className="font-bold text-violet-400 text-sm leading-tight">
                  Seats: {selected.map((id) => seats.find((s) => s.id === id)?.seatNumber).join(", ")}
                </p>
              </>
            )}
          </div>
          <button
            className="btn-primary px-6 py-3 text-sm flex-shrink-0"
            disabled={selected.length === 0 || booking}
            onClick={handleBook}
          >
            {booking ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Reserving…
              </span>
            ) : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
