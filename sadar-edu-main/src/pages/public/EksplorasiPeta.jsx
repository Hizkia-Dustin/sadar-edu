import GeoLoader, { GeoMark } from '../../components/ui/GeoLoader';
import { useShallow } from "zustand/react/shallow";
import "./explorer.css";
import schoolIllustration from "../../assets/figma/school-hero.png";
import { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Building2,
  X,
  School,
  CheckCircle2,
  Maximize2,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  LocateFixed,
  MapPin,
  Navigation,
  Award,
  MousePointerClick,
  Move,
} from "lucide-react";
const MapCanvas = lazy(() => import("../../components/map/MapCanvas"));
import CompareModal from "../../components/ui/CompareModal";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { api } from "../../lib/api";
import { rasio, mapSchoolFeature, fmt as fmtNum } from "../../lib/analysis";
import { isInBogor, isInBoundary } from "../../lib/bogorBoundary";
import { useBogorLayers } from "../../hooks/useBogorLayers";
import {
  haversineKm,
  formatDistance,
  estimateTravelTime,
  circleBounds,
  googleMapsDirectionsUrl,
} from "../../lib/geoDistance";

const RADIUS_OPTIONS = [
  { value: 1, label: "1 km" },
  { value: 3, label: "3 km" },
  { value: 5, label: "5 km" },
  { value: 0, label: "Semua" },
];

/** Alternatif sekolah terdekat di sekitar sekolah yang sedang dibuka */
function SchoolAlternatives({ school, onOpen }) {
  const id = school.properties.id;
  const [state, setState] = useState({ loading: true, alt: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/sekolah/${id}/alternatif`, { limit: 4, radius_km: 6 })
      .then((a) => {
        if (!cancelled) {
          setState({
            loading: false,
            alt: a.data.features.filter((f) => isInBogor(f.geometry?.coordinates)),
            error: "",
          });
        }
      })
      .catch((e) => !cancelled && setState({ loading: false, alt: [], error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) return <GeoLoader className="w-full py-2 text-xs text-slate-600" label="Memuat sekolah di sekitar…" />;
  if (state.error) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h4 className="text-xs font-bold text-slate-700 mb-2">Alternatif SMP Terdekat di Sekitarnya</h4>
      {state.alt.length === 0 ? (
        <p className="text-xs text-slate-400">Tidak ada sekolah lain dalam radius 6 km.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {state.alt.map((f) => (
            <li key={f.properties.id_sekolah} className="py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">{f.properties.nama_sekolah}</p>
                <p className="text-[11px] text-slate-400">
                  {f.properties.status_sekolah} · {fmtNum(f.properties.jarak_km, 1)} km · {fmtNum(f.properties.jumlah_siswa)} siswa
                </p>
              </div>
              <button
                onClick={() => onOpen(f)}
                className="text-[11px] font-semibold text-[#1F6F5F] hover:underline whitespace-nowrap"
              >
                Lihat
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SchoolDetail({ school, userLocation, onBack, onClose, onFocus, onCompare, compared, compareFull, onOpen }) {
  const headingRef = useRef(null);
  const p = school.properties;
  const coords = school.geometry?.coordinates;
  const distanceKm = userLocation && coords ? haversineKm([userLocation.lng, userLocation.lat], coords) : null;
  const siswaPerKelas = p.jumlahSiswa && p.ruangKelas ? Math.round(p.jumlahSiswa / p.ruangKelas) : null;
  const totalRusak = (p.kelasRusakSedang || 0) + (p.kelasRusakBerat || 0);
  const routeUrl = googleMapsDirectionsUrl(coords, userLocation ? [userLocation.lng, userLocation.lat] : null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="explorer-detail" aria-label="Detail sekolah">
      <div className="explorer-detail-bar">
        <School size={16} />
        <span>Profil sekolah</span>
        <button onClick={onClose} aria-label="Tutup panel">
          <X size={16} />
        </button>
      </div>
      <div className="explorer-detail-content">
        <button className="explorer-back" onClick={onBack}>
          <ArrowLeft size={16} /> Kembali ke daftar
        </button>
        <figure className="explorer-detail-photo">
          <img
            src={p.fotoUrl || schoolIllustration}
            alt={p.nama ? `Foto ${p.nama}` : "Ilustrasi bangunan dan halaman sekolah"}
            width={1774}
            height={887}
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = schoolIllustration;
            }}
          />
          <figcaption>{p.fotoUrl ? `Foto ${p.nama}` : "Foto ilustrasi · Foto sekolah belum tersedia"}</figcaption>
        </figure>
        <div className="explorer-detail-title">
          <div className="explorer-school-icon">
            <School size={22} />
          </div>
          <div>
            <h2 ref={headingRef} tabIndex={-1}>{p.nama}</h2>
            <p>{p.status} · Akreditasi {p.akreditasi || "Belum tersedia"}</p>
          </div>
        </div>
        <p className="explorer-detail-location">
          {[p.desa, p.kecamatan && `Kec. ${p.kecamatan}`, p.kabupatenKota].filter(Boolean).join(", ") || "Bogor"}
        </p>

        {distanceKm != null && (
          <div className="explorer-detail-distance">
            <div>
              <strong>{formatDistance(distanceKm)} dari lokasi rumah</strong>
              <span>{estimateTravelTime(distanceKm)} · garis lurus spasial</span>
            </div>
          </div>
        )}

        <div className="explorer-detail-btn-row">
          <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className="explorer-detail-focus"
          >
            <Navigation size={15} /> Rute Google Maps
          </a>
          <button type="button" className="explorer-detail-secondary" onClick={onFocus}>
            <Maximize2 size={15} /> Lihat di peta
          </button>
        </div>

        <section className="explorer-detail-section">
          <h3>Gambaran sekolah</h3>
          <p className="explorer-detail-note">
            Data tahun {p.tahunStatistik || "terbaru"}. Pastikan informasi PPDB terbaru langsung ke pihak sekolah.
          </p>
          <dl className="explorer-detail-metrics">
            {[
              ["Peserta didik", fmtNum(p.jumlahSiswa)],
              ["Tenaga pendidik", fmtNum(p.jumlahGuru)],
              ["Rata-rata / kelas", siswaPerKelas ? `${siswaPerKelas} siswa` : "-"],
              ["Rasio guru–siswa", rasio(p.jumlahSiswa, p.jumlahGuru)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="explorer-detail-section">
          <h3>Kondisi ruang belajar</h3>
          {p.ruangKelas ? (
            <p className="explorer-detail-note mb-3">
              {totalRusak === 0
                ? `Seluruh ruang kelas tercatat (${fmtNum(p.ruangKelas)} kelas) dalam kondisi layak pakai.`
                : `${fmtNum(p.kelasBaik ?? 0)} dari ${fmtNum(p.ruangKelas)} kelas dalam kondisi baik; terdapat ${fmtNum(totalRusak)} kelas rusak sedang/berat.`}
            </p>
          ) : null}
          <dl className="explorer-detail-facts">
            {[
              ["Kondisi baik", p.kelasBaik],
              ["Rusak ringan", p.kelasRusakRingan],
              ["Rusak sedang", p.kelasRusakSedang],
              ["Rusak berat", p.kelasRusakBerat],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value == null ? "Belum tersedia" : `${fmtNum(value)} kelas`}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="explorer-detail-section">
          <h3>Identitas sekolah</h3>
          <dl className="explorer-detail-facts">
            <div><dt>NPSN</dt><dd>{p.npsn || "Belum tersedia"}</dd></div>
            <div><dt>Status</dt><dd>{p.status || "Belum tersedia"}</dd></div>
            <div><dt>Akreditasi</dt><dd>{p.akreditasi || "Belum tersedia"}</dd></div>
            <div><dt>Jumlah ruang kelas</dt><dd>{p.ruangKelas == null ? "Belum tersedia" : `${fmtNum(p.ruangKelas)} ruang`}</dd></div>
          </dl>
        </section>

        <div className="explorer-detail-extra">
          <SchoolAlternatives key={p.id} school={school} onOpen={(f) => onOpen(mapSchoolFeature(f))} />
        </div>
      </div>

      <div className="explorer-detail-actions">
        <button disabled={compared || compareFull} onClick={onCompare}>
          {compared ? "Sudah dalam perbandingan" : compareFull ? "Maksimal 3 sekolah" : "+ Tambah ke perbandingan"}
        </button>
      </div>
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
    userLocation,
    setUserLocation,
  } = useMapStore(
    useShallow((state) => ({
      flyToRegion: state.flyToRegion,
      comparedSchools: state.comparedSchools,
      setIsCompareOpen: state.setIsCompareOpen,
      setSelectedFeature: state.setSelectedFeature,
      addToCompare: state.addToCompare,
      selectedWilayahId: state.selectedWilayahId,
      setSelectedWilayahId: state.setSelectedWilayahId,
      flyToBounds: state.flyToBounds,
      userLocation: state.userLocation,
      setUserLocation: state.setUserLocation,
    }))
  );
  const { sekolah, kecamatan, loaded, loading, error, loadPublic } = useDataStore();
  const { population, blankSpots } = useBogorLayers();

  useEffect(() => {
    if (!useDataStore.getState().loaded) loadPublic();
  }, [loadPublic]);

  const [districtFallback, setSelectedDistrict] = useState("");
  const selectedDistrict = selectedWilayahId ? String(selectedWilayahId) : districtFallback;
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'Negeri' | 'Swasta'
  const [onlyAccredA, setOnlyAccredA] = useState(false);
  const [radiusKm, setRadiusKm] = useState(3); // 1 | 3 | 5 | 0 (semua)
  const [pickLocationMode, setPickLocationMode] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [geoNotice, setGeoNotice] = useState("");
  const [layersPopoverOpen, setLayersPopoverOpen] = useState(false);
  const [hoveredSchoolCoords, setHoveredSchoolCoords] = useState(null);
  const [hintVisible, setHintVisible] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSchoolDetail, setSelectedSchoolDetail] = useState(null);
  const resultsScrollRef = useRef(null);
  const savedResultsScrollRef = useRef(0);

  useLayoutEffect(() => {
    if (!selectedSchoolDetail && resultsScrollRef.current && savedResultsScrollRef.current > 0) {
      resultsScrollRef.current.scrollTop = savedResultsScrollRef.current;
    }
  }, [selectedSchoolDetail]);

  const [visibleCount, setVisibleCount] = useState(30);

  // Peta publik default bersih: fokus ke titik sekolah & lokasi rumah orang tua.
  const [activeLayers, setActiveLayers] = useState({
    showSchools: true,
    show3DBuildings: false,
    populationLayer: false,
    mcdaLayer: false,
    showBlankSpots: false,
    showCandidates: false,
  });

  const togglePublicLayer = (key) =>
    setActiveLayers((layers) => ({ ...layers, [key]: !layers[key] }));

  // Batalkan mode pilih titik dengan tombol Esc
  useEffect(() => {
    if (!pickLocationMode) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setPickLocationMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickLocationMode]);

  const bogorSchools = useMemo(
    () => sekolah.features.filter((f) => isInBogor(f.geometry?.coordinates)),
    [sekolah]
  );

  const selectedPopulation = useMemo(
    () => population.features.find((feature) => feature.properties.id === selectedDistrict),
    [population, selectedDistrict]
  );

  const kecamatanOptions = useMemo(() => {
    if (population.features.length) {
      return population.features
        .map((feature) => ({
          id: feature.properties.id,
          name: `${feature.properties.nama} · ${feature.properties.kabupaten_kota}`,
          bbox: feature.bbox,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
    if (kecamatan.length) return kecamatan;
    const groups = new Map();
    bogorSchools.forEach((f) => {
      const n = f.properties.kecamatan;
      const c = f.geometry && f.geometry.coordinates;
      if (!n || !c) return;
      const g = groups.get(n) || { id: `txt:${n}`, name: n, bbox: [c[0], c[1], c[0], c[1]] };
      g.bbox = [
        Math.min(g.bbox[0], c[0]),
        Math.min(g.bbox[1], c[1]),
        Math.max(g.bbox[2], c[0]),
        Math.max(g.bbox[3], c[1]),
      ];
      groups.set(n, g);
    });
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [population, kecamatan, bogorSchools]);

  // Tetapkan lokasi rumah (dari GPS, klik peta, atau geser pin)
  const applyUserLocation = useCallback(
    (loc, targetRadius = radiusKm) => {
      if (!isInBogor([loc.lng, loc.lat])) {
        setGeoNotice("Titik berada di luar wilayah Bogor. Silakan tandai lokasi di dalam peta Bogor.");
        return;
      }
      setGeoNotice("");
      setUserLocation(loc);
      setPickLocationMode(false);
      setSelectedDistrict("");
      setSelectedWilayahId(null);
      setSelectedSchoolDetail(null);
      setVisibleCount(30);
      setIsSidebarOpen(true);
      flyToBounds(circleBounds([loc.lng, loc.lat], targetRadius > 0 ? targetRadius : 4));
    },
    [radiusKm, setUserLocation, setSelectedWilayahId, flyToBounds]
  );

  const handleLocateGps = () => {
    if (!navigator.geolocation) {
      setGeoNotice("Browser tidak mendukung GPS. Gunakan tombol 'Tandai di peta'.");
      setPickLocationMode(true);
      return;
    }
    setLocatingGps(true);
    setGeoNotice("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const { longitude: lng, latitude: lat } = pos.coords;
        if (!isInBogor([lng, lat])) {
          setGeoNotice("Lokasi perangkat Anda di luar wilayah Bogor. Klik lokasi rumah langsung di peta.");
          setPickLocationMode(true);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
          return;
        }
        applyUserLocation({ lng, lat }, radiusKm);
      },
      () => {
        setLocatingGps(false);
        setGeoNotice("Izin lokasi tidak aktif. Klik langsung lokasi rumah Anda pada peta.");
        setPickLocationMode(true);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const handleTogglePickMode = () => {
    setGeoNotice("");
    setPickLocationMode((prev) => {
      const next = !prev;
      if (next && window.innerWidth < 768) setIsSidebarOpen(false);
      return next;
    });
  };

  const handleChangeRadius = (nextRadius) => {
    setRadiusKm(nextRadius);
    setVisibleCount(30);
    if (userLocation && nextRadius > 0) {
      flyToBounds(circleBounds([userLocation.lng, userLocation.lat], nextRadius));
    }
  };

  const clearUserLocation = () => {
    setUserLocation(null);
    setPickLocationMode(false);
    setGeoNotice("");
    setHoveredSchoolCoords(null);
  };

  const districtSchools = useMemo(
    () =>
      selectedPopulation
        ? bogorSchools.filter((feature) => isInBoundary(feature.geometry?.coordinates, selectedPopulation))
        : bogorSchools,
    [bogorSchools, selectedPopulation]
  );

  // Hitung ringkasan jangkauan 3 km untuk kartu status lokasi rumah
  const homeSummary = useMemo(() => {
    if (!userLocation) return null;
    const origin = [userLocation.lng, userLocation.lat];
    const withDist = bogorSchools
      .map((f) => ({ feature: f, km: haversineKm(origin, f.geometry?.coordinates) }))
      .filter((x) => x.km != null)
      .sort((a, b) => a.km - b.km);
    const within3 = withDist.filter((x) => x.km <= 3);
    const withinActive = radiusKm > 0 ? withDist.filter((x) => x.km <= radiusKm) : withDist;
    return {
      nearest: withDist[0] || null,
      count3km: within3.length,
      negeri3km: within3.filter((x) => x.feature.properties.status === "Negeri").length,
      swasta3km: within3.filter((x) => x.feature.properties.status === "Swasta").length,
      countActive: withinActive.length,
    };
  }, [userLocation, bogorSchools, radiusKm]);

  // Daftar sekolah terfilter & otomatis diurutkan berdasarkan jarak bila lokasi rumah aktif
  const filteredSchoolsWithDist = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    const origin = userLocation ? [userLocation.lng, userLocation.lat] : null;
    const list = [];

    for (const f of districtSchools) {
      const p = f.properties;
      const matchKeyword =
        !kw ||
        (p.nama || "").toLowerCase().includes(kw) ||
        (p.npsn && String(p.npsn).includes(kw)) ||
        (p.kecamatan || "").toLowerCase().includes(kw);
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchAccred = !onlyAccredA || String(p.akreditasi || "").toUpperCase() === "A";
      const matchDistrict =
        !selectedDistrict ||
        selectedPopulation ||
        (String(selectedDistrict).startsWith("txt:")
          ? p.kecamatan === String(selectedDistrict).slice(4)
          : String(p.idWilayah) === String(selectedDistrict));

      if (!matchKeyword || !matchStatus || !matchAccred || !matchDistrict) continue;

      const km = origin ? haversineKm(origin, f.geometry?.coordinates) : null;
      if (origin && radiusKm > 0 && (km == null || km > radiusKm)) continue;

      list.push({ feature: f, km });
    }

    if (origin) {
      list.sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999));
    }
    return list;
  }, [districtSchools, searchKeyword, filterStatus, onlyAccredA, selectedDistrict, selectedPopulation, userLocation, radiusKm]);

  const filteredCollection = useMemo(
    () => ({ type: "FeatureCollection", features: filteredSchoolsWithDist.map((item) => item.feature) }),
    [filteredSchoolsWithDist]
  );

  const pilihKecamatan = (districtId) => {
    setVisibleCount(30);
    setSelectedDistrict(districtId);
    setSelectedWilayahId(districtId && !/^(txt:|geo:)/.test(String(districtId)) ? districtId : null);
    setSelectedFeature(null);
    const target = kecamatanOptions.find((d) => String(d.id) === String(districtId));
    if (target && target.bbox) flyToBounds(target.bbox);
  };

  const handleSelectSchool = (schoolFeature) => {
    const [lng, lat] = schoolFeature.geometry.coordinates;
    flyToRegion(lng, lat, 15.5);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setSelectedFeature({
      longitude: lng,
      latitude: lat,
      properties: schoolFeature.properties,
    });
  };

  const openSchoolDetail = useCallback(
    (schoolFeature) => {
      setSelectedSchoolDetail(schoolFeature);
      setIsSidebarOpen(true);
      setSelectedFeature(null);
      const [lng, lat] = schoolFeature.geometry.coordinates;
      if (userLocation) {
        flyToBounds([
          Math.min(userLocation.lng, lng) - 0.006,
          Math.min(userLocation.lat, lat) - 0.006,
          Math.max(userLocation.lng, lng) + 0.006,
          Math.max(userLocation.lat, lat) + 0.006,
        ]);
      } else {
        flyToBounds([lng, lat, lng, lat]);
      }
    },
    [setSelectedFeature, userLocation, flyToBounds]
  );

  const resetFilters = () => {
    setVisibleCount(30);
    setSearchKeyword("");
    setFilterStatus("all");
    setOnlyAccredA(false);
    setSelectedDistrict("");
    setSelectedWilayahId(null);
    clearUserLocation();
  };

  const hasActiveFilters = Boolean(searchKeyword || filterStatus !== "all" || onlyAccredA || selectedDistrict || userLocation);
  const activeFocusedCoords =
    selectedSchoolDetail?.geometry?.coordinates || hoveredSchoolCoords || null;

  return (
    <div className={`explorer relative w-full overflow-hidden flex flex-col font-sans ${isSidebarOpen ? "panel-open" : ""}`}>
      <nav className="explorer-floating-nav" aria-label="Navigasi peta">
        <button
          className={isSidebarOpen ? "is-active" : ""}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-expanded={isSidebarOpen}
          aria-controls="explorer-panel"
        >
          <School size={16} /> Cari SMP
        </button>
        <Link to="/">Beranda</Link>
      </nav>
      <Link to="/login" className="explorer-floating-login">
        Masuk pengelola <ChevronRight size={15} />
      </Link>

      {/* Legenda & petunjuk interaksi di atas peta */}
      <div className="explorer-map-legend" aria-label="Legenda peta">
        <span><i className="is-negeri" /> Negeri</span>
        <span><i className="is-swasta" /> Swasta</span>
        <span><i className="is-cluster">12</i> Kelompok</span>
        {userLocation && <span><i className="is-radius" /> Radius {radiusKm > 0 ? `${radiusKm} km` : "bebas"}</span>}
        {hintVisible && (
          <span className="explorer-map-hint">
            <MousePointerClick size={13} /> Klik titik
            <Move size={13} /> Seret &amp; zoom
            <button type="button" onClick={() => setHintVisible(false)} aria-label="Sembunyikan petunjuk">
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      <div className="explorer-map-vignette" aria-hidden="true" />

      {/* Banner Instruksi Mode Tandai Lokasi di Peta */}
      {pickLocationMode && (
        <div className="explorer-pick-banner" role="status" aria-live="polite">
          <MapPin size={15} />
          <span>Klik titik lokasi rumah Anda di peta Bogor</span>
          <button type="button" onClick={() => setPickLocationMode(false)}>
            Batal
          </button>
        </div>
      )}

      {/* Popover Tampilan Peta Ringan (Pojok Kanan) */}
      {layersPopoverOpen && (
        <div className="explorer-layers-popover" role="dialog" aria-label="Tampilan peta">
          <div className="explorer-layers-popover-head">
            <span>Tampilan peta</span>
            <button type="button" onClick={() => setLayersPopoverOpen(false)} aria-label="Tutup tampilan peta">
              <X size={15} />
            </button>
          </div>
          <label className="explorer-layers-option">
            <div>
              <p><Building2 size={14} /> Bangunan 3D</p>
              <small>Bentuk bangunan saat peta diperbesar</small>
            </div>
            <input
              type="checkbox"
              checked={activeLayers.show3DBuildings}
              onChange={() => togglePublicLayer("show3DBuildings")}
            />
          </label>
          <label className="explorer-layers-option">
            <div>
              <p><AlertTriangle size={14} /> Area jauh dari SMP (&gt;3 km)</p>
              <small>Tandai wilayah di luar radius 3 km</small>
            </div>
            <input
              type="checkbox"
              checked={activeLayers.showBlankSpots}
              onChange={() => togglePublicLayer("showBlankSpots")}
            />
          </label>
          <div className="explorer-layers-legend">
            <span><i style={{ background: "#0f766e" }} /> SMP Negeri</span>
            <span><i style={{ background: "#d97706" }} /> SMP Swasta</span>
          </div>
        </div>
      )}

      <aside
        id="explorer-panel"
        aria-label="Pencarian sekolah"
        className={`explorer-panel ${isSidebarOpen ? "is-open" : "is-closed"}`}
        inert={!isSidebarOpen}
      >
        <div className="explorer-panel-inner">
          <div className="explorer-results-view" hidden={Boolean(selectedSchoolDetail)}>
            {/* Header + Pencarian + Lokasi Rumah + Filter Inline */}
            <div className="explorer-search-head">
              <h1>
                <School size={16} /> Cari SMP di Bogor
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Tutup panel">
                  <X size={16} />
                </button>
              </h1>

              {/* Pencarian Nama / NPSN / Kecamatan */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setVisibleCount(30);
                  }}
                  aria-label="Cari nama sekolah, NPSN, atau kecamatan"
                  placeholder="Cari nama SMP, NPSN, atau kecamatan..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/30 focus:border-[#1F6F5F] transition-all"
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

              {/* Blok Lokasi Rumah (Cari SMP Terdekat) */}
              <div className="explorer-home-box">
                {!userLocation ? (
                  <>
                    <div className="explorer-home-label">
                      <span>Cari SMP terdekat dari rumah Anda</span>
                    </div>
                    <div className="explorer-home-actions">
                      <button
                        type="button"
                        className="explorer-home-btn is-primary"
                        onClick={handleLocateGps}
                        disabled={locatingGps}
                      >
                        {locatingGps ? <GeoMark /> : <LocateFixed size={14} />}
                        <span>{locatingGps ? "Mendeteksi…" : "Lokasi saya"}</span>
                      </button>
                      <button
                        type="button"
                        className={`explorer-home-btn ${pickLocationMode ? "is-picking" : ""}`}
                        onClick={handleTogglePickMode}
                      >
                        <MapPin size={14} />
                        <span>{pickLocationMode ? "Klik di peta…" : "Tandai di peta"}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={`explorer-home-active ${homeSummary?.count3km === 0 ? "is-blank" : ""}`}>
                    <div className="explorer-home-active-top">
                      <div>
                        <strong>
                          {homeSummary?.count3km > 0
                            ? `${homeSummary.count3km} SMP dalam 3 km`
                            : "Di luar jangkauan 3 km"}
                        </strong>
                        <p>
                          {homeSummary?.count3km > 0
                            ? `${homeSummary.negeri3km} Negeri · ${homeSummary.swasta3km} Swasta · Terdekat ${formatDistance(homeSummary.nearest?.km)}`
                            : homeSummary?.nearest
                            ? `SMP terdekat berjarak ${formatDistance(homeSummary.nearest.km)}`
                            : "Belum ada data sekolah terdekat"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="explorer-home-clear"
                        onClick={clearUserLocation}
                        title="Hapus titik lokasi rumah"
                        aria-label="Hapus titik lokasi rumah"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="explorer-radius-row" role="group" aria-label="Pilih radius pencarian">
                      {RADIUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={radiusKm === opt.value}
                          onClick={() => handleChangeRadius(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="explorer-repin-btn"
                        onClick={handleTogglePickMode}
                        title="Pindahkan pin rumah di peta"
                      >
                        <MapPin size={12} /> Pindah
                      </button>
                    </div>
                  </div>
                )}
                {geoNotice && <p className="explorer-home-notice" role="status">{geoNotice}</p>}
              </div>

              {/* Filter Cepat Inline (Tanpa Pindah Tab) */}
              <div className="explorer-inline-filters">
                <div className="explorer-chip-row" role="group" aria-label="Filter status dan akreditasi">
                  {[
                    ["all", "Semua"],
                    ["Negeri", "Negeri"],
                    ["Swasta", "Swasta"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`explorer-filter-chip ${filterStatus === val ? "is-active" : ""}`}
                      onClick={() => {
                        setFilterStatus(val);
                        setVisibleCount(30);
                      }}
                    >
                      {val === "Negeri" && <span className="explorer-dot is-negeri" />}
                      {val === "Swasta" && <span className="explorer-dot is-swasta" />}
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`explorer-filter-chip ${onlyAccredA ? "is-active" : ""}`}
                    onClick={() => {
                      setOnlyAccredA((prev) => !prev);
                      setVisibleCount(30);
                    }}
                    title="Tampilkan hanya SMP berakreditasi A"
                  >
                    <Award size={12} /> Akr. A
                  </button>
                </div>

                <div className="explorer-district-select-wrap">
                  <select
                    aria-label="Filter kecamatan"
                    value={selectedDistrict}
                    onChange={(e) => pilihKecamatan(e.target.value)}
                  >
                    <option value="">Semua Kecamatan Bogor</option>
                    {kecamatanOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        Kec. {d.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="explorer-select-caret" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Daftar Sekolah */}
            <div
              ref={resultsScrollRef}
              onScroll={(e) => { savedResultsScrollRef.current = e.currentTarget.scrollTop; }}
              className="explorer-panel-content space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="explorer-result-count">
                  {userLocation
                    ? `${filteredSchoolsWithDist.length} SMP ${radiusKm > 0 ? `dalam ${radiusKm} km` : "terdekat"}`
                    : `${filteredSchoolsWithDist.length} SMP ditemukan`}
                </p>
                {userLocation && (
                  <span className="text-[10.5px] text-slate-400">Urut terdekat</span>
                )}
              </div>

              {filteredSchoolsWithDist.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500">
                  <p className="text-xs font-medium">
                    {userLocation && radiusKm > 0
                      ? `Tidak ada SMP yang cocok dalam radius ${radiusKm} km dari titik ini.`
                      : "Tidak ada sekolah yang cocok dengan filter aktif."}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {userLocation && radiusKm > 0 && (
                      <button
                        onClick={() => handleChangeRadius(0)}
                        className="px-3 py-1.5 bg-[#1F6F5F] text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition"
                      >
                        Lihat semua jarak
                      </button>
                    )}
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                    >
                      Reset filter
                    </button>
                  </div>
                </div>
              ) : (
                filteredSchoolsWithDist.slice(0, visibleCount).map(({ feature: item, km }) => {
                  const isCompared = comparedSchools.some((s) => s.id === item.properties.id);
                  return (
                    <article
                      key={item.properties.id}
                      className={`explorer-school ${item.properties.status === "Negeri" ? "is-negeri" : "is-swasta"}`}
                      onMouseEnter={() => setHoveredSchoolCoords(item.geometry?.coordinates || null)}
                      onMouseLeave={() => setHoveredSchoolCoords(null)}
                    >
                      <div className={`explorer-school-icon ${item.properties.status === "Negeri" ? "is-negeri" : "is-swasta"}`}>
                        <School size={18} />
                      </div>
                      <button className="explorer-school-info" onClick={() => openSchoolDetail(item)}>
                        <div className="explorer-school-head">
                          <h3>{item.properties.nama}</h3>
                          {km != null && <span className="explorer-distance-badge">{formatDistance(km)}</span>}
                        </div>
                        <p>
                          {item.properties.status}
                          {item.properties.akreditasi ? ` · Akr. ${item.properties.akreditasi}` : ""}
                          {item.properties.kecamatan ? ` · Kec. ${item.properties.kecamatan}` : ""}
                        </p>
                        {km != null && <span className="explorer-school-travel">{estimateTravelTime(km)}</span>}
                        {isCompared && <small>Dalam perbandingan</small>}
                      </button>
                      <button
                        onClick={() => handleSelectSchool(item)}
                        className="explorer-school-focus"
                        title="Fokuskan di peta"
                        aria-label={`Fokuskan ${item.properties.nama} di peta`}
                      >
                        <Maximize2 size={15} />
                      </button>
                    </article>
                  );
                })
              )}

              {filteredSchoolsWithDist.length > visibleCount && (
                <button
                  className="explorer-results-button"
                  onClick={() => setVisibleCount((count) => count + 30)}
                >
                  Tampilkan lebih banyak <ChevronDown size={16} />
                </button>
              )}

              {userLocation && (
                <p className="explorer-ppdb-note">
                  Jarak dihitung secara garis lurus spasial; ketentuan zonasi resmi mengikuti juknis PPDB Dinas Pendidikan.
                </p>
              )}
            </div>

            {/* Footer Panel */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Bogor · Kabupaten &amp; Kota
              </span>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[#1F6F5F] hover:underline font-semibold flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {selectedSchoolDetail && (
            <SchoolDetail
              key={selectedSchoolDetail.properties.id}
              school={selectedSchoolDetail}
              userLocation={userLocation}
              onBack={() => setSelectedSchoolDetail(null)}
              onClose={() => setIsSidebarOpen(false)}
              onFocus={() => {
                const [lng, lat] = selectedSchoolDetail.geometry.coordinates;
                flyToRegion(lng, lat, 16);
              }}
              onCompare={() =>
                addToCompare({
                  ...selectedSchoolDetail.properties,
                  coords: selectedSchoolDetail.geometry?.coordinates,
                })
              }
              compared={comparedSchools.some((school) => school.id === selectedSchoolDetail.properties.id)}
              compareFull={comparedSchools.length >= 3}
              onOpen={openSchoolDetail}
            />
          )}
        </div>
      </aside>

      {/* Floating Tombol Bandingkan */}
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

      {/* Status Loading / Error */}
      {(error || (loading && !loaded)) && (
        <div className="explorer-data-status space-y-2">
          {loading && !loaded && (
            <GeoLoader className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-4 py-2.5 shadow" label="Memuat data sekolah Bogor…" />
          )}
          {error && (
            <div role="alert" className="pointer-events-auto bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-2.5 shadow flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={loadPublic} className="font-bold underline whitespace-nowrap">
                Coba lagi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Kanvas Peta */}
      <main className="explorer-map">
        <Suspense fallback={<div className="explorer-map-loading"><GeoLoader label="Membuka peta…" /></div>}>
          <MapCanvas
            schools={filteredCollection}
            publicExplorer
            publicLayers={activeLayers}
            population={population}
            publicBlankSpots={blankSpots}
            panelOpen={isSidebarOpen}
            onSchoolSelect={openSchoolDetail}
            onOpenLayers={() => setLayersPopoverOpen((open) => !open)}
            userLocation={userLocation}
            radiusKm={radiusKm}
            pickLocationMode={pickLocationMode}
            onPickLocation={(loc) => applyUserLocation(loc, radiusKm)}
            focusedSchoolCoords={activeFocusedCoords}
          />
        </Suspense>
      </main>

      <CompareModal />
    </div>
  );
}
