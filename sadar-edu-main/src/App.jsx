import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Import Halaman
import IntroPage from "./pages/IntroPage";
import LandingPage from "./pages/HomePage";
import Login from "./pages/auth/Login";
import StakeholderDashboard from "./pages/stakeholder/StakeholderDashboard";
import OperatorDashboard from "./pages/operator/OperatorDashboard";
import EksplorasiPeta from "./pages/public/EksplorasiPeta";
import RequireRole from "./components/auth/RequireRole";

// Import Komponen Loader & Transisi
import AwwwardsLoader from "./components/ui/AwwwardsLoader";
import PageTransition from "./components/ui/PageTransition";

// --- ROUTER UTAMA ---
export default function App() {
  // AwwwardsLoader aktif saat pertama kali masuk website dan saat refresh page
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  return (
    <BrowserRouter>
      {/* 1. SAAT REFRESH PAGE & MASUK WEBSITE: Awwwards Loading Screen (0-100%, 3D Float, Logo Motion) */}
      {isInitialLoading && (
        <AwwwardsLoader onComplete={() => setIsInitialLoading(false)} />
      )}

      {/* 2. SAAT PINDAH-PINDAH PAGE (LANDING <-> PETA): Page Transition bergaya inspirasi user (AKSES KOTA Style) */}
      <PageTransition />

      <div className="w-full min-h-screen bg-[#F8FAFC] font-sans text-slate-800 antialiased">
        <Routes>
          {/* PAGE INTRO KHUSUS (GAYA INSPIRASI USER: AKSES KOTA) */}
          <Route path="/intro" element={<IntroPage />} />

          {/* LANDING PAGE UTAMA */}
          <Route path="/" element={<LandingPage />} />

          {/* FLOW WARGA - PETA INTERAKTIF */}
          <Route path="/peta" element={<EksplorasiPeta />} />

          {/* FLOW AUTENTIKASI */}
          <Route path="/login" element={<Login />} />

          {/* FLOW STAKEHOLDER */}
          <Route path="/stakeholder">
            <Route
              index
              element={<Navigate to="/stakeholder/dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <RequireRole roles={["Stakeholder", "Operator"]}>
                  <StakeholderDashboard />
                </RequireRole>
              }
            />
          </Route>

          {/* FLOW OPERATOR */}
          <Route path="/operator">
            <Route
              index
              element={<Navigate to="/operator/dataset" replace />}
            />
            <Route
              path="dataset"
              element={
                <RequireRole roles={["Operator"]}>
                  <OperatorDashboard />
                </RequireRole>
              }
            />
          </Route>

          {/* FALLBACK 404 */}
          <Route
            path="*"
            element={
              <div className="p-10 text-center">
                404 - Halaman Tidak Ditemukan
              </div>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
