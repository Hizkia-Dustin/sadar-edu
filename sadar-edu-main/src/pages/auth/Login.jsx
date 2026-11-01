import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, roleHome } from "../../store/useAuthStore";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) return <Navigate to={roleHome(user.role)} replace />;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      const from = location.state && location.state.from;
      const home = roleHome(u.role);
      // Kembali ke halaman semula hanya bila role boleh mengaksesnya
      const allowed = from && (from.startsWith("/stakeholder") || (from.startsWith("/operator") && home.startsWith("/operator")));
      navigate(allowed ? from : home, { replace: true });
    } catch (err) {
      setError(err.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1F6F5F]">SADAR EDU</h1>
          <p className="text-xs text-slate-500 mt-1">Sistem Analisis Distribusi & Aksesibilitas Ruang Edukasi</p>
          <p className="text-xs text-slate-400 mt-3">Masuk untuk Stakeholder / Dinas dan Operator Data</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1">Kata sandi</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 bg-[#1F6F5F] hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-lg text-sm shadow transition-colors"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/peta" className="text-xs text-[#1F6F5F] hover:underline">← Kembali ke Eksplorasi Warga</Link>
        </div>
      </div>
    </div>
  );
}
