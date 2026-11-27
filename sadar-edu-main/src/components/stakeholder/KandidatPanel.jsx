import GeoLoader from '../ui/GeoLoader';
import { useMemo, useState } from "react";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";
import { fmt } from "../../lib/analysis";
import { ErrorBox, InfoBox, Bar, inputCls, btnPrimary } from "../ui/kit";

const STATUS = ["Rekomendasi", "Dipertimbangkan", "Disetujui", "Ditolak"];
const KOMPONEN = {
  jarak_sekolah: "Jarak ke sekolah (mengisi blank spot)",
  akses_jalan: "Akses jalan",
  risiko_bencana: "Keamanan dari bencana",
  lereng: "Kelandaian lahan",
  prioritas_wilayah: "Prioritas kecamatan",
};

function bboxOf(geometry) {
  const pts = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates.flat(2);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export default function KandidatPanel({ wilayahId, onSimulasi }) {
  const { candidates, loadCandidates, kecamatan } = useDataStore();
  const { selectedCandidateId, setSelectedCandidateId, setSelectedWilayahId, flyToBounds, toggleLayer, activeLayers } = useMapStore();
  const [form, setForm] = useState({ cakupan: "teratas", top_wilayah: 5, top_n: 10, cell_km: 1, min_jarak: 1, max_lereng: 25 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState(null);

  const list = useMemo(
    () => [...candidates.features].sort((a, b) => b.properties.skor_suitability - a.properties.skor_suitability),
    [candidates]
  );
  const namaWilayah = kecamatan.find((k) => k.id === String(wilayahId))?.name;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const generate = async () => {
    setBusy(true);
    setError("");
    setHasil(null);
    try {
      const body = {
        top_wilayah: Number(form.top_wilayah),
        top_n: Number(form.top_n),
        cell_km: Number(form.cell_km),
        batas: { MIN_JARAK_SEKOLAH_KM: Number(form.min_jarak), MAX_LERENG_PCT: Number(form.max_lereng) },
      };
      if (form.cakupan === "terpilih" && wilayahId) body.id_wilayah = Number(wilayahId);
      const res = await api.post("/candidate-areas/generate", body);
      setHasil(res.data);
      await loadCandidates();
      if (!activeLayers.showCandidates) toggleLayer("showCandidates");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ubahStatus = async (id, status) => {
    setError("");
    try {
      await api.patch(`/candidate-areas/${id}`, { status_kandidat: status });
      await loadCandidates();
    } catch (e) {
      setError(e.message);
    }
  };

  const fokus = (f) => {
    setSelectedCandidateId(f.properties.id_candidate);
    if (f.properties.id_wilayah) setSelectedWilayahId(f.properties.id_wilayah);
    flyToBounds(bboxOf(f.geometry));
  };

  return (
    <div>
      <section className="sh-section">
        <details className="sh-details" open={list.length === 0}>
          <summary>
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[#1F6F5F]" />
              <span>Parameter Analisis Area Kandidat</span>
            </span>
            <span className="text-xs font-medium text-slate-600">Sel {form.cell_km} km</span>
          </summary>
          <div className="sh-details-body space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Sel grid dievaluasi berdasarkan jarak ke sekolah eksisting (blank spot), akses jalan, risiko bencana, dan kemiringan lereng.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="cakupan">
                Cakupan Analisis
              </label>
              <select id="cakupan" className={inputCls} value={form.cakupan} onChange={set("cakupan")}>
                <option value="teratas">Kecamatan peringkat teratas</option>
                <option value="terpilih" disabled={!wilayahId}>
                  {namaWilayah ? `Hanya Kec. ${namaWilayah}` : "Hanya kecamatan terpilih (pilih dulu)"}
                </option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="tw">Jml kec.</label>
                <input id="tw" className={inputCls} type="number" min="1" max="46" value={form.top_wilayah} onChange={set("top_wilayah")} disabled={form.cakupan === "terpilih"} />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="tn">Maks. lokasi</label>
                <input id="tn" className={inputCls} type="number" min="1" max="50" value={form.top_n} onChange={set("top_n")} />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="ck">Sel (km)</label>
                <input id="ck" className={inputCls} type="number" min="0.2" max="5" step="0.1" value={form.cell_km} onChange={set("cell_km")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="mj">Min. jarak sekolah (km)</label>
                <input id="mj" className={inputCls} type="number" min="0" step="0.1" value={form.min_jarak} onChange={set("min_jarak")} />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="ml">Maks. lereng (%)</label>
                <input id="ml" className={inputCls} type="number" min="0" step="1" value={form.max_lereng} onChange={set("max_lereng")} />
              </div>
            </div>
            <ErrorBox message={error} onClose={() => setError("")} />
            <button className={`${btnPrimary} w-full`} onClick={generate} disabled={busy}>
              {busy ? <GeoLoader label="Menganalisis kesesuaian lahan…" /> : "Hitung ulang area kandidat"}
            </button>
          </div>
        </details>

        {hasil && (
          <div className="mt-2.5 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 space-y-1">
            <p>
              <strong>{fmt(hasil.sel_layak)}</strong> dari {fmt(hasil.sel_dianalisis)} sel memenuhi syarat;{" "}
              <strong>{fmt(hasil.kandidat_tersimpan)}</strong> lokasi terbaik disimpan.
            </p>
            {hasil.catatan.map((c) => (
              <p key={c} className="text-amber-800">{c}</p>
            ))}
          </div>
        )}
      </section>

      <section className="sh-section">
        <div className="sh-section-head">
          <h2 className="sh-section-title">Daftar Area Kandidat Sekolah Baru</h2>
          <span className="sh-section-meta">{list.length} lokasi</span>
        </div>

        {list.length === 0 ? (
          <InfoBox>Belum ada area kandidat. Buka panel parameter di atas lalu jalankan analisis kandidat.</InfoBox>
        ) : (
          <ol className="sh-list">
            {list.map((f, i) => {
              const p = f.properties;
              const d = p.detail || {};
              const active = selectedCandidateId === p.id_candidate;
              return (
                <li key={p.id_candidate} className={`sh-list-item px-1 ${active ? "is-selected" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => fokus(f)} className="text-left text-[13px] font-semibold text-slate-900 hover:text-[#1F6F5F]">
                      <span className="text-slate-500 font-bold mr-2">#{i + 1}</span>
                      Kec. {p.nama_wilayah}
                    </button>
                    <span className="text-xs font-bold text-[#1F6F5F]">Skor {fmt(p.skor_suitability, 1)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {fmt(d.jarak_sekolah_km, 1)} km dari sekolah terdekat
                    {d.jarak_jalan_km !== null && d.jarak_jalan_km !== undefined ? ` · ${fmt(d.jarak_jalan_km, 2)} km ke jalan` : ""}
                    {d.lereng_pct !== null && d.lereng_pct !== undefined ? ` · lereng ${fmt(d.lereng_pct, 0)}%` : ""}
                    {d.risiko_level ? ` · risiko ${d.risiko_level}/5` : ""}
                  </p>
                  {active && d.komponen && (
                    <div className="mt-2.5 mb-2 space-y-2 bg-white border border-slate-200 rounded-lg p-2.5">
                      {Object.entries(d.komponen)
                        .filter(([, v]) => v !== null)
                        .map(([k, v]) => (
                          <div key={k}>
                            <div className="flex justify-between text-xs text-slate-700 mb-1">
                              <span>{KOMPONEN[k] || k}</span>
                              <span className="font-semibold">{fmt(v * 100, 0)}%</span>
                            </div>
                            <Bar value={v * 100} color="#1F6F5F" />
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <select
                      aria-label="Status kandidat"
                      className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 font-medium"
                      value={p.status_kandidat}
                      onChange={(e) => ubahStatus(p.id_candidate, e.target.value)}
                    >
                      {STATUS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6F5F] hover:underline"
                      onClick={() => onSimulasi({ tipe: "Sekolah Baru", id_candidate: p.id_candidate, id_wilayah: p.id_wilayah })}
                    >
                      <span>Simulasikan di sini</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
