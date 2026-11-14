import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

// Import Halaman
import IntroPage from "./pages/IntroPage";
import LandingPage from "./pages/HomePage";
import Login from "./pages/auth/Login";
import StakeholderDashboard from "./pages/stakeholder/StakeholderDashboard";
import OperatorDashboard from "./pages/operator/OperatorDashboard";
import OperatorLogin from "./pages/operator/OperatorLogin";
import EksplorasiPeta from "./pages/public/EksplorasiPeta";
import OperatorImport from "./pages/operator/OperatorImport";
import OperatorValidation from "./pages/operator/OperatorValidation";
import OperatorRepair from "./pages/operator/OperatorRepair";
import OperatorReview from "./pages/operator/OperatorReview";
import OperatorStatus from "./pages/operator/OperatorStatus";
import OperatorIndicator from "./pages/operator/OperatorIndicator";



// Import Komponen Loader & Transisi
import AwwwardsLoader from "./components/ui/AwwwardsLoader";
import PageTransition from "./components/ui/PageTransition";
import OperatorLayout from "./components/operator/OperatorLayout";
import OperatorDataset from "./pages/operator/OperatorDataset";

// Halaman setelah login operator (tanpa halaman login) dianggap satu ruang kerja.
const inWorkspace = (path) =>
  path.startsWith("/operator") && !path.startsWith("/operator/login");

// Transisi tetap jalan saat masuk dan keluar operator, tapi tidak saat
// pindah menu di dalam ruang kerja operator.
function GlobalTransition() {
  const location = useLocation();
  const [shown, setShown] = useState(location);

  if (
    shown !== location &&
    !(inWorkspace(shown.pathname) && inWorkspace(location.pathname))
  ) {
    setShown(location);
  }

  return (
    <Routes location={shown}>
      <Route path="*" element={<PageTransition />} />
    </Routes>
  );
}

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
      <GlobalTransition />

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
            <Route path="dashboard" element={<StakeholderDashboard />} />
          </Route>

          {/* FLOW OPERATOR */}
          <Route path="/operator/login" element={<OperatorLogin />} />
          <Route path="/operator" element={<OperatorLayout />}>
            <Route index element={<Navigate to="/operator/dashboard" replace />} />
            <Route path="dashboard" element={<OperatorDashboard />} />
            <Route path="dataset" element={<OperatorDataset />} />
            <Route path="dataset/impor" element={<OperatorImport />} />
            <Route path="validasi" element={<OperatorValidation />} />
            <Route path="validasi/perbaikan" element={<OperatorRepair />} />
            <Route path="pengajuan" element={<OperatorReview />} />
            <Route path="status" element={<OperatorStatus />} />
            <Route path="indikator" element={<OperatorIndicator />} />
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
