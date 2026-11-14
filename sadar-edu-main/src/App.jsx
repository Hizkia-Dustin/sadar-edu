import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

const IntroPage = lazy(() => import("./pages/IntroPage"));
const LandingPage = lazy(() => import("./pages/HomePage"));
const Login = lazy(() => import("./pages/auth/Login"));
const StakeholderDashboard = lazy(() => import("./pages/stakeholder/StakeholderDashboard"));
const EksplorasiPeta = lazy(() => import("./pages/public/EksplorasiPeta"));
import RequireRole from "./components/auth/RequireRole";

// Halaman & Komponen Alur Operator
const OperatorLayout = lazy(() => import("./components/operator/OperatorLayout"));
const OperatorDashboard = lazy(() => import("./pages/operator/OperatorDashboard"));
const OperatorDataset = lazy(() => import("./pages/operator/OperatorDataset"));
const OperatorImport = lazy(() => import("./pages/operator/OperatorImport"));
const OperatorValidation = lazy(() => import("./pages/operator/OperatorValidation"));
const OperatorRepair = lazy(() => import("./pages/operator/OperatorRepair"));
const OperatorReview = lazy(() => import("./pages/operator/OperatorReview"));
const OperatorStatus = lazy(() => import("./pages/operator/OperatorStatus"));
const OperatorIndicator = lazy(() => import("./pages/operator/OperatorIndicator"));

const AwwwardsLoader = lazy(() => import("./components/ui/AwwwardsLoader"));
const PageTransition = lazy(() => import("./components/ui/PageTransition"));

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isDirectPage = /^\/(peta|login)\/?$/.test(pathname) || /^\/operator(?:\/|$)/.test(pathname);
  // Peta dan autentikasi harus langsung siap digunakan tanpa intro video.
  const [isInitialLoading, setIsInitialLoading] = useState(() => !isDirectPage);

  return (
    <>
      {!isDirectPage && <Suspense fallback={null}>
        {isInitialLoading && <AwwwardsLoader onComplete={() => setIsInitialLoading(false)} />}
        <PageTransition />
      </Suspense>}

      <div className="w-full min-h-screen bg-[#F8FAFC] font-sans text-slate-800 antialiased">
        <Suspense fallback={<div className="p-6 text-sm text-slate-600" role="status">Memuat halaman...</div>}>
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

          {/* FLOW OPERATOR (RUTE RUANG KERJA & ALUR AUDIT DATASET) */}
          {/* URL lama tetap bekerja, tetapi seluruh peran memakai satu formulir autentikasi. */}
          <Route path="/operator/login" element={<Navigate to="/login" replace />} />
          <Route path="/operator" element={<OperatorLayout />}>
            <Route index element={<Navigate to="/operator/dashboard" replace />} />
            <Route path="dashboard" element={<OperatorDashboard />} />
            <Route path="dataset" element={<OperatorDataset />} />
            <Route path="dataset/impor" element={<OperatorImport />} />
            <Route path="validasi" element={<OperatorValidation />} />
            <Route path="validasi/perbaikan" element={<OperatorRepair />} />
            <Route path="pengajuan" element={<OperatorReview />} />
            <Route path="pengajuan/status" element={<OperatorStatus />} />
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
        </Suspense>
      </div>
    </>
  );
}
