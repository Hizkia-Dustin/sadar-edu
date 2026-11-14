import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import MapCanvas from "../../components/map/MapCanvas";
import PrioritasPanel from "../../components/stakeholder/PrioritasPanel";
import DiagnosisPanel from "../../components/stakeholder/DiagnosisPanel";
import KandidatPanel from "../../components/stakeholder/KandidatPanel";
import SimulasiPanel from "../../components/stakeholder/SimulasiPanel";
import { ErrorBox, InfoBox, Spinner } from "../../components/ui/kit";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";

const TABS = [
  { id: "prioritas", label: "Prioritas" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "kandidat", label: "Kandidat" },
  { id: "simulasi", label: "Simulasi" },
];

const LAYER_TOGGLES = [
  ["mcdaLayer", "Kebutuhan kecamatan"],
  ["showBlankSpots", "Blank spot"],
  ["showCoverage", "Jangkauan sekolah"],
  ["showCandidates", "Area kandidat"],
  ["showSchools", "Sekolah"],
];

export default function StakeholderDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { loaded, loading, error, loadPublic, loadCandidates, meta, ringkasan, kecamatan } = useDataStore();
  const { selectedWilayahId, setSelectedWilayahId, selectedCandidateId, flyToBounds, activeLayers, toggleLayer } = useMapStore();
  const [tab, setTab] = useState("prioritas");
  const [preset, setPreset] = useState(null);
  const [candidateError, setCandidateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!useDataStore.getState().loaded) await loadPublic();
      try {
        if (!cancelled) await loadCandidates();
      } catch (e) {
        if (!cancelled) setCandidateError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [loadPublic, loadCandidates]);

  const pilihWilayah = useCallback(
    (id) => {
      setSelectedWilayahId(id);
      const k = useDataStore.getState().kecamatan.find((x) => x.id === String(id));
      if (k && k.bbox) flyToBounds(k.bbox);
    },
    [setSelectedWilayahId, flyToBounds]
  );

  // Klik poligon di peta -> buka tab diagnosis
  useEffect(() => {
    if (selectedWilayahId && tab === "prioritas") setTab("diagnosis");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWilayahId]);

  // Klik kandidat di peta -> buka tab kandidat
  useEffect(() => {
    if (selectedCandidateId) setTab("kandidat");
  }, [selectedCandidateId]);

  const keSimulasi = (p) => {
    setPreset({ ...p, nonce: Date.now() });
    setTab("simulasi");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans text-slate-800">
      <aside className="w-[420px] max-w-[92vw] bg-white border-r border-slate-200 flex flex-col z-20 shadow-md">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
          <div>
            <h1 className="font-bold text-[#1F6F5F] text-base">Dashboard Analisis</h1>
            <p className="text-xs text-slate-500">
              {user?.nama} · {user?.role}
              {meta ? ` · Data ${meta.tahun}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {user?.role === "Operator" && <Link to="/operator/dataset" className="text-[#1F6F5F] hover:underline font-medium">Data</Link>}
            <Link to="/peta" className="text-slate-500 hover:text-slate-800 font-medium">Peta publik</Link>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-700 font-medium">Keluar</button>
          </div>
        </div>

        {ringkasan && (
          <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200 text-center">
            {[
              ["Kecamatan", ringkasan.kecamatan],
              ["Sekolah", ringkasan.sekolah],
              ["Siswa", ringkasan.siswa],
              ["Kurang kursi", ringkasan.gap_kursi],
            ].map(([k, v]) => (
              <div key={k} className="bg-white py-2">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{Number(v || 0).toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-slate-400">{k}</p>
              </div>
            ))}
          </div>
        )}

        {ringkasan?.menggunakan_data_demo && (
          <div className="px-4 pt-3">
            <InfoBox tone="amber"><strong>Data demo.</strong> Angka dan peta berasal dari dataset sintetis, bukan data resmi. Jangan dipakai untuk keputusan.</InfoBox>
          </div>
        )}

        <div className="px-4 pt-3" role="tablist" aria-label="Menu analisis">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === t.id ? "bg-white text-[#1F6F5F] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <ErrorBox message={error || candidateError} />
          {error && (
            <button onClick={loadPublic} className="mt-2 text-xs font-semibold text-[#1F6F5F] hover:underline">Coba lagi</button>
          )}
          {loading && !loaded && <Spinner label="Memuat data analisis..." />}
          {loaded && tab === "prioritas" && <PrioritasPanel onPilihWilayah={pilihWilayah} />}
          {loaded && tab === "diagnosis" && <DiagnosisPanel wilayahId={selectedWilayahId} onSimulasi={keSimulasi} />}
          {loaded && tab === "kandidat" && <KandidatPanel wilayahId={selectedWilayahId} onSimulasi={keSimulasi} />}
          {loaded && tab === "simulasi" && <SimulasiPanel preset={preset} wilayahId={selectedWilayahId} />}
        </div>

        <p className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">
          SADAR Edu menyediakan bukti dan alternatif sebagai bahan pertimbangan; keputusan resmi tetap pada pemerintah.
        </p>
      </aside>

      <main className="flex-1 relative h-full">
        <MapCanvas />
        <div className="absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-1.5 max-w-[60%]">
          {LAYER_TOGGLES.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={!!activeLayers[key]}
              onClick={() => toggleLayer(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border shadow-sm backdrop-blur-md transition-colors ${
                activeLayers[key] ? "bg-[#1F6F5F] text-white border-[#1F6F5F]" : "bg-white/95 text-slate-600 border-slate-200 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {kecamatan.length === 0 && loaded && (
          <div className="absolute top-20 right-4 z-10 max-w-xs"><InfoBox tone="amber">Belum ada batas kecamatan. Minta Operator mengunggah dataset wilayah.</InfoBox></div>
        )}
      </main>
    </div>
  );
}
