import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useDataStore } from "../../store/useDataStore";
import { fmt } from "../../lib/analysis";
import { ErrorBox, InfoBox, inputCls, btnPrimary } from "../ui/kit";

const CEK = [
  ["kecamatan", "Batas kecamatan", true],
  ["sekolah", "Sekolah", true],
  ["statistik", "Statistik sekolah", true],
  ["kependudukan", "Data kependudukan", true],
  ["jalan", "Jaringan jalan", false],
  ["risiko_bencana", "Risiko bencana", false],
  ["lereng", "Lereng / topografi", false],
  ["kawasan_lindung", "Kawasan lindung", false],
];

export default function AnalisisTab({ stale, onDone }) {
  const [status, setStatus] = useState(null);
  const [radius, setRadius] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState(null);

  const load = useCallback(async () => {
    try {
      setStatus((await api.get("/analisis/status")).data);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load, stale]);

  const hitung = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/analisis/hitung", { radius_km: Number(radius) });
      setHasil(res.data);
      await load();
      // Segarkan data peta bila sudah pernah dimuat pada sesi ini
      if (useDataStore.getState().loaded) await useDataStore.getState().reloadAnalysis();
      onDone && onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      {stale && <InfoBox tone="amber">Data berubah sejak perhitungan terakhir. Hitung ulang agar skor prioritas, diagnosis, dan blank spot mengikuti data terbaru.</InfoBox>}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Kesiapan data</h2>
        {!status ? <p className="text-xs text-slate-400">Memuat...</p> : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {CEK.map(([k, label, wajib]) => {
              const n = status[k];
              const ok = n > 0;
              return (
                <li key={k} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2 bg-slate-50">
                  <span className="text-slate-700">{label} {wajib ? <span className="text-red-400">*</span> : <span className="text-slate-400">(opsional)</span>}</span>
                  <span className={`font-bold tabular-nums ${ok ? "text-emerald-700" : wajib ? "text-red-600" : "text-slate-400"}`}>{ok ? fmt(n) : "belum ada"}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-3">* wajib untuk menghitung skor. Layer opsional hanya dipakai pada area kandidat; kriteria tanpa data otomatis dilewati.</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Hitung ulang analisis</h2>
        <p className="text-xs text-slate-500">Menghitung indikator tiap kecamatan (buffer jangkauan sekolah, jarak, rasio, kapasitas), normalisasi, skor MCDA, ranking, diagnosis, dan rekomendasi intervensi.</p>
        <div className="max-w-[200px]">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="rad">Radius jangkauan sekolah (km)</label>
          <input id="rad" type="number" min="0.5" max="20" step="0.5" className={inputCls} value={radius} onChange={(e) => setRadius(e.target.value)} />
        </div>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary} disabled={busy} onClick={hitung}>{busy ? "Menghitung (bisa beberapa detik)..." : "Hitung ulang sekarang"}</button>
        {hasil && (
          <p className="text-xs text-emerald-700" role="status">
            Selesai: {hasil.jumlah_wilayah} kecamatan dihitung (tahun {hasil.tahun}, radius {hasil.radius_km} km). <Link to="/stakeholder/dashboard" className="underline font-semibold">Buka dashboard analisis →</Link>
          </p>
        )}
      </section>
    </div>
  );
}
