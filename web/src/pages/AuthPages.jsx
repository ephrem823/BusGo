import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../api/AuthContext";

function PhoneStep({ onSent }) {
  const [phone, setPhone] = useState("");
  const [name, setName]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.sendOtp({ phone, name: name || undefined });
      onSent(phone, name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Your Name
        </label>
        <input
          className="input"
          placeholder="Abebe Kebede"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank if you already have an account</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Phone Number
        </label>
        <div className="flex gap-2">
          <div className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium flex-shrink-0">
            🇪🇹 +251
          </div>
          <input
            className="input"
            type="tel"
            placeholder="9xx xxx xxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-2.5 text-sm">
          ⚠️ {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
        {loading ? <Spinner text="Sending code…" /> : "Send Verification Code →"}
      </button>
    </form>
  );
}

function OtpStep({ phone, name, onBack }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [otp, setOtp]       = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [resending, setResending] = useState(false);
  const inputs = useRef([]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.verifyOtp({ phone, otp: code, name: name || undefined });
      login(res.token, res.user);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await api.sendOtp({ phone, name: name || undefined });
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-2xl mx-auto mb-3">
          📱
        </div>
        <p className="text-sm text-gray-500">
          We sent a 6-digit code to
        </p>
        <p className="font-bold text-gray-900">+251 {phone.replace(/^0/, "")}</p>
      </div>

      {/* OTP boxes */}
      <div className="flex gap-2 justify-center" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            type="tel"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
              ${digit ? "border-brand bg-brand/5 text-brand" : "border-gray-200 bg-white text-gray-900"}
              focus:border-brand focus:ring-2 focus:ring-brand/20`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-2.5 text-sm text-center">
          ⚠️ {error}
        </div>
      )}

      <button
        className="btn-primary w-full py-3 text-base"
        onClick={handleVerify}
        disabled={loading || otp.join("").length < 6}
      >
        {loading ? <Spinner text="Verifying…" /> : "Verify & Continue"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          ← Change number
        </button>
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-brand hover:underline font-medium disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

function Spinner({ text }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      {text}
    </span>
  );
}

export function LoginPage() {
  const [step, setStep]   = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [name, setName]   = useState("");

  const handleSent = (ph, nm) => {
    setPhone(ph);
    setName(nm);
    setStep("otp");
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-brand/30">
            🚌
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">
            {step === "phone" ? "Sign in to BusGo" : "Enter your code"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {step === "phone" ? "Enter your phone number to continue" : "Check your SMS messages"}
          </p>
        </div>

        <div className="glass p-6 shadow-xl shadow-gray-200/50">
          {step === "phone"
            ? <PhoneStep onSent={handleSent} />
            : <OtpStep phone={phone} name={name} onBack={() => setStep("phone")} />
          }
        </div>

        {step === "phone" && (
          <p className="text-center text-xs text-gray-400 mt-4">
            New user? Just enter your name and phone — we'll create your account automatically.
          </p>
        )}
      </div>
    </div>
  );
}

// Register page now just redirects to login (same flow)
export function RegisterPage() {
  const navigate = useNavigate();
  useState(() => { navigate("/login", { replace: true }); }, []);
  return null;
}
