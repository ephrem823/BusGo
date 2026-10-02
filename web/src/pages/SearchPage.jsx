import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const CITIES = ["Addis Ababa", "Hawassa", "Bahir Dar", "Dire Dawa", "Mekelle", "Gondar", "Jimma"];
const POPULAR = [
  { from: "Addis Ababa", to: "Hawassa" },
  { from: "Addis Ababa", to: "Bahir Dar" },
  { from: "Addis Ababa", to: "Dire Dawa" },
];

export default function SearchPage() {
  const [form, setForm] = useState({ from: "", to: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const swap = () => setForm((f) => ({ ...f, from: f.to, to: f.from }));

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    if (form.from === form.to) return setError("Origin and destination must be different.");
    setLoading(true);
    try {
      const routes = await api.searchRoutes(form.from, form.to);
      if (!routes.length) return setError("No routes found for that destination.");
      navigate(`/results?routeId=${routes[0].id}&date=${form.date}&from=${form.from}&to=${form.to}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] relative overflow-hidden flex flex-col items-center justify-center px-4 py-12">

      {/* Neon background blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-800/10 rounded-full blur-[80px]" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="w-full max-w-xl fade-up">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
            🇪🇹 Biftu Bus — Ethiopia
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
            Travel Smarter,<br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Book Faster
            </span>
          </h1>
          <p className="text-gray-400 text-lg">Find and book bus tickets across Ethiopia in seconds.</p>
        </div>

        {/* Search card */}
        <div className="glass p-6 shadow-2xl shadow-violet-500/10 border border-white/10">
          <form onSubmit={handleSearch} className="space-y-4">

            <div className="relative flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From</label>
                <select className="input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required>
                  <option value="">Select city</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <button
                type="button"
                onClick={swap}
                className="mb-0.5 w-10 h-10 flex-shrink-0 rounded-xl border border-white/10 bg-white/5 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/10 transition-all flex items-center justify-center text-gray-500 hover:rotate-180 duration-300"
              >
                ⇄
              </button>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
                <select className="input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required>
                  <option value="">Select city</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Travel Date</label>
              <input type="date" className="input" min={today} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching…
                </span>
              ) : "🔍 Search Buses"}
            </button>
          </form>
        </div>

        {/* Popular routes */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center mb-3">Popular Routes</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {POPULAR.map((p) => (
              <button
                key={p.to}
                onClick={() => setForm((f) => ({ ...f, ...p }))}
                className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-sm text-gray-400 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
              >
                {p.from} → {p.to}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
