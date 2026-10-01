import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-md shadow-brand/30 group-hover:scale-105 transition-transform">
            <span className="text-lg">🚌</span>
          </div>
          <span className="text-xl font-extrabold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">
            BusGo
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              <Link
                to="/my-bookings"
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  location.pathname === "/my-bookings"
                    ? "bg-brand/10 text-brand"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                My Trips
              </Link>
              {user.role === "ADMIN" && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    location.pathname === "/admin"
                      ? "bg-brand/10 text-brand"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Admin
                </Link>
              )}

              {/* Avatar */}
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand/80 to-brand-dark flex items-center justify-center text-white text-xs font-bold shadow">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-700 font-medium hidden sm:block">
                  {user.name.split(" ")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium transition-colors">
                Login
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
