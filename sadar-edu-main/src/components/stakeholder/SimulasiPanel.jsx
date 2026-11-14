import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useDataStore } from "../../store/useDataStore";
import { fmt } from "../../lib/analysis";
import { KategoriBadge, ErrorBox, InfoBox, inputCls, btnPrimary, btnGhost } from "../ui/kit";

const TIPE = ["Sekolah Baru", "Penambahan Ruang Kelas", "Penambahan Guru", "Kombinasi"];

function Delta({ before, after, d = 1, lowerIsBetter = true }) {
  const diff = (after ?? 0) - (before ?? 0);
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <span className={`tabular-nums ${diff === 0 ? "text-slate-400" : good ? "text-emerald-700" : "text-red-600"}`}>
      {diff > 0 ? "+" : ""}{fmt(diff, d)}
    </span>
  );
}

export default function SimulasiPanel({ preset, wilayahId }) {
  const { kecamatan, meta, candidates } = useDataStore();
  const [form, setForm] = useState({
    id_wilayah: wilayahId || "", tipe: "Sekolah Baru", sekolah_baru: 1, ruang_kelas: 0, guru: 0, id_candidate: "", serap: true, nama: "",
  });
  const [hasil, setHasil] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Terapkan preset dari panel diagnosis / kandidat
  useEffect(() => {
    if (!preset) return;
    setForm((f) => ({
      ...f,
      id_wilayah: preset.id_wilayah || f.id_wilayah || wilayahId || "",
      tipe: preset.tipe || f.tipe,
      sekolah_baru: preset.tipe === "Sekolah Baru" ? Math.max(1, Math.min(preset.jumlah || 1, 50)) : 0,
      ruang_kelas: preset.tipe === "Penambahan Ruang Kelas" ? Math.min(preset.jumlah || 0, 1000) : 0,
      guru: preset.tipe === "Penambahan Guru" ? Math.min(preset.jumlah || 0, 1000) : 0,
      id_candidate: preset.id_candidate || "",
    }));
    setHasil(null);
  }, [preset, wilayahId]);

  useEffect(() => {
    if (wilayahId) setForm((f) => (f.id_wilayah ? f : { ...f, id_wilayah: wilayahId }));
  }, [wilayahId]);

  const kandidatWilayah = useMemo(
    () => candidates.features.filter((c) => String(c.properties.id_wilayah) === String(form.id_wilayah)),
    [candidates, form.id_wilayah]
  );

  const loadRiwayat = useCallback(async () => {
    if (!form.id_wilayah) return setRiwayat([]);
    try {
      const res = await api.get("/simulasi/scenarios", { id_wilayah: form.id_wilayah });
      setRiwayat(res.data);
    } catch {
      setRiwayat([]);
    }
  }, [form.id_wilayah]);
  useEffect(() => { loadRiwayat(); }, [loadRiwayat]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const jalankan = async (simpan) => {
    setBusy(simpan ? "simpan" : "hitung");
    setError("");
    try {
      const res = await api.post("/simulasi/scenarios", {
        id_wilayah: Number(form.id_wilayah),
        nama_scenario: form.nama || undefined,
        tipe_intervensi: form.tipe,
        simpan,
        parameter_json: {
          sekolah_baru: Number(form.sekolah_baru) || 0,
          ruang_kelas: Number(form.ruang_kelas) || 0,
          guru: Number(form.guru) || 0,
          id_candidate: form.id_candidate ? Number(form.id_candidate) : undefined,
          serap_kebutuhan: form.serap,
        },
      });
      setHasil(res);
      if (simpan) {
        setForm((f) => ({ ...f, nama: "" }));
        loadRiwayat();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const hapus = async (id) => {
    try {
      await api.del(`/simulasi/scenarios/${id}`);
      loadRiwayat();
    } catch (e) {
      setError(e.message);
    }
  };

  const sim = hasil && hasil.simulasi;
  const indMeta = Object.fromEntries((meta ? meta.indikator : []).map((i) => [i.kode, i]));
  const showSekolah = form.tipe === "Sekolah Baru" || form.tipe === "Kombinasi";
  const showKelas = form.tipe === "Penambahan Ruang Kelas" || form.tipe === "Kombinasi";
  const showGuru = form.tipe === "Penambahan Guru" || form.tipe === "Kombinasi";

  return (
    <div className="space-y-4">
      <InfoBox>
        Simulasi sederhana: bagaimana skor prioritas dan kekurangan kursi berubah jika kapasitas ditambah. Hasil bergantung
        pada asumsi parameter ({meta ? `${meta.parameter.siswa_per_rombel} siswa/rombel, sekolah baru = ${meta.parameter.sekolah_baru_ruang_kelas} kelas & ${meta.parameter.sekolah_baru_guru} guru` : "..."}).
      </InfoBox>

      <section className="space-y-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="sw">Kecamatan</label>
          <select id="sw" className={inputCls} value={form.id_wilayah} onChange={set("id_wilayah")}>
            <option value="">Pilih kecamatan...</option>
            {kecamatan.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="st">Jenis intervensi</label>
          <select id="st" className={inputCls} value={form.tipe} onChange={set("tipe")}>
            {TIPE.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {showSekolah && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1" htmlFor="ssb">Sekolah baru</label>
              <input id="ssb" type="number" min="0" max="50" className={inputCls} value={form.sekolah_baru} onChange={set("sekolah_baru")} />
            </div>
          )}
          {showKelas && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1" htmlFor="srk">+ Ruang kelas</label>
              <input id="srk" type="number" min="0" max="1000" className={inputCls} value={form.ruang_kelas} onChange={set("ruang_kelas")} />
            </div>
          )}
          {showGuru && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1" htmlFor="sg">+ Guru</label>
              <input id="sg" type="number" min="0" max="1000" className={inputCls} value={form.guru} onChange={set("guru")} />
            </div>
          )}
        </div>
        {showSekolah && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-1" htmlFor="sc">Lokasi sekolah baru (opsional)</label>
            <select id="sc" className={inputCls} value={form.id_candidate} onChange={set("id_candidate")}>
              <option value="">Tanpa lokasi (efek akses tidak dihitung)</option>
              {kandidatWilayah.map((c) => (
                <option key={c.properties.id_candidate} value={c.properties.id_candidate}>
                  Kandidat #{c.properties.id_candidate} (skor {fmt(c.properties.skor_suitability, 1)})
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 text-[11px] text-slate-600">
          <input type="checkbox" checked={form.serap} onChange={set("serap")} className="accent-[#1F6F5F]" />
          Kapasitas baru terisi oleh anak usia SMP yang belum tertampung
        </label>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary} disabled={!form.id_wilayah || !!busy} onClick={() => jalankan(false)}>
          {busy === "hitung" ? "Menghitung..." : "Hitung pratinjau"}
        </button>
      </section>

      {sim && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Hasil: Kec. {hasil.wilayah.nama_wilayah}</h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[["Sebelum", sim.before], ["Sesudah", sim.after]].map(([label, s]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="text-xl font-bold text-slate-800 tabular-nums">{fmt(s.skor, 1)}</p>
                <KategoriBadge kategori={s.kategori} />
                <p className="text-[11px] text-slate-500 mt-1">Kekurangan {fmt(s.gap_kursi)} kursi</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            Skor berubah <strong><Delta before={sim.before.skor} after={sim.after.skor} d={1} /></strong> poin; kekurangan kursi berubah{" "}
            <strong><Delta before={sim.before.gap_kursi} after={sim.after.gap_kursi} d={0} /></strong>. Tambahan: {fmt(sim.tambahan.sekolah)} sekolah,{" "}
            {fmt(sim.tambahan.ruang_kelas)} ruang kelas, {fmt(sim.tambahan.guru)} guru (+{fmt(sim.tambahan.kapasitas_kursi)} kursi).
          </p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-slate-400"><th className="font-medium py-1">Indikator</th><th className="font-medium text-right">Sebelum</th><th className="font-medium text-right">Sesudah</th><th className="font-medium text-right">Δ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(sim.before.indikator).map((k) => (
                <tr key={k}>
                  <td className="py-1 text-slate-600">{(indMeta[k] || {}).nama || k}</td>
                  <td className="text-right tabular-nums">{fmt(sim.before.indikator[k], 1)}</td>
                  <td className="text-right tabular-nums">{fmt(sim.after.indikator[k], 1)}</td>
                  <td className="text-right"><Delta before={sim.before.indikator[k]} after={sim.after.indikator[k]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasil.catatan.map((c) => <InfoBox key={c} tone="amber">{c}</InfoBox>)}
          {!hasil.scenario && (
            <div className="flex gap-2 items-center">
              <input aria-label="Nama skenario" className={inputCls} placeholder="Nama skenario (mis. 2 SMP baru di Cileungsi)" value={form.nama} onChange={set("nama")} />
              <button className={btnGhost} disabled={!form.nama.trim() || !!busy} onClick={() => jalankan(true)}>
                {busy === "simpan" ? "..." : "Simpan"}
              </button>
            </div>
          )}
          {hasil.scenario && <p className="text-xs text-emerald-700">Skenario “{hasil.scenario.nama_scenario}” tersimpan.</p>}
        </section>
      )}

      {riwayat.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Skenario tersimpan</h3>
          <ul className="space-y-1.5">
            {riwayat.map((r) => (
              <li key={r.id_scenario} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg bg-white px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{r.nama_scenario}</p>
                  <p className="text-[11px] text-slate-500">{r.tipe_intervensi} · skor {fmt(r.skor_sebelum, 1)} → {fmt(r.skor_sesudah, 1)}</p>
                </div>
                <button onClick={() => hapus(r.id_scenario)} className="text-[11px] text-red-500 hover:text-red-700 font-semibold">Hapus</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
