import { useMemo, useState } from "react";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";
import { rescoreFeatures, KATEGORI_URUT, colorOf, fmt } from "../../lib/analysis";
import { KategoriBadge, ErrorBox, InfoBox, Bar, btnPrimary, btnGhost } from "../ui/kit";

export default function PrioritasPanel({ onPilihWilayah }) {
  const { prioritas, meta, weights, savedWeights, setWeight, resetWeights, saveWeights, recalculate } = useDataStore();
  const { selectedWilayahId } = useMapStore();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const scored = useMemo(
    () => rescoreFeatures(prioritas.features, weights, meta && meta.kategori),
    [prioritas, weights, meta]
  );
  const ranking = useMemo(
    () => [...scored].sort((a, b) => (a.properties.ranking_live ?? 999) - (b.properties.ranking_live ?? 999)),
    [scored]
  );

  const groups = useMemo(() => {
    const g = {};
    (meta ? meta.indikator : []).forEach((i) => {
      const k = i.kelompok || "Lainnya";
      (g[k] = g[k] || []).push(i);
    });
    return g;
  }, [meta]);

  const dirty = Object.keys(weights).some((k) => weights[k] !== savedWeights[k]);
  const total = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);

  const run = async (label, fn, success) => {
    setBusy(label);
    setError("");
    setOk("");
    try {
      await fn();
      setOk(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  if (!meta) return null;

  if (!meta.sudah_dihitung) {
    return (
      <div className="space-y-3">
        <InfoBox tone="amber">
          Skor prioritas belum dihitung. Pastikan batas kecamatan, sekolah, statistik, dan data kependudukan sudah diunggah
          Operator, lalu jalankan perhitungan.
        </InfoBox>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary} disabled={!!busy} onClick={() => run("hitung", () => recalculate(), "Analisis selesai dihitung.")}>
          {busy ? "Menghitung..." : "Hitung analisis sekarang"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bobot kriteria (MCDA)</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Geser bobot untuk melihat perubahan peta dan ranking seketika. Total otomatis dinormalkan ({fmt(total, 0)}% → 100%).
          Klik <strong>Simpan bobot</strong> agar tersimpan di server.
        </p>
        {Object.entries(groups).map(([kelompok, list]) => (
          <div key={kelompok} className="mb-3">
            <p className="text-[11px] font-semibold text-[#1F6F5F] mb-1.5">{kelompok}</p>
            {list.map((i) => (
              <div key={i.kode} className="mb-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`w-${i.kode}`} className="font-medium text-slate-700" title={i.deskripsi}>{i.nama}</label>
                  <span className="font-bold text-[#1F6F5F] tabular-nums">{fmt(weights[i.kode], 0)}%</span>
                </div>
                <input
                  id={`w-${i.kode}`}
                  type="range"
                  min="0"
                  max="100"
                  value={weights[i.kode] ?? 0}
                  onChange={(e) => setWeight(i.kode, e.target.value)}
                  className="w-full accent-[#1F6F5F] cursor-pointer"
                />
              </div>
            ))}
          </div>
        ))}
        <ErrorBox message={error} onClose={() => setError("")} />
        {ok && <p className="text-xs text-emerald-700 mb-2" role="status">{ok}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={!dirty || !!busy || total <= 0} onClick={() => run("simpan", saveWeights, "Bobot disimpan.")}>
            {busy === "simpan" ? "Menyimpan..." : "Simpan bobot"}
          </button>
          <button className={btnGhost} disabled={!dirty || !!busy} onClick={resetWeights}>Reset</button>
        </div>
        {dirty && (
          <p className="text-[11px] text-amber-700 mt-2">
            Pratinjau: bobot belum disimpan. Diagnosis teks di bawah masih memakai bobot tersimpan.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Peringkat kebutuhan kecamatan</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
          {KATEGORI_URUT.map((k) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colorOf(k) }} /> {k}
            </span>
          ))}
        </div>
        <ol className="space-y-1">
          {ranking.map((f) => {
            const p = f.properties;
            const active = String(selectedWilayahId) === String(p.id_wilayah);
            return (
              <li key={p.id_wilayah}>
                <button
                  onClick={() => onPilihWilayah(p.id_wilayah)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                    active ? "border-[#1F6F5F] bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      <span className="text-slate-400 tabular-nums mr-1.5">{p.ranking_live ?? "-"}.</span>
                      {p.nama_wilayah}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>{p.skor === null ? "-" : fmt(p.skor, 1)}</span>
                      <KategoriBadge kategori={p.kategori_live} />
                    </span>
                  </div>
                  <div className="mt-1.5"><Bar value={p.skor || 0} color={p.color} /></div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
