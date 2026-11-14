import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, roleHome } from "../../store/useAuthStore";

/**
 * Melindungi rute berdasarkan role. Pemeriksaan ini hanya untuk UX;
 * keamanan sesungguhnya ditegakkan oleh backend (JWT + role pada setiap endpoint).
 */
export default function RequireRole({ roles, children }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!roles.map((r) => r.toLowerCase()).includes(String(user.role).toLowerCase())) {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return children;
}
