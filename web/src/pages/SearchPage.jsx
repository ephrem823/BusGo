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

  const fillPopular = (p) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="min-h-[calc(100vh-64px)] relative overflow-hidden flex flex-col items-center justify-center px-4 py-12">

      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl fade-up">

        {/* Hero text */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            🇪🇹 Ethiopia's Bus Network
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-3">
            Travel Smarter,<br />
            <span className="bg-gradient-to-r from-brand to-blue-500 bg-clip-text text-transparent">
              Book Faster
            </span>
          </h1>
          <p className="text-gray-500 text-lg">Find and book bus tickets across Ethiopia in seconds.</p>
        </div>

        {/* Search card */}
        <div className="glass p-6 shadow-xl shadow-brand/10">
          <form onSubmit={handleSearch} className="space-y-4">

            {/* From / To with swap */}
            <div className="relative flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
                <select className="input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required>
                  <option value="">Select city</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Swap button */}
              <button
                type="button"
                onClick={swap}
                className="mb-0.5 w-10 h-10 flex-shrink-0 rounded-xl border-2 border-gray-200 bg-white hover:border-brand hover:text-brand transition-all flex items-center justify-center text-gray-400 hover:rotate-180 duration-300"
              >
                ⇄
              </button>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
                <select className="input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required>
                  <option value="">Select city</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Travel Date</label>
              <input type="date" className="input" min={today} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-sm">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Searching…
                </span>
              ) : "🔍 Search Buses"}
            </button>
          </form>
        </div>

        {/* Popular routes */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-3">Popular Routes</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {POPULAR.map((p) => (
              <button
                key={p.to}
                onClick={() => fillPopular(p)}
                className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-brand hover:text-brand transition-all shadow-sm hover:shadow-md"
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
