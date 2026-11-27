import GeoLoader from '../ui/GeoLoader';
import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useDataStore } from "../../store/useDataStore";
import { fmt } from "../../lib/analysis";
import { KategoriBadge, ErrorBox, InfoBox, inputCls, btnPrimary, btnGhost } from "../ui/kit";

const TIPE = ["Sekolah Baru", "Penambahan Ruang Kelas", "Rehabilitasi Ruang Kelas", "Penambahan Guru", "Kombinasi"];

function Delta({ before, after, d = 1, lowerIsBetter = true }) {
  const diff = (after ?? 0) - (before ?? 0);
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <span className={`font-semibold ${diff === 0 ? "text-slate-500" : good ? "text-emerald-800" : "text-red-700"}`}>
      {diff > 0 ? "+" : ""}
      {fmt(diff, d)}
    </span>
  );
}

export default function SimulasiPanel({ preset, wilayahId }) {
  const { kecamatan, meta, candidates } = useDataStore();
  const [form, setForm] = useState(() => ({
    id_wilayah: String(preset?.id_wilayah || wilayahId || ""),
    tipe: preset?.tipe || "Sekolah Baru",
    sekolah_baru: preset ? (preset.tipe === "Sekolah Baru" ? Math.max(1, Math.min(preset.jumlah || 1, 50)) : 0) : 1,
    ruang_kelas: preset?.tipe === "Penambahan Ruang Kelas" ? Math.min(preset.jumlah || 0, 1000) : 0,
    rehab_kelas: preset?.tipe === "Rehabilitasi Ruang Kelas" ? Math.min(preset.jumlah || 0, 1000) : 0,
    guru: preset?.tipe === "Penambahan Guru" ? Math.min(preset.jumlah || 0, 1000) : 0,
    id_candidate: preset?.id_candidate || "",
    serap: true,
    nama: "",
  }));
  const [hasil, setHasil] = useState(null);
  const [riwayatMap, setRiwayatMap] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const kandidatWilayah = useMemo(
    () => candidates.features.filter((c) => String(c.properties.id_wilayah) === String(form.id_wilayah)),
    [candidates, form.id_wilayah]
  );

  const loadRiwayat = useCallback(async (idWil) => {
    const targetId = idWil ?? form.id_wilayah;
    if (!targetId) return;
    try {
      const res = await api.get("/simulasi/scenarios", { id_wilayah: targetId });
      setRiwayatMap((prev) => ({ ...prev, [targetId]: res.data }));
    } catch {
      setRiwayatMap((prev) => ({ ...prev, [targetId]: [] }));
    }
  }, [form.id_wilayah]);

  useEffect(() => {
    if (!form.id_wilayah) return;
    let cancelled = false;
    api
      .get("/simulasi/scenarios", { id_wilayah: form.id_wilayah })
      .then((res) => {
        if (!cancelled) setRiwayatMap((prev) => ({ ...prev, [form.id_wilayah]: res.data }));
      })
      .catch(() => {
        if (!cancelled) setRiwayatMap((prev) => ({ ...prev, [form.id_wilayah]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [form.id_wilayah]);

  const riwayat = form.id_wilayah ? riwayatMap[form.id_wilayah] || [] : [];

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
          rehab_kelas: Number(form.rehab_kelas) || 0,
          guru: Number(form.guru) || 0,
          id_candidate: form.id_candidate ? Number(form.id_candidate) : undefined,
          serap_kebutuhan: form.serap,
        },
      });
      setHasil(res);
      if (simpan) {
        setForm((f) => ({ ...f, nama: "" }));
        await loadRiwayat(form.id_wilayah);
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
      await loadRiwayat(form.id_wilayah);
    } catch (e) {
      setError(e.message);
    }
  };

  const sim = hasil && hasil.simulasi;
  const indMeta = Object.fromEntries((meta ? meta.indikator : []).map((i) => [i.kode, i]));
  const showSekolah = form.tipe === "Sekolah Baru" || form.tipe === "Kombinasi";
  const showKelas = form.tipe === "Penambahan Ruang Kelas" || form.tipe === "Kombinasi";
  const showRehab = form.tipe === "Rehabilitasi Ruang Kelas" || form.tipe === "Kombinasi";
  const showGuru = form.tipe === "Penambahan Guru" || form.tipe === "Kombinasi";

  return (
    <div>
      <section className="sh-section">
        <div className="sh-section-head">
          <h2 className="sh-section-title">Parameter Skenario Intervensi</h2>
          <span className="sh-section-meta">
            {meta ? `${meta.parameter.siswa_per_rombel} siswa/rombel` : ""}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="sw">
              Kecamatan Sasaran
            </label>
            <select id="sw" className={inputCls} value={form.id_wilayah} onChange={set("id_wilayah")}>
              <option value="">Pilih kecamatan...</option>
              {kecamatan.map((k) => (
                <option key={k.id} value={k.id}>
                  Kec. {k.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="st">
              Jenis Intervensi
            </label>
            <select id="st" className={inputCls} value={form.tipe} onChange={set("tipe")}>
              {TIPE.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {showSekolah && (
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="ssb">
                  Sekolah baru (unit)
                </label>
                <input id="ssb" type="number" min="0" max="50" className={inputCls} value={form.sekolah_baru} onChange={set("sekolah_baru")} />
              </div>
            )}
            {showKelas && (
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="srk">
                  + Ruang kelas baru
                </label>
                <input id="srk" type="number" min="0" max="1000" className={inputCls} value={form.ruang_kelas} onChange={set("ruang_kelas")} />
              </div>
            )}
            {showRehab && (
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="srek">
                  Rehab kelas rusak
                </label>
                <input id="srek" type="number" min="0" max="1000" className={inputCls} value={form.rehab_kelas} onChange={set("rehab_kelas")} />
              </div>
            )}
            {showGuru && (
              <div>
                <label className="block text-xs text-slate-700 mb-1" htmlFor="sg">
                  + Penempatan guru
                </label>
                <input id="sg" type="number" min="0" max="1000" className={inputCls} value={form.guru} onChange={set("guru")} />
              </div>
            )}
          </div>

          {showSekolah && (
            <div>
              <label className="block text-xs text-slate-700 mb-1" htmlFor="sc">
                Titik Lokasi Kandidat (opsional)
              </label>
              <select id="sc" className={inputCls} value={form.id_candidate} onChange={set("id_candidate")}>
                <option value="">Tanpa lokasi spesifik (efek blank spot tidak dihitung)</option>
                {kandidatWilayah.map((c) => (
                  <option key={c.properties.id_candidate} value={c.properties.id_candidate}>
                    Kandidat #{c.properties.id_candidate} (skor kesesuaian {fmt(c.properties.skor_suitability, 1)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.serap} onChange={set("serap")} className="accent-[#1F6F5F] w-3.5 h-3.5" />
            <span>Kapasitas baru menyerap anak usia SMP yang belum tertampung</span>
          </label>

          <ErrorBox message={error} onClose={() => setError("")} />
          <button className={`${btnPrimary} w-full`} disabled={!form.id_wilayah || !!busy} onClick={() => jalankan(false)}>
            {busy === "hitung" ? <GeoLoader label="Menghitung dampak intervensi…" /> : "Hitung dampak simulasi"}
          </button>
        </div>
      </section>

      {sim && (
        <section className="sh-section">
          <div className="sh-section-head">
            <h3 className="sh-section-title">Hasil Simulasi: Kec. {hasil.wilayah.nama_wilayah}</h3>
            <KategoriBadge kategori={sim.after.kategori} />
          </div>

          <dl className="sh-dl mb-3">
            <div className="sh-dl-row">
              <dt>Skor kebutuhan MCDA</dt>
              <dd>
                {fmt(sim.before.skor, 1)} → <strong>{fmt(sim.after.skor, 1)}</strong> (
                <Delta before={sim.before.skor} after={sim.after.skor} d={1} />)
              </dd>
            </div>
            <div className="sh-dl-row">
              <dt>Kategori prioritas</dt>
              <dd>
                {sim.before.kategori} → <strong>{sim.after.kategori}</strong>
              </dd>
            </div>
            <div className="sh-dl-row">
              <dt>Kekurangan kursi</dt>
              <dd>
                {fmt(sim.before.gap_kursi)} → <strong>{fmt(sim.after.gap_kursi)}</strong> (
                <Delta before={sim.before.gap_kursi} after={sim.after.gap_kursi} d={0} />)
              </dd>
            </div>
            <div className="sh-dl-row">
              <dt>Tambahan kapasitas efektif</dt>
              <dd className="text-[#1F6F5F]">+{fmt(sim.tambahan.kapasitas_kursi)} kursi</dd>
            </div>
          </dl>

          <table className="w-full text-xs border-t border-slate-200">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200">
                <th className="font-semibold py-2">Indikator</th>
                <th className="font-semibold text-right py-2">Sebelum</th>
                <th className="font-semibold text-right py-2">Sesudah</th>
                <th className="font-semibold text-right py-2">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(sim.before.indikator).map((k) => (
                <tr key={k}>
                  <td className="py-1.5 text-slate-700">{(indMeta[k] || {}).nama || k}</td>
                  <td className="text-right text-slate-600">{fmt(sim.before.indikator[k], 1)}</td>
                  <td className="text-right font-medium text-slate-900">{fmt(sim.after.indikator[k], 1)}</td>
                  <td className="text-right">
                    <Delta before={sim.before.indikator[k]} after={sim.after.indikator[k]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasil.catatan.map((c) => (
            <div key={c} className="mt-2.5">
              <InfoBox tone="amber">{c}</InfoBox>
            </div>
          ))}

          {!hasil.scenario ? (
            <div className="flex gap-2 items-center mt-3 pt-3 border-t border-slate-200">
              <input
                aria-label="Nama skenario"
                className={inputCls}
                placeholder="Simpan skenario (mis. 2 SMP baru Cileungsi)..."
                value={form.nama}
                onChange={set("nama")}
              />
              <button className={btnGhost} disabled={!form.nama.trim() || !!busy} onClick={() => jalankan(true)}>
                {busy === "simpan" ? <GeoLoader label="Menyimpan…" /> : "Simpan"}
              </button>
            </div>
          ) : (
            <p className="text-xs font-medium text-emerald-800 mt-3">
              Skenario “{hasil.scenario.nama_scenario}” telah disimpan.
            </p>
          )}
        </section>
      )}

      {riwayat.length > 0 && (
        <section className="sh-section">
          <div className="sh-section-head">
            <h3 className="sh-section-title">Riwayat Skenario Tersimpan</h3>
            <span className="sh-section-meta">{riwayat.length} skenario</span>
          </div>
          <ul className="sh-list">
            {riwayat.map((r) => (
              <li key={r.id_scenario} className="sh-list-item px-1 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{r.nama_scenario}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {r.tipe_intervensi} · Skor {fmt(r.skor_sebelum, 1)} → <strong>{fmt(r.skor_sesudah, 1)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => hapus(r.id_scenario)}
                  className="text-xs text-red-700 hover:text-red-900 font-semibold"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
