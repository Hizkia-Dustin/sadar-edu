import { useShallow } from "zustand/react/shallow";
import "./explorer.css";
import schoolIllustration from "../../assets/figma/school-hero.png";
import { useState, useMemo, useEffect, useRef, useLayoutEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Layers,
  Building2,
  GraduationCap,
  X,
  School,
  CheckCircle2,
  Maximize2,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
const MapCanvas = lazy(() => import("../../components/map/MapCanvas"));
import CompareModal from "../../components/ui/CompareModal";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { api } from "../../lib/api";
import { colorOf, rasio, mapSchoolFeature, fmt as fmtNum } from "../../lib/analysis";
import { KategoriBadge } from "../../components/ui/kit";
import { isInBogor, isInBoundary } from "../../lib/bogorBoundary";
import { POPULATION_BANDS } from "../../lib/population";
import { useBogorLayers } from "../../hooks/useBogorLayers";





/** Kondisi layanan wilayah + alternatif sekolah terdekat untuk satu sekolah (diambil dari API) */
function SchoolExtra({ school, onOpen }) {
  const id = school.properties.id;
  const [state, setState] = useState({ loading: true, detail: null, alt: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/sekolah/${id}`), api.get(`/sekolah/${id}/alternatif`, { limit: 4, radius_km: 6 })])
      .then(([d, a]) => !cancelled && setState({ loading: false, detail: d.data, alt: a.data.features.filter((f) => isInBogor(f.geometry?.coordinates)), error: "" }))
      .catch((e) => !cancelled && setState({ loading: false, detail: null, alt: [], error: e.message }));
    return () => { cancelled = true; };
  }, [id]);

  if (state.loading) return <p className="text-xs text-slate-400 text-center py-2" role="status">Memuat kondisi wilayah & alternatif sekolah...</p>;
  if (state.error) return <p className="text-xs text-slate-400 text-center py-2">{state.error}</p>;

  const k = state.detail && state.detail.kondisi_wilayah;
  return (
    <>
      {k && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kondisi Layanan di Wilayah Ini</h4>
            <KategoriBadge kategori={k.kategori_prioritas} />
          </div>
          {k.diagnosis && <p className="text-xs text-slate-600 leading-relaxed">{k.diagnosis}</p>}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Alternatif Sekolah Terdekat</h4>
        {state.alt.length === 0 ? (
          <p className="text-xs text-slate-400">Tidak ada sekolah lain dalam radius 6 km.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.alt.map((f) => (
              <li key={f.properties.id_sekolah} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{f.properties.nama_sekolah}</p>
                  <p className="text-[11px] text-slate-400">
                    {f.properties.status_sekolah} • {fmtNum(f.properties.jarak_km, 1)} km • {fmtNum(f.properties.jumlah_siswa)} siswa
                  </p>
                </div>
                <button onClick={() => onOpen(f)} className="text-[11px] font-semibold text-[#1F6F5F] hover:underline whitespace-nowrap">Lihat</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SchoolDetail({ school, onBack, onClose, onFocus, onCompare, compared, compareFull, onOpen }) {
  const headingRef = useRef(null);
  const p = school.properties;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="explorer-detail" aria-label="Detail sekolah">
      <div className="explorer-detail-bar"><School size={16} /><span>Profil sekolah</span><button onClick={onClose} aria-label="Tutup panel"><X size={16} /></button></div>
      <div className="explorer-detail-content">
        <button className="explorer-back" onClick={onBack}><ArrowLeft size={16} /> Kembali ke hasil</button>
        <figure className="explorer-detail-photo">
          <img
            src={p.fotoUrl || schoolIllustration}
            alt={p.nama ? `Foto ${p.nama}` : "Ilustrasi bangunan dan halaman sekolah"}
            width={1774}
            height={887}
            decoding="async"
            onError={(e) => { e.currentTarget.src = schoolIllustration; }}
          />
          <figcaption>{p.fotoUrl ? `Foto ${p.nama}` : "Foto ilustrasi · Foto sekolah ini belum tersedia"}</figcaption>
        </figure>
        <div className="explorer-detail-title">
          <div className="explorer-school-icon"><School size={22} /></div>
          <div><h2 ref={headingRef} tabIndex={-1}>{p.nama}</h2><p>{p.status} · Akreditasi {p.akreditasi || "Belum tersedia"}</p></div>
        </div>
        <p className="explorer-detail-location">{[p.desa, p.kecamatan && `Kec. ${p.kecamatan}`, p.kabupatenKota].filter(Boolean).join(", ") || "Kabupaten Bogor"}</p>
        <button className="explorer-detail-focus" onClick={onFocus}><Maximize2 size={15} /> Fokuskan peta</button>
        <section className="explorer-detail-section">
          <h3>Statistik sekolah</h3>
          <p className="explorer-detail-note">Tahun {p.tahunStatistik || "belum tersedia"}. Konfirmasi kondisi terkini ke pihak sekolah.</p>
          <dl className="explorer-detail-metrics">
            {[["Peserta didik", fmtNum(p.jumlahSiswa)], ["Tenaga pendidik", fmtNum(p.jumlahGuru)], ["Ruang kelas", fmtNum(p.ruangKelas)], ["Rasio guru–siswa", rasio(p.jumlahSiswa, p.jumlahGuru)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        <section className="explorer-detail-section">
          <h3>Kondisi ruang kelas</h3>
          <dl className="explorer-detail-facts">
            {[["Baik", p.kelasBaik], ["Rusak ringan", p.kelasRusakRingan], ["Rusak sedang", p.kelasRusakSedang], ["Rusak berat", p.kelasRusakBerat]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? "Belum tersedia" : `${fmtNum(value)} kelas`}</dd></div>)}
          </dl>
        </section>
        <section className="explorer-detail-section">
          <h3>Informasi sekolah</h3>
          <dl className="explorer-detail-facts">
            <div><dt>NPSN</dt><dd>{p.npsn || "Belum tersedia"}</dd></div>
            <div><dt>Pengelolaan</dt><dd>{p.status || "Belum tersedia"}</dd></div>
            <div><dt>Koordinat</dt><dd>{school.geometry.coordinates[1].toFixed(4)}, {school.geometry.coordinates[0].toFixed(4)}</dd></div>
          </dl>
        </section>
        <div className="explorer-detail-extra"><SchoolExtra key={p.id} school={school} onOpen={(f) => onOpen(mapSchoolFeature(f))} /></div>
      </div>
      <div className="explorer-detail-actions"><button disabled={compared || compareFull} onClick={onCompare}>{compared ? "Sudah ditambahkan" : compareFull ? "Maksimal 3 sekolah" : "+ Tambah ke perbandingan"}</button></div>
    </section>
  );
}

export default function EksplorasiPeta() {
  const {
    flyToRegion,
    comparedSchools,
    setIsCompareOpen,
    setSelectedFeature,
    addToCompare,
    selectedWilayahId,
    setSelectedWilayahId,
    flyToBounds,
  } = useMapStore(useShallow((state) => ({flyToRegion: state.flyToRegion,comparedSchools: state.comparedSchools,setIsCompareOpen: state.setIsCompareOpen,setSelectedFeature: state.setSelectedFeature,addToCompare: state.addToCompare,selectedWilayahId: state.selectedWilayahId,setSelectedWilayahId: state.setSelectedWilayahId,flyToBounds: state.flyToBounds})));
  const { sekolah, kecamatan, ringkasan, loaded, loading, error, loadPublic } = useDataStore();
  const { population, blankSpots, needs, loading: geographicLoading, errors: geographicErrors, retry: retryGeography } = useBogorLayers();

  useEffect(() => {
    if (!useDataStore.getState().loaded) loadPublic();
  }, [loadPublic]);

  const [districtFallback, setSelectedDistrict] = useState("");
  const selectedDistrict = selectedWilayahId ? String(selectedWilayahId) : districtFallback;
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'Negeri' | 'Swasta'
  const [activeTab, setActiveTab] = useState("list"); // 'search' | 'list' | 'layers'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSchoolDetail, setSelectedSchoolDetail] = useState(null);
  const detailTriggerRef = useRef(null);
  const resultsScrollRef = useRef(null);
  const savedResultsScrollRef = useRef(null);
  useLayoutEffect(() => {
    if (!selectedSchoolDetail && savedResultsScrollRef.current !== null) {
      if (resultsScrollRef.current) resultsScrollRef.current.scrollTop = savedResultsScrollRef.current;
      detailTriggerRef.current?.focus({ preventScroll: true });
      savedResultsScrollRef.current = null;
    }
  }, [selectedSchoolDetail]);
  const [visibleCount, setVisibleCount] = useState(30);
  // Kebutuhan layanan kembali menjadi tampilan utama; penduduk tetap dapat dipilih terpisah.
  const [activeLayers, setActiveLayers] = useState({ showSchools: true, show3DBuildings: false, populationLayer: false, mcdaLayer: true, showBlankSpots: true, showCandidates: false });
  // Dua choropleth tidak ditumpuk agar arti warna tetap jelas; area akses tetap independen.
  const toggleLayer = (key) => setActiveLayers((layers) => ({
    ...layers, [key]: !layers[key],
    ...(key === 'populationLayer' && !layers[key] ? { mcdaLayer: false } : {}),
    ...(key === 'mcdaLayer' && !layers[key] ? { populationLayer: false } : {}),
  }));
  const bogorSchools = useMemo(() => sekolah.features.filter((f) => isInBogor(f.geometry?.coordinates)), [sekolah]);
  const selectedPopulation = useMemo(() => population.features.find((feature) => feature.properties.id === selectedDistrict), [population, selectedDistrict]);

  // Opsi kecamatan: dari poligon wilayah bila sudah ada; bila belum, dari nama kecamatan pada data sekolah
  const kecamatanOptions = useMemo(() => {
    if (population.features.length) return population.features.map((feature) => ({
      id: feature.properties.id, name: `${feature.properties.nama} · ${feature.properties.kabupaten_kota}`,
      bbox: feature.bbox,
    })).sort((a, b) => a.name.localeCompare(b.name, 'id'));
    if (kecamatan.length) return kecamatan;
    const groups = new Map();
    bogorSchools.forEach((f) => {
      const n = f.properties.kecamatan;
      const c = f.geometry && f.geometry.coordinates;
      if (!n || !c) return;
      const g = groups.get(n) || { id: `txt:${n}`, name: n, bbox: [c[0], c[1], c[0], c[1]] };
      g.bbox = [Math.min(g.bbox[0], c[0]), Math.min(g.bbox[1], c[1]), Math.max(g.bbox[2], c[0]), Math.max(g.bbox[3], c[1])];
      groups.set(n, g);
    });
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [population, kecamatan, bogorSchools]);

  // Uji spasial hanya diulang saat kecamatan/sekolah berubah, bukan setiap ketikan pencarian.
  const districtSchools = useMemo(() => selectedPopulation
    ? bogorSchools.filter((feature) => isInBoundary(feature.geometry?.coordinates, selectedPopulation))
    : bogorSchools, [bogorSchools, selectedPopulation]);

  // List sekolah SMP yang terfilter
  const filteredSchools = useMemo(() => {
    const kw = searchKeyword.toLowerCase();
    return districtSchools.filter((f) => {
      const p = f.properties;
      const matchKeyword = (p.nama || "").toLowerCase().includes(kw) || (p.npsn && String(p.npsn).includes(searchKeyword));
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchDistrict =
        !selectedDistrict || selectedPopulation ||
        (String(selectedDistrict).startsWith("txt:")
          ? p.kecamatan === String(selectedDistrict).slice(4)
          : String(p.idWilayah) === String(selectedDistrict));
      return matchKeyword && matchStatus && matchDistrict;
    });
  }, [districtSchools, searchKeyword, filterStatus, selectedDistrict, selectedPopulation]);

  const filteredCollection = useMemo(() => ({ type: "FeatureCollection", features: filteredSchools }), [filteredSchools]);

  const pilihKecamatan = (districtId) => {
    setVisibleCount(30);
    setSelectedDistrict(districtId);
    // ID geografis bukan primary key tabel wilayah; jangan teruskan ke analisis MCDA.
    setSelectedWilayahId(districtId && !/^(txt:|geo:)/.test(String(districtId)) ? districtId : null);
    setSelectedFeature(null);
    const target = kecamatanOptions.find((d) => String(d.id) === String(districtId));
    if (target && target.bbox) flyToBounds(target.bbox);
  };

  const handleDistrictChange = (e) => pilihKecamatan(e.target.value);

  const ringkasanRadius = blankSpots.meta?.radius_km ?? 3;

  const districtFeature = useMemo(
    () => needs.features.find((f) => String(f.properties.id_wilayah) === String(selectedDistrict)),
    [needs, selectedDistrict]
  );

  const handleSelectSchool = (schoolFeature) => {
    const [lng, lat] = schoolFeature.geometry.coordinates;
    flyToRegion(lng, lat, 16.5);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setSelectedFeature({
      longitude: lng,
      latitude: lat,
      properties: schoolFeature.properties,
    });
  };

  const openSchoolDetail = (schoolFeature) => {
    if (!selectedSchoolDetail) {
      detailTriggerRef.current = document.activeElement;
      savedResultsScrollRef.current = resultsScrollRef.current?.scrollTop || 0;
    }
    setSelectedSchoolDetail(schoolFeature);
    setIsSidebarOpen(true);
    setSelectedFeature(null);
    const [lng, lat] = schoolFeature.geometry.coordinates;
    flyToBounds([lng, lat, lng, lat]);
  };

  const backToResults = () => {
    setSelectedSchoolDetail(null);
  };

  const resetFilters = () => {
    setVisibleCount(30);
    setSearchKeyword("");
    setFilterStatus("all");
    setSelectedDistrict("");
    setSelectedWilayahId(null);
  };

  return (
    <div className={`explorer relative w-full overflow-hidden flex flex-col font-sans ${isSidebarOpen ? "panel-open" : ""}`}>
      <nav className="explorer-floating-nav" aria-label="Navigasi peta">
        <button className={isSidebarOpen ? "is-active" : ""} onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-expanded={isSidebarOpen} aria-controls="explorer-panel"><School size={16} /> Jelajahi</button>
        <Link to="/">Beranda</Link>
      </nav>
      <Link to="/login" className="explorer-floating-login">Masuk pengelola <ChevronRight size={15} /></Link>
      <aside id="explorer-panel" aria-label="Pencarian sekolah" className={`explorer-panel ${isSidebarOpen ? "is-open" : "is-closed"}`} inert={!isSidebarOpen}>
        <div className="explorer-panel-inner">
          <div className="explorer-results-view" hidden={Boolean(selectedSchoolDetail)}>
          {/* Header Panel */}
          <div className="explorer-search-head">
            <h1><School size={16} /> Daftar sekolah <button onClick={() => setIsSidebarOpen(false)} aria-label="Tutup panel"><X size={16} /></button></h1>
            {/* Field Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setVisibleCount(30); }}
                aria-label="Cari nama sekolah atau NPSN"
                placeholder="Cari nama sekolah atau NPSN..."
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/30 focus:border-[#1F6F5F] transition-all shadow-sm"
              />
              {searchKeyword && (
                <button
                  aria-label="Hapus pencarian"
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Navigasi 3 Tab */}
            <div className="explorer-tabs">
              <button
                aria-pressed={activeTab === "search"} onClick={() => setActiveTab("search")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "search"
                    ? "bg-white text-[#1F6F5F] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <SlidersHorizontal size={13} /> Filter
              </button>
              <button
                aria-pressed={activeTab === "list"} onClick={() => setActiveTab("list")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "list"
                    ? "bg-white text-[#1F6F5F] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <School size={13} /> Daftar ({filteredSchools.length})
              </button>
              <button
                aria-pressed={activeTab === "layers"} onClick={() => setActiveTab("layers")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "layers"
                    ? "bg-white text-[#1F6F5F] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={13} /> Lapisan
              </button>
            </div>
          </div>

          {/* Konten Scrollable */}
          <div ref={resultsScrollRef} key={activeTab} className="explorer-panel-content space-y-4">
            {activeLayers.mcdaLayer && !needs.features.length && <p className="text-xs text-slate-500" role={geographicErrors.needs ? 'alert' : 'status'}>
              {geographicErrors.needs ? <>Kebutuhan gagal dimuat. <button className="underline" onClick={retryGeography}>Coba lagi</button></> : 'Menghitung kebutuhan layanan pada batas kecamatan…'}
            </p>}
            {/* Diagnosis memakai simulasi backend; data kosong tetap ditampilkan sebagai belum dinilai. */}
            {districtFeature && activeLayers.mcdaLayer && activeTab !== 'layers' && <section className="explorer-population-summary" aria-label="Kebutuhan layanan kecamatan" aria-live="polite">
              <div><h2>{districtFeature.properties.nama_wilayah}</h2><button onClick={() => pilihKecamatan('')} aria-label="Hapus filter kecamatan"><X size={15} /></button></div>
              <p>{districtFeature.properties.kabupaten_kota} · Simulasi {needs.meta?.tahun}</p>
              <div className="mt-3"><KategoriBadge kategori={districtFeature.properties.kategori_prioritas} />
                <span className="text-xs">{districtFeature.properties.skor_total === null ? 'Belum cukup data' : `${fmtNum(districtFeature.properties.skor_total, 1)} / 100`}</span></div>
              <p className="mt-3">{districtFeature.properties.diagnosis}</p>
            </section>}
            {/* Angka tahun dan sumber mengikuti kecamatan, bukan ringkasan data sekolah demo. */}
            {selectedPopulation && activeLayers.populationLayer && activeTab !== 'layers' && <section className="explorer-population-summary" aria-label="Penduduk kecamatan terpilih">
              <div><h2>{selectedPopulation.properties.nama}</h2><button onClick={() => pilihKecamatan('')} aria-label="Hapus filter kecamatan"><X size={15} /></button></div>
              <p>{selectedPopulation.properties.kabupaten_kota}</p>
              <strong>{fmtNum(selectedPopulation.properties.penduduk)} <span>jiwa · 2024</span></strong>
              <a href={selectedPopulation.properties.sumber_penduduk} target="_blank" rel="noreferrer">Sumber penduduk: BPS ↗</a>
            </section>}
            {/* TAB 1: FILTER WILAYAH DAN STATUS */}
            {activeTab === "search" && (
              <div className="space-y-4">
                {/* Wilayah / Kecamatan */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Kecamatan
                  </label>
                  <div className="relative">
                    <select
                      aria-label="Kecamatan"
                      value={selectedDistrict}
                      onChange={handleDistrictChange}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/30 focus:border-[#1F6F5F] cursor-pointer shadow-sm appearance-none transition-all"
                    >
                      <option value="">Semua Kecamatan</option>
                      {kecamatanOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          Kecamatan {d.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>

                {/* Status Sekolah */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Status Sekolah
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setFilterStatus("all")}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        filterStatus === "all"
                          ? "bg-[#1F6F5F] text-white border-[#1F6F5F] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setFilterStatus("Negeri")}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                        filterStatus === "Negeri"
                          ? "bg-[#1F6F5F] text-white border-[#1F6F5F] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      Negeri
                    </button>
                    <button
                      onClick={() => setFilterStatus("Swasta")}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                        filterStatus === "Swasta"
                          ? "bg-[#1F6F5F] text-white border-[#1F6F5F] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Swasta
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: DAFTAR SEKOLAH BERGAYA CARD FIGMA */}
            {activeTab === "list" && (
              <div className="space-y-3">
                <p className="explorer-result-count">{filteredSchools.length} sekolah sesuai pencarian</p>
                {filteredSchools.length === 0 ? (
                  <div className="text-center py-10 px-4 text-slate-400">
                    <p className="text-xs font-medium">Tidak ada sekolah yang cocok dengan filter aktif.</p>
                    <button
                      onClick={resetFilters}
                      className="mt-3 px-3 py-1.5 bg-[#1F6F5F] text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition"
                    >
                      Hapus semua filter
                    </button>
                  </div>
                ) : (
                  filteredSchools.slice(0, visibleCount).map((item) => {
                    const isCompared = comparedSchools.some(
                      (s) => s.id === item.properties.id
                    );


                    return (
                      <article key={item.properties.id} className="explorer-school">
                        <div className="explorer-school-icon"><School size={19} /></div>
                        <button className="explorer-school-info" onClick={() => openSchoolDetail(item)}>
                          <h3>{item.properties.nama}</h3>
                          <p>{item.properties.kecamatan || "Kabupaten Bogor"} · {item.properties.status}</p>
                          {isCompared && <small>Dalam perbandingan</small>}
                        </button>
                        <button onClick={() => handleSelectSchool(item)} className="explorer-school-focus" title="Fokuskan di peta" aria-label={`Fokuskan ${item.properties.nama} di peta`}><Maximize2 size={16} /></button>
                      </article>
                    );
                  })
                )}
                {filteredSchools.length > visibleCount && <button className="explorer-results-button" onClick={() => setVisibleCount((count) => count + 30)}>Tampilkan lebih banyak <ChevronDown size={16} /></button>}
              </div>
            )}

            {/* TAB 3: LAYER DAN ANALISIS MCDA */}
            {activeTab === "layers" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Tampilan peta
                  </label>
                  <div className="space-y-2">
                    {/* Jumlah penduduk adalah lapisan tersendiri, bukan pengganti skor kebutuhan. */}
                    <label className="explorer-population-toggle">
                      <div><p>Penduduk per kecamatan</p><small>Jumlah jiwa · 2024 · 46 kecamatan</small></div>
                      <input type="checkbox" checked={activeLayers.populationLayer} onChange={() => toggleLayer('populationLayer')} />
                    </label>
                    {geographicLoading && <p className="text-xs text-slate-500" role="status">Memuat batas wilayah dan area akses…</p>}
                    {(geographicErrors.population || geographicErrors.access || geographicErrors.needs) && <div className="text-xs text-red-700" role="alert">
                      <p>Lapisan gagal dimuat: {geographicErrors.needs || geographicErrors.population || geographicErrors.access}</p>
                      <button onClick={retryGeography} className="underline mt-2">Coba lagi</button>
                    </div>}
                    <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6F5F] flex items-center justify-center">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Bangunan 3D</p>
                          <p className="text-[10px] text-slate-400">Detail bangunan saat diperbesar</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayers?.show3DBuildings || false}
                        onChange={() => toggleLayer("show3DBuildings")}
                        className="w-4 h-4 rounded accent-[#1F6F5F] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1F6F5F] flex items-center justify-center">
                          <GraduationCap size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Titik Sebaran Sekolah</p>
                          <p className="text-[10px] text-slate-400">Marker lokasi sekolah aktif</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayers?.showSchools || false}
                        onChange={() => toggleLayer("showSchools")}
                        className="w-4 h-4 rounded accent-[#1F6F5F] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                          <Layers size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Kebutuhan layanan SMP</p>
                          <p className="text-[10px] text-slate-500">Simulasi 7 indikator backend · Skor 0–100</p>
                          {!geographicLoading && !needs.features.length && <p className="text-[11px] text-slate-500 mt-1">Skor kebutuhan belum tersedia.</p>}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayers?.mcdaLayer || false}
                        disabled={!needs.features.length}
                        onChange={() => toggleLayer("mcdaLayer")}
                        className="w-4 h-4 rounded accent-[#1F6F5F] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                          <AlertTriangle size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Area Minim Akses Sekolah</p>
                          <p className="text-[10px] text-slate-500">Di luar radius lurus {ringkasanRadius} km dari titik sekolah</p>
                          {!geographicLoading && !geographicErrors.access && !blankSpots.features.length && <p className="text-[11px] text-slate-500 mt-1">Tidak ada area di luar radius pada hasil ini.</p>}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayers?.showBlankSpots || false}
                        onChange={() => toggleLayer("showBlankSpots")}
                        className="w-4 h-4 rounded accent-[#1F6F5F] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {activeLayers.populationLayer && <section className="explorer-population-legend" aria-label="Legenda jumlah penduduk">
                  <h3>Jumlah penduduk · 2024</h3>
                  <p>Hijau: lebih sedikit. Kuning: menengah. Merah: lebih banyak.</p>
                  <ul>{POPULATION_BANDS.map((band) => <li key={band.min}><span style={{ backgroundColor: band.color }} />{band.label} jiwa</li>)}</ul>
                  <p>Jumlah total, bukan kepadatan atau tingkat kebutuhan sekolah.</p>
                  <details><summary>Sumber & metode</summary>
                    <p><a href={population.meta?.sources.kabupaten.url} target="_blank" rel="noreferrer">Kabupaten: estimasi BPS ↗</a></p>
                    <p><a href={population.meta?.sources.kota.url} target="_blank" rel="noreferrer">Kota: catatan Disdukcapil via BPS ↗</a></p>
                    <p>Keduanya tahun 2024, dengan metode pencatatan berbeda.</p>
                    <p>Batas kecamatan, kabupaten, dan kota memakai satu coverage BIG, edisi 2022 (revisi 27 Desember 2022). Penyederhanaan menjaga sisi bersama tetap tersambung.</p>
                  </details>
                </section>}
                {activeLayers.showBlankSpots && <p className="explorer-access-note"><span /> Garis biru putus-putus: area di luar radius {ringkasanRadius} km. {ringkasan?.menggunakan_data_demo ? 'Simulasi memakai titik sekolah demo.' : 'Berdasarkan titik sekolah yang tercatat.'} Bukan jarak perjalanan atau bukti tidak ada sekolah.</p>}

                {/* Legenda MCDA hanya tampil saat layer tersebut aktif. */}
                {activeLayers.mcdaLayer && <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Tingkat Kebutuhan Layanan SMP per Kecamatan
                  </span>
                  <ul className="space-y-1.5">
                    {[["Sangat Tinggi", "Skor ≥ 75"], ["Tinggi", "55–<75"], ["Sedang", "35–<55"], ["Rendah", "<35"], ["Belum dihitung", "Belum cukup data"]].map(([k, d]) => (
                      <li key={k} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colorOf(k) }} />
                        <strong className="text-slate-700">{k}</strong> <span className="text-slate-400">— {d}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 mt-2 leading-snug">
                    Simulasi data demo pada batas kecamatan baru. Skor relatif antarwilayah, bukan penilaian mutu sekolah. Kota Bogor belum memiliki data usia SMP untuk perhitungan ini.
                  </p>
                  <details className="text-[11px] mt-3"><summary className="cursor-pointer text-[#1f6f5f]">Indikator & bobot</summary>
                    <ul className="mt-2 space-y-2">{needs.meta?.indikator.map((indicator) => <li key={indicator.kode} className="flex justify-between gap-3"><span>{indicator.nama}</span><strong>{fmtNum(indicator.bobot * 100)}%</strong></li>)}</ul>
                    {needs.meta && <p className="text-slate-500 mt-3">Kebutuhan kursi = usia SMP × {fmtNum(needs.meta.parameter.target_apk * 100)}%; kapasitas kelas tercatat = ruang kelas × {needs.meta.parameter.siswa_per_rombel}. Nilai dinormalisasi dan dijumlahkan sesuai bobot.</p>}
                  </details>
                </div>}
              </div>
            )}
          </div>

          {/* Footer Status Panel */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Bogor · Kabupaten & Kota
            </span>
            <button
              onClick={resetFilters}
              className="text-[#1F6F5F] hover:underline font-semibold flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset Filter
            </button>
          </div>
          </div>
          {selectedSchoolDetail && <SchoolDetail
            key={selectedSchoolDetail.properties.id}
            school={selectedSchoolDetail}
            onBack={backToResults}
            onClose={() => setIsSidebarOpen(false)}
            onFocus={() => { const [lng, lat] = selectedSchoolDetail.geometry.coordinates; flyToBounds([lng, lat, lng, lat]); }}
            onCompare={() => addToCompare(selectedSchoolDetail.properties)}
            compared={comparedSchools.some((school) => school.id === selectedSchoolDetail.properties.id)}
            compareFull={comparedSchools.length >= 3}
            onOpen={openSchoolDetail}
          />}
        </div>
      </aside>

      {/* ================= FLOATING BUTTON PERBANDINGAN ================= */}
      {comparedSchools.length > 0 && (
        <div className="explorer-compare">
          <button
            onClick={() => setIsCompareOpen(true)}
            className="bg-[#1F6F5F] hover:bg-emerald-800 text-white font-medium px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs transition-all transform hover:scale-105 border border-emerald-400/30 backdrop-blur-md"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 size={16} /> Bandingkan Sekolah
            </span>
            <span className="bg-white text-[#1F6F5F] font-bold px-2 py-0.5 rounded-full text-[11px]">
              {comparedSchools.length}
            </span>
          </button>
        </div>
      )}

      {/* ================= STATUS DATA ================= */}
      {(error || (loading && !loaded) || ringkasan?.menggunakan_data_demo || (loaded && !ringkasan?.sekolah)) && (
        <div className="explorer-data-status space-y-2">
          {loading && !loaded && (
            <div className="pointer-events-auto bg-white/95 border border-slate-200 text-slate-600 text-xs rounded-xl px-4 py-2.5 shadow" role="status">Memuat data peta...</div>
          )}
          {error && (
            <div role="alert" className="pointer-events-auto bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-2.5 shadow flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={loadPublic} className="font-bold underline whitespace-nowrap">Coba lagi</button>
            </div>
          )}
          {ringkasan?.menggunakan_data_demo && (
            <div className="pointer-events-auto bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-4 py-2.5 shadow">
              <strong>Simulasi kebutuhan & akses</strong><span> · Data sekolah dan usia SMP demo.</span>
            </div>
          )}
          {loaded && !ringkasan?.sekolah && !error && (
            <div className="pointer-events-auto bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl px-4 py-2.5 shadow">
              Belum ada data sekolah. Operator perlu mengunggah dataset terlebih dahulu.
            </div>
          )}
        </div>
      )}

      {/* ================= MAP CANVAS ================= */}
      <main className="explorer-map">
        <Suspense fallback={<div className="explorer-map-loading" role="status">Memuat peta...</div>}>
        <MapCanvas schools={filteredCollection} publicExplorer publicLayers={activeLayers} population={population} publicBlankSpots={blankSpots} publicNeeds={needs} selectedPopulationId={selectedPopulation?.properties.id} onDistrictSelect={(id) => { pilihKecamatan(id); setSelectedSchoolDetail(null); setActiveTab('list'); setIsSidebarOpen(true); }} panelOpen={isSidebarOpen} onSchoolSelect={openSchoolDetail} onOpenLayers={() => { setSelectedSchoolDetail(null); setActiveTab("layers"); setIsSidebarOpen(true); }} />
        </Suspense>
      </main>

      {/* ================= MODAL PERBANDINGAN ================= */}
      <CompareModal />
    </div>
  );
}
