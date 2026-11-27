import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ChevronDown, Layers, PanelLeftClose, PanelLeftOpen, RotateCcw, Users } from "lucide-react";
import TanyaWilayah from "../../components/stakeholder/TanyaWilayah";
import { schoolPinLegend } from "../../components/map/schoolPins";
import "./stakeholder.css";
import MapCanvas from "../../components/map/MapCanvas";
import PrioritasPanel from "../../components/stakeholder/PrioritasPanel";
import DiagnosisPanel from "../../components/stakeholder/DiagnosisPanel";
import SekolahKeputusanPanel from "../../components/stakeholder/SekolahKeputusanPanel";
import KandidatPanel from "../../components/stakeholder/KandidatPanel";
import SimulasiPanel from "../../components/stakeholder/SimulasiPanel";
import CompareModal from "../../components/ui/CompareModal";
import { ErrorBox, InfoBox, Spinner } from "../../components/ui/kit";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";
import { BOGOR_BOUNDS } from "../../lib/bogorBoundary";
import { api } from "../../lib/api";
import { POPULATION_BANDS } from "../../lib/population";

const TABS = [
  { id: "prioritas", label: "Prioritas" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "keputusan", label: "Keputusan" },
  { id: "simulasi", label: "Simulasi & Lahan" },
];

const OVERLAY_TOGGLES = [
  ["showSchools", "Titik sekolah", "Marker lokasi SMP Negeri & Swasta"],
  ["showBlankSpots", "Blank spot (>3 km)", "Area di luar jangkauan layanan 3 km"],
  ["showCoverage", "Jangkauan 3 km", "Radius layanan di sekitar titik sekolah"],
  ["showCandidates", "Area kandidat lahan", "Tapak potensial pembangunan USB"],
  ["show3DBuildings", "Bangunan 3D", "Bentuk bangunan saat peta diperbesar"],
];

const EMPTY_POPULATION = { type: "FeatureCollection", features: [] };

export default function StakeholderDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { loaded, loading, error, loadPublic, loadCandidates, meta, ringkasan, kecamatan, candidates } = useDataStore();
  const {
    selectedWilayahId,
    setSelectedWilayahId,
    highlightedWilayahIds,
    setHighlightedWilayahIds,
    clearSelection,
    flyToBounds,
    activeLayers,
    toggleLayer,
    setLayer,
    setChoroplethMode,
    comparedSchools,
    setIsCompareOpen,
  } = useMapStore();
  const [tab, setTab] = useState("prioritas");
  const [simSubTab, setSimSubTab] = useState("simulasi"); // "simulasi" | "kandidat"
  const [preset, setPreset] = useState(null);
  const [candidateError, setCandidateError] = useState("");
  const [population, setPopulation] = useState(EMPTY_POPULATION);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const layersMenuRef = useRef(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const chatButton = useRef(null);
  const closeChat = () => {
    setChatOpen(false);
    requestAnimationFrame(() => chatButton.current?.focus());
  };
  const selectedKecamatan = kecamatan.find((x) => x.id === String(selectedWilayahId));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadPublic();
      try {
        if (!cancelled) await loadCandidates();
      } catch (e) {
        if (!cancelled) setCandidateError(e.message);
      }
      try {
        const popRes = await api.get("/analisis/penduduk", { version: "big-2022-topology-1" });
        if (!cancelled && popRes?.data) setPopulation(popRes.data);
      } catch {
        // Layer penduduk opsional; tidak menghalangi dashboard utama.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPublic, loadCandidates]);

  useEffect(() => {
    if (!layersMenuOpen) return undefined;
    const onPointerDown = (evt) => {
      if (layersMenuRef.current && !layersMenuRef.current.contains(evt.target)) {
        setLayersMenuOpen(false);
      }
    };
    const onKeyDown = (evt) => {
      if (evt.key === "Escape") setLayersMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [layersMenuOpen]);

  // Sinkronisasi klik poligon / kandidat pada peta ke tab aktif
  useEffect(() => {
    let prevWilayah = useMapStore.getState().selectedWilayahId;
    let prevCandidate = useMapStore.getState().selectedCandidateId;
    return useMapStore.subscribe((state) => {
      if (state.selectedWilayahId !== prevWilayah) {
        prevWilayah = state.selectedWilayahId;
        if (state.selectedWilayahId) {
          setPanelOpen(true);
          setTab((curr) => (curr === "prioritas" ? "diagnosis" : curr));
        }
      }
      if (state.selectedCandidateId !== prevCandidate) {
        prevCandidate = state.selectedCandidateId;
        if (state.selectedCandidateId) {
          setPanelOpen(true);
          setTab("simulasi");
          setSimSubTab("kandidat");
        }
      }
    });
  }, []);

  const pilihWilayah = useCallback(
    (id) => {
      if (!id || id === "all") {
        clearSelection();
        return;
      }
      setSelectedWilayahId(id);
      const k = useDataStore.getState().kecamatan.find((x) => String(x.id) === String(id));
      if (k && k.bbox) flyToBounds(k.bbox);
    },
    [setSelectedWilayahId, flyToBounds, clearSelection]
  );

  const keSimulasi = useCallback(
    (p) => {
      if (p.id_wilayah) setSelectedWilayahId(p.id_wilayah);
      setPreset({ ...p, nonce: Date.now() });
      setPanelOpen(true);
      setSimSubTab("simulasi");
      setTab("simulasi");
    },
    [setSelectedWilayahId]
  );

  const highlightDariChat = useCallback(
    (payload, legacyLayer) => {
      const opts =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload
          : { wilayahId: payload, layers: legacyLayer ? [legacyLayer] : [] };

      const { wilayahId, highlightIds, layers = [], layer, action, tipe, jumlah, focusPanel = false } = opts;
      const allLayers = [...(Array.isArray(layers) ? layers : []), ...(layer ? [layer] : [])];
      allLayers.forEach((l) => {
        if (l) setLayer(l, true);
      });

      const listKec = useDataStore.getState().kecamatan;

      if (action === "simulate" && wilayahId != null) {
        setLayer("mcdaLayer", true);
        setHighlightedWilayahIds([wilayahId]);
        const target = listKec.find((x) => String(x.id) === String(wilayahId));
        if (target?.bbox) flyToBounds(target.bbox);
        keSimulasi({ id_wilayah: wilayahId, tipe: tipe || "Sekolah Baru", jumlah: jumlah || 1 });
        return;
      }

      const ids = Array.isArray(highlightIds) && highlightIds.length > 0
        ? highlightIds.map(String)
        : wilayahId != null
          ? [String(wilayahId)]
          : [];

      if (ids.length > 0) {
        setLayer("mcdaLayer", true);
        setHighlightedWilayahIds(ids);

        if (focusPanel && wilayahId != null) {
          setSelectedWilayahId(wilayahId);
          const target = listKec.find((x) => String(x.id) === String(wilayahId));
          if (target?.bbox) flyToBounds(target.bbox);
        } else {
          // Multi-kecamatan: lepaskan seleksi tunggal agar seluruh wilayah yang disorot menyala serentak
          if (ids.length > 1) {
            setSelectedWilayahId(null);
          }
          const matched = listKec.filter((x) => ids.includes(String(x.id)) && Array.isArray(x.bbox));
          if (matched.length === 1) {
            flyToBounds(matched[0].bbox);
          } else if (matched.length > 1) {
            const combined = [
              Math.min(...matched.map((m) => m.bbox[0])),
              Math.min(...matched.map((m) => m.bbox[1])),
              Math.max(...matched.map((m) => m.bbox[2])),
              Math.max(...matched.map((m) => m.bbox[3])),
            ];
            flyToBounds(combined);
          }
        }
      }
    },
    [setSelectedWilayahId, setHighlightedWilayahIds, flyToBounds, setLayer, keSimulasi]
  );

  const resetPetaBogor = useCallback(() => {
    clearSelection();
    const flat = BOGOR_BOUNDS.flat();
    flyToBounds(flat);
  }, [clearSelection, flyToBounds]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handlePopulationDistrictSelect = useCallback(
    (_popId, popName) => {
      if (!popName) return;
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = useDataStore
        .getState()
        .kecamatan.find((k) => norm(k.name) === norm(popName));
      if (target) {
        pilihWilayah(target.id);
        setPanelOpen(true);
        setTab("diagnosis");
      }
    },
    [pilihWilayah]
  );

  const activeOverlayCount = OVERLAY_TOGGLES.filter(([key]) => Boolean(activeLayers[key])).length;

  return (
    <div className={`sh-workspace ${panelOpen ? "panel-open" : "panel-closed"}`}>
      {/* Peta selalu full-screen di latar belakang agar tidak pernah menyisakan ruang kosong saat panel ditutup */}
      <main className="sh-map-stage">
        <MapCanvas
          population={population}
          onDistrictSelect={handlePopulationDistrictSelect}
        />
      </main>

      {/* Navigasi Mengambang Kiri Atas */}
      <header className="sh-floating-header">
        <div className="sh-brand">
          <div>
            <h1 className="sh-brand-title">Dinas Pendidikan Bogor</h1>
            <p className="sh-brand-sub">
              {user?.nama || "Stakeholder"}
              {meta ? ` · Data ${meta.tahun}` : ""}
            </p>
          </div>
        </div>
        <nav className="sh-header-actions" aria-label="Kontrol utama">
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className={`sh-pill-btn ${panelOpen ? "is-primary" : ""}`}
            aria-expanded={panelOpen}
          >
            {panelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            <span>{panelOpen ? "Tutup Panel" : "Buka Panel"}</span>
          </button>
          {user?.role === "Operator" && (
            <Link to="/operator/dataset" className="sh-pill-btn">
              Dataset
            </Link>
          )}
          <Link to="/peta" className="sh-pill-btn">
            Peta Publik
          </Link>
          <button onClick={handleLogout} className="sh-pill-btn is-danger">
            Keluar
          </button>
        </nav>
      </header>

      {/* Kontrol Lapisan Peta Mengambang Kanan Atas: Mode Warna (Kebutuhan | Penduduk) + Popover Lapisan */}
      <div className="sh-floating-layers" ref={layersMenuRef}>
        <div className="sh-layer-group" role="group" aria-label="Kontrol peta analitis">
          <button
            onClick={resetPetaBogor}
            title="Reset tampilan peta ke seluruh wilayah Bogor"
            className="sh-layer-btn inline-flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <span className="sh-layer-divider" aria-hidden="true" />

          <button
            aria-pressed={!!activeLayers.mcdaLayer}
            onClick={() => setChoroplethMode(activeLayers.mcdaLayer ? "none" : "mcda")}
            className="sh-layer-btn"
            title="Pewarnaan tingkat kebutuhan layanan SMP (MCDA)"
          >
            Kebutuhan
          </button>
          <button
            aria-pressed={!!activeLayers.populationLayer}
            disabled={!population.features.length}
            onClick={() => setChoroplethMode(activeLayers.populationLayer ? "none" : "population")}
            className="sh-layer-btn inline-flex items-center gap-1.5"
            title="Pewarnaan total jumlah penduduk per kecamatan (BPS 2024)"
          >
            <Users size={13} />
            <span>Penduduk</span>
          </button>

          <span className="sh-layer-divider" aria-hidden="true" />

          <button
            type="button"
            aria-expanded={layersMenuOpen}
            aria-haspopup="menu"
            onClick={() => setLayersMenuOpen((open) => !open)}
            className={`sh-layer-btn inline-flex items-center gap-1.5 ${layersMenuOpen ? "is-menu-open" : ""}`}
          >
            <Layers size={13} />
            <span>Lapisan ({activeOverlayCount})</span>
            <ChevronDown size={13} />
          </button>
        </div>

        {layersMenuOpen && (
          <div className="sh-layers-popover" role="menu" aria-label="Lapisan overlay peta">
            <p className="sh-layers-popover-title">Lapisan Overlay</p>
            {OVERLAY_TOGGLES.map(([key, label, desc]) => (
              <label key={key} className="sh-layers-popover-item">
                <div>
                  <strong>{label}</strong>
                  <small>{desc}</small>
                </div>
                <input
                  type="checkbox"
                  checked={!!activeLayers[key]}
                  onChange={() => toggleLayer(key)}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Panel Analisis Mengambang */}
      <aside
        className={`sh-panel ${panelOpen ? "is-open" : "is-closed"}`}
        aria-label="Panel analisis keputusan"
        inert={!panelOpen}
      >
        <div className="sh-tabs" role="tablist" aria-label="Menu analisis">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="sh-tab"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="sh-content">
          {ringkasan?.menggunakan_data_demo && (
            <div className="mb-4">
              <InfoBox tone="amber">
                <strong>Data demo.</strong> Angka dan peta berasal dari dataset sintetis.
              </InfoBox>
            </div>
          )}

          <ErrorBox message={error || candidateError} />
          {error && (
            <button onClick={loadPublic} className="mt-2 text-xs font-semibold text-[#1F6F5F] hover:underline">
              Muat ulang data
            </button>
          )}
          {loading && !loaded && <Spinner label="Memuat data analisis wilayah & sekolah..." />}

          {loaded && tab === "prioritas" && (
            <PrioritasPanel
              ringkasan={ringkasan}
              onPilihWilayah={(id) => {
                pilihWilayah(id);
                setTab("diagnosis");
              }}
            />
          )}

          {loaded && tab === "diagnosis" && (
            <DiagnosisPanel wilayahId={selectedWilayahId} onPilihWilayah={pilihWilayah} onSimulasi={keSimulasi} onOpenChat={() => setChatOpen(true)} />
          )}

          {loaded && tab === "keputusan" && (
            <SekolahKeputusanPanel
              wilayahId={selectedWilayahId}
              onPilihWilayah={(id) => {
                pilihWilayah(id);
                setTab("diagnosis");
              }}
              onSimulasi={keSimulasi}
            />
          )}

          {loaded && tab === "simulasi" && (
            <div>
              <div className="sh-segmented mb-5" role="group" aria-label="Pilih mode simulasi atau kandidat lahan">
                <button
                  onClick={() => setSimSubTab("simulasi")}
                  className={simSubTab === "simulasi" ? "is-active" : ""}
                >
                  Simulasi Intervensi
                </button>
                <button
                  onClick={() => {
                    setSimSubTab("kandidat");
                    setLayer("showCandidates", true);
                  }}
                  className={simSubTab === "kandidat" ? "is-active" : ""}
                >
                  Kandidat Lahan ({candidates?.features?.length || 0})
                </button>
              </div>
              {simSubTab === "simulasi" ? (
                <SimulasiPanel
                  key={`${preset?.nonce || "init"}-${selectedWilayahId || ""}`}
                  preset={preset}
                  wilayahId={selectedWilayahId}
                />
              ) : (
                <KandidatPanel wilayahId={selectedWilayahId} onSimulasi={keSimulasi} />
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Legenda Ringkas di Bawah Peta */}
      <div className="sh-map-legend" aria-label="Legenda peta">
        {selectedKecamatan && (
          <div className="flex items-center gap-2 pr-3 border-r border-slate-300">
            <span className="font-semibold text-slate-900">
              Fokus: Kec. {selectedKecamatan.name}
            </span>
            <button
              onClick={resetPetaBogor}
              className="text-xs font-semibold text-[#1F6F5F] hover:underline"
            >
              Semua Kecamatan
            </button>
          </div>
        )}
        {!selectedKecamatan && highlightedWilayahIds.length > 0 && (
          <div className="flex items-center gap-2 pr-3 border-r border-slate-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
              Sorotan Analisis: {highlightedWilayahIds.length} Kec.
            </span>
            <button
              onClick={resetPetaBogor}
              className="text-xs font-semibold text-[#1F6F5F] hover:underline"
            >
              Reset
            </button>
          </div>
        )}
        {activeLayers.showSchools && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <img width="16" height="20" alt="" src={schoolPinLegend("negeri")} />
              SMP Negeri
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <img width="16" height="20" alt="" src={schoolPinLegend("swasta")} />
              SMP Swasta
            </span>
            {!selectedKecamatan && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1e293b] inline-block border border-white" />
                Klaster Sekolah
              </span>
            )}
          </div>
        )}
        {activeLayers.mcdaLayer && (
          <div className="flex items-center gap-2.5 border-l border-slate-300 pl-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#dc2626] inline-block" />
              Sangat Tinggi
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#f97316] inline-block" />
              Tinggi
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#eab308] inline-block" />
              Sedang
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" />
              Rendah
            </span>
          </div>
        )}
        {activeLayers.populationLayer && (
          <div className="flex items-center gap-2 border-l border-slate-300 pl-3 flex-wrap">
            <span className="font-semibold text-slate-700">Penduduk 2024:</span>
            {POPULATION_BANDS.map((band) => (
              <span key={band.min} className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs inline-block border border-slate-400/40" style={{ background: band.color }} />
                {band.label}
              </span>
            ))}
          </div>
        )}
        {comparedSchools.length > 0 && (
          <button
            onClick={() => setIsCompareOpen(true)}
            className="bg-[#1F6F5F] text-white font-semibold px-3 py-1 rounded-lg hover:bg-[#175649] transition-colors text-xs"
          >
            Bandingkan ({comparedSchools.length}/3)
          </button>
        )}
      </div>

      {kecamatan.length === 0 && loaded && (
        <div className="absolute top-20 right-4 z-10 max-w-xs">
          <InfoBox tone="amber">Belum ada batas kecamatan. Minta Operator mengunggah dataset wilayah.</InfoBox>
        </div>
      )}
      <button ref={chatButton} className="sh-chat-launch" hidden={chatOpen} type="button"
        aria-label="Buka chat asisten peta" title="Tanya asisten peta" aria-expanded={chatOpen}
        aria-controls="sh-chat" onClick={() => setChatOpen(true)}>
        <Bot size={27} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <TanyaWilayah
        open={chatOpen}
        onClose={closeChat}
        wilayah={selectedKecamatan}
        kecamatan={kecamatan}
        onSelect={pilihWilayah}
        onHighlight={highlightDariChat}
        tahun={meta?.tahun}
        demo={ringkasan?.menggunakan_data_demo}
        loading={loading}
        error={error}
      />
      <CompareModal />
    </div>
  );
}
