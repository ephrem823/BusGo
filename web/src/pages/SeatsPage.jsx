import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../api/AuthContext";

// Exact Yutong 47-seat layout from diagram:
//
// Front:  [Driver]  aisle  [Front door]
// Row 1:  1  2   |   3  4
// Row 2:  5  6   |   7  8
// Row 3:  9  10  |  11  12
// Row 4: 13  14  |  15  16
// Row 5: 17  18  |  19  20
// Row 6: 21  22  | [Mini door]   ← right side has door, no seats
// Row 7: 23  24  |  25  26
// Row 8: 27  28  |  29  30
// Row 9: 31  32  |  33  34
// Row10: 35  36  |  37  38
// Row11: 39  40  |  41  42
// Back:  43  44  45  46  47

function buildLayout(seats) {
  const by = {};
  seats.forEach((s) => (by[s.seatNumber] = s));

  return [
    { type: "normal", left: [by[1],  by[2]],  right: [by[3],  by[4]]  },
    { type: "normal", left: [by[5],  by[6]],  right: [by[7],  by[8]]  },
    { type: "normal", left: [by[9],  by[10]], right: [by[11], by[12]] },
    { type: "normal", left: [by[13], by[14]], right: [by[15], by[16]] },
    { type: "normal", left: [by[17], by[18]], right: [by[19], by[20]] },
    { type: "door",   left: [by[21], by[22]], right: null               }, // mini door row
    { type: "normal", left: [by[23], by[24]], right: [by[25], by[26]] },
    { type: "normal", left: [by[27], by[28]], right: [by[29], by[30]] },
    { type: "normal", left: [by[31], by[32]], right: [by[33], by[34]] },
    { type: "normal", left: [by[35], by[36]], right: [by[37], by[38]] },
    { type: "normal", left: [by[39], by[40]], right: [by[41], by[42]] },
    { type: "back",   seats: [by[43], by[44], by[45], by[46], by[47]] },
  ];
}

function SeatBtn({ seat, selected, onToggle }) {
  if (!seat) return <div className="w-10 h-11" />;
  const isTaken = seat.status !== "AVAILABLE";
  const isSelected = selected.includes(seat.id);

  return (
    <button
      onClick={() => onToggle(seat)}
      disabled={isTaken}
      title={`Seat ${seat.seatNumber}`}
      className={`w-10 h-11 rounded-t-xl rounded-b-md border-2 text-[11px] font-bold
                  transition-all duration-150 active:scale-95 relative
        ${isTaken
          ? "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
          : isSelected
          ? "bg-brand border-brand text-white shadow-lg shadow-brand/40 scale-105"
          : "bg-white border-gray-200 text-gray-500 hover:border-brand hover:text-brand hover:shadow-md"
        }`}
    >
      {seat.seatNumber}
      <span className={`absolute bottom-0 left-1 right-1 h-1 rounded-full ${
        isTaken ? "bg-gray-200" : isSelected ? "bg-brand-dark" : "bg-gray-200"
      }`} />
    </button>
  );
}

export default function SeatsPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

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
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  );

  const rows = buildLayout(seats);
  const available = seats.filter((s) => s.status === "AVAILABLE").length;

  return (
    <div className="max-w-sm mx-auto px-4 py-8 pb-32 fade-up">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand mb-5 transition-colors">
        ← Back
      </button>

      <h2 className="text-xl font-extrabold text-gray-900 mb-1">Pick Your Seats</h2>
      <p className="text-sm text-gray-400 mb-5">{available} seats available</p>

      {/* Legend */}
      <div className="flex gap-4 text-xs mb-5">
        {[
          { cls: "bg-white border-gray-200", label: "Available" },
          { cls: "bg-brand border-brand",    label: "Selected"  },
          { cls: "bg-gray-100 border-gray-200", label: "Taken"  },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-5 h-6 rounded-t-lg rounded-b-sm border-2 ${cls}`} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Bus shell */}
      <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl overflow-hidden">

        {/* Front header: Driver | Aisle | Front door */}
        <div className="bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="bg-white/20 rounded-lg px-2 py-1 text-center text-white text-xs font-semibold">
            Driver
          </div>
          <div className="text-white/50 text-xs font-medium px-1">Aisle</div>
          <div className="bg-white/20 rounded-lg px-2 py-1 text-center text-white text-xs font-semibold">
            Front door
          </div>
        </div>

        {/* Seat rows */}
        <div className="p-3 space-y-1.5">
          {rows.map((row, ri) => (
            <div key={ri} className="flex items-center justify-center gap-1.5">

              {row.type === "back" && (
                row.seats.map((seat, si) => (
                  <SeatBtn key={si} seat={seat} selected={selected} onToggle={toggle} />
                ))
              )}

              {(row.type === "normal" || row.type === "door") && (
                <>
                  {/* Left 2 seats */}
                  {row.left.map((seat, si) => (
                    <SeatBtn key={si} seat={seat} selected={selected} onToggle={toggle} />
                  ))}

                  {/* Aisle */}
                  <div className="w-6" />

                  {/* Right: seats or mini door */}
                  {row.type === "door" ? (
                    <div className="flex gap-1.5">
                      <div className="w-10 h-11 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-center">
                        <span className="text-[9px] text-amber-500 font-semibold text-center leading-tight">Mini<br/>door</span>
                      </div>
                      {/* spacer to keep alignment */}
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

        {/* Rear */}
        <div className="bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-300 py-2 font-medium tracking-widest uppercase">
          Rear
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 py-4 z-40">
        <div className="max-w-sm mx-auto flex items-center justify-between gap-4">
          <div>
            {selected.length === 0 ? (
              <p className="text-sm text-gray-400">Tap seats to select</p>
            ) : (
              <>
                <p className="text-xs text-gray-400">{selected.length} seat{selected.length !== 1 ? "s" : ""} selected</p>
                <p className="font-extrabold text-brand text-base leading-tight">
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
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Reserving…
              </span>
            ) : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
