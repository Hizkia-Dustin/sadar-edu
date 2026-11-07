import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

const IntroPage = lazy(() => import("./pages/IntroPage"));
const LandingPage = lazy(() => import("./pages/HomePage"));
const Login = lazy(() => import("./pages/auth/Login"));
const StakeholderDashboard = lazy(() => import("./pages/stakeholder/StakeholderDashboard"));
const OperatorDashboard = lazy(() => import("./pages/operator/OperatorDashboard"));
const EksplorasiPeta = lazy(() => import("./pages/public/EksplorasiPeta"));
import RequireRole from "./components/auth/RequireRole";

const AwwwardsLoader = lazy(() => import("./components/ui/AwwwardsLoader"));
const PageTransition = lazy(() => import("./components/ui/PageTransition"));

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isMapPage = /^\/peta\/?$/.test(pathname);
  // Halaman peta langsung menampilkan UI tanpa intro video.
  const [isInitialLoading, setIsInitialLoading] = useState(() => !isMapPage);

  return (
    <>
      {!isMapPage && <Suspense fallback={null}>
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
        </Suspense>
      </div>
    </>
  );
}
