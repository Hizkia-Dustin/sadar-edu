import { useMemo, useState } from "react";
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
  const { selectedCandidateId, setSelectedCandidateId, flyToBounds, toggleLayer, activeLayers } = useMapStore();
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
    flyToBounds(bboxOf(f.geometry));
  };

  return (
    <div className="space-y-4">
      <InfoBox>
        Area kandidat adalah sel grid di kecamatan prioritas yang paling sesuai berdasarkan jarak ke sekolah eksisting,
        akses jalan, risiko bencana, dan kemiringan lereng. Ini bahan pertimbangan, bukan penetapan lahan; status
        kepemilikan dan tata ruang tetap perlu diverifikasi.
      </InfoBox>

      <section className="space-y-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="cakupan">Cakupan</label>
          <select id="cakupan" className={inputCls} value={form.cakupan} onChange={set("cakupan")}>
            <option value="teratas">Kecamatan peringkat teratas</option>
            <option value="terpilih" disabled={!wilayahId}>
              {namaWilayah ? `Hanya Kec. ${namaWilayah}` : "Hanya kecamatan terpilih (pilih dulu)"}
            </option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1" htmlFor="tw">Jml kecamatan</label>
            <input id="tw" className={inputCls} type="number" min="1" max="40" value={form.top_wilayah} onChange={set("top_wilayah")} disabled={form.cakupan === "terpilih"} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1" htmlFor="tn">Maks. lokasi</label>
            <input id="tn" className={inputCls} type="number" min="1" max="50" value={form.top_n} onChange={set("top_n")} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1" htmlFor="ck">Sel (km)</label>
            <input id="ck" className={inputCls} type="number" min="0.2" max="5" step="0.1" value={form.cell_km} onChange={set("cell_km")} />
          </div>
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1" htmlFor="mj">Min. jarak ke sekolah (km)</label>
              <input id="mj" className={inputCls} type="number" min="0" step="0.1" value={form.min_jarak} onChange={set("min_jarak")} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1" htmlFor="ml">Maks. lereng (%)</label>
              <input id="ml" className={inputCls} type="number" min="0" step="1" value={form.max_lereng} onChange={set("max_lereng")} />
            </div>
          </div>
        </div>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary} onClick={generate} disabled={busy}>
          {busy ? "Menganalisis..." : "Buat area kandidat"}
        </button>
        {hasil && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 space-y-1">
            <p>{fmt(hasil.sel_layak)} dari {fmt(hasil.sel_dianalisis)} sel layak; {fmt(hasil.kandidat_tersimpan)} lokasi terbaik disimpan.</p>
            {hasil.catatan.map((c) => <p key={c} className="text-amber-700">⚠ {c}</p>)}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daftar kandidat ({list.length})</h3>
        {list.length === 0 && <p className="text-xs text-slate-400">Belum ada kandidat. Buat dengan tombol di atas.</p>}
        <ul className="space-y-2">
          {list.map((f, i) => {
            const p = f.properties;
            const d = p.detail || {};
            const active = selectedCandidateId === p.id_candidate;
            return (
              <li key={p.id_candidate} className={`rounded-xl border p-3 bg-white ${active ? "border-violet-500 ring-1 ring-violet-300" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => fokus(f)} className="text-left text-xs font-bold text-slate-800 hover:text-violet-700">
                    #{i + 1} · Kec. {p.nama_wilayah}
                  </button>
                  <span className="text-xs font-bold text-violet-700 tabular-nums">{fmt(p.skor_suitability, 1)}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fmt(d.jarak_sekolah_km, 1)} km dari sekolah terdekat
                  {d.jarak_jalan_km !== null && d.jarak_jalan_km !== undefined ? ` · ${fmt(d.jarak_jalan_km, 2)} km ke jalan` : ""}
                  {d.lereng_pct !== null && d.lereng_pct !== undefined ? ` · lereng ${fmt(d.lereng_pct, 0)}%` : ""}
                  {d.risiko_level ? ` · risiko ${d.risiko_level}/5` : ""}
                </p>
                {active && d.komponen && (
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(d.komponen).filter(([, v]) => v !== null).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>{KOMPONEN[k] || k}</span><span>{fmt(v * 100, 0)}%</span></div>
                        <Bar value={v * 100} color="#7c3aed" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <select
                    aria-label="Status kandidat"
                    className="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 bg-white"
                    value={p.status_kandidat}
                    onChange={(e) => ubahStatus(p.id_candidate, e.target.value)}
                  >
                    {STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button
                    className="text-[11px] font-semibold text-[#1F6F5F] hover:underline"
                    onClick={() => onSimulasi({ tipe: "Sekolah Baru", id_candidate: p.id_candidate, id_wilayah: p.id_wilayah })}
                  >
                    Simulasikan sekolah di sini
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
