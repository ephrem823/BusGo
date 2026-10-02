import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import BiftuLogo from "./BiftuLogo";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate("/"); };

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        location.pathname === to
          ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
          : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="group-hover:scale-110 transition-transform duration-300">
            <BiftuLogo size={40} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">Biftu</span>
            <span className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">Bus</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              {navLink("/my-bookings", "My Trips")}
              {user.role === "ADMIN" && navLink("/admin", "Admin")}

              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow shadow-violet-500/30">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-300 font-medium hidden sm:block text-sm">
                  {user.name.split(" ")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-1 text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-primary text-sm py-2 px-4">
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
