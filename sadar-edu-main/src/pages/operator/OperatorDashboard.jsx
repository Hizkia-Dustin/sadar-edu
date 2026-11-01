import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import DatasetTab from "../../components/operator/DatasetTab";
import SekolahTab from "../../components/operator/SekolahTab";
import AnalisisTab from "../../components/operator/AnalisisTab";
import AkunTab from "../../components/operator/AkunTab";

const TABS = [
  { id: "dataset", label: "Dataset" },
  { id: "sekolah", label: "Data Sekolah" },
  { id: "analisis", label: "Analisis" },
  { id: "akun", label: "Akun" },
];

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState("dataset");
  // true bila data berubah sejak perhitungan analisis terakhir
  const [stale, setStale] = useState(false);

  const onChanged = (res) => {
    if (res && (res.perlu_hitung_ulang || (res.data && res.data.memengaruhi_analisis && !res.analisis))) setStale(true);
    if (res && res.analisis) setStale(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#1F6F5F]">Panel Operator Data</h1>
            <p className="text-xs text-slate-500">{user?.nama} · {user?.role}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/stakeholder/dashboard" className="text-[#1F6F5F] hover:underline">Dashboard analisis</Link>
            <Link to="/peta" className="text-slate-500 hover:text-slate-800">Peta publik</Link>
            <button onClick={() => { logout(); navigate("/login"); }} className="text-red-500 hover:text-red-700">Keluar</button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-6 flex gap-1" role="tablist" aria-label="Menu operator">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-[#1F6F5F] text-[#1F6F5F]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {t.label}
              {t.id === "analisis" && stale && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-500 align-middle" aria-label="perlu dihitung ulang" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {stale && tab !== "analisis" && (
          <div className="mb-4 flex items-center justify-between gap-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5">
            <span>Data berubah — skor prioritas belum mengikuti data terbaru.</span>
            <button onClick={() => setTab("analisis")} className="font-semibold underline">Hitung ulang</button>
          </div>
        )}
        {tab === "dataset" && <DatasetTab onChanged={onChanged} />}
        {tab === "sekolah" && <SekolahTab onChanged={onChanged} />}
        {tab === "analisis" && <AnalisisTab stale={stale} onDone={() => setStale(false)} />}
        {tab === "akun" && <AkunTab />}
      </main>
    </div>
  );
}
