import GeoLoader from '../ui/GeoLoader';
import { useMemo, useState } from "react";
import { SlidersHorizontal, Search, ChevronRight } from "lucide-react";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";
import { rescoreFeatures, KATEGORI_URUT, colorOf, fmt } from "../../lib/analysis";
import { KategoriBadge, ErrorBox, InfoBox, inputCls, btnPrimary, btnGhost } from "../ui/kit";

export default function PrioritasPanel({ ringkasan, onPilihWilayah }) {
  const { prioritas, meta, weights, savedWeights, setWeight, resetWeights, saveWeights, recalculate } = useDataStore();
  const { selectedWilayahId } = useMapStore();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [q, setQ] = useState("");
  const [katFilter, setKatFilter] = useState("ALL");
  const [showWeights, setShowWeights] = useState(false);

  const scored = useMemo(
    () => rescoreFeatures(prioritas.features, weights, meta && meta.kategori),
    [prioritas, weights, meta]
  );
  const ranking = useMemo(
    () => [...scored].sort((a, b) => (a.properties.ranking_live ?? 999) - (b.properties.ranking_live ?? 999)),
    [scored]
  );

  const countsByKat = useMemo(() => {
    const c = { ALL: ranking.length };
    KATEGORI_URUT.forEach((k) => {
      c[k] = 0;
    });
    ranking.forEach((f) => {
      const k = f.properties.kategori_live;
      if (k) c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [ranking]);

  const filteredRanking = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ranking.filter((f) => {
      const p = f.properties;
      if (katFilter !== "ALL" && p.kategori_live !== katFilter) return false;
      if (query && !(p.nama_wilayah || "").toLowerCase().includes(query)) return false;
      return true;
    });
  }, [ranking, q, katFilter]);

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
          Skor prioritas belum dihitung. Pastikan batas kecamatan, sekolah, dan kependudukan sudah diunggah Operator.
        </InfoBox>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary} disabled={!!busy} onClick={() => run("hitung", () => recalculate(), "Analisis selesai dihitung.")}>
          {busy === "hitung" ? <GeoLoader label="Menghitung…" /> : "Hitung analisis sekarang"}
        </button>
      </div>
    );
  }

  const totalKelasRusak =
    (Number(ringkasan?.kelas_rusak_berat) || 0) + (Number(ringkasan?.kelas_rusak_sedang) || 0);

  return (
    <div>
      {ringkasan && (
        <section className="sh-overview-grid" aria-label="Ringkasan utama Bogor">
          <div className="sh-overview-stat">
            <div className="sh-overview-num">{fmt(ringkasan.sekolah)}</div>
            <div className="sh-overview-label">Sekolah SMP</div>
            <div className="sh-overview-sub">
              {ringkasan.sekolah_negeri ?? 0} Negeri · {ringkasan.sekolah_swasta ?? 0} Swasta
            </div>
          </div>
          <div className="sh-overview-stat">
            <div className="sh-overview-num is-amber">{fmt(ringkasan.gap_kursi)}</div>
            <div className="sh-overview-label">Kurang Kursi</div>
            <div className="sh-overview-sub">{fmt(ringkasan.kecamatan)} kecamatan</div>
          </div>
          <div className="sh-overview-stat">
            <div className="sh-overview-num is-rose">{fmt(totalKelasRusak)}</div>
            <div className="sh-overview-label">Kelas Rusak</div>
            <div className="sh-overview-sub">{fmt(ringkasan.kelas_rusak_berat ?? 0)} rusak berat</div>
          </div>
        </section>
      )}

      <section className="sh-section">
        <div className="sh-section-head">
          <h2 className="sh-section-title">Peringkat Kebutuhan Kecamatan</h2>
          <button
            onClick={() => setShowWeights((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6F5F] hover:underline"
          >
            <SlidersHorizontal size={13} />
            <span>{showWeights ? "Tutup bobot" : "Atur bobot"}</span>
          </button>
        </div>

        {(showWeights || dirty) && (
          <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">Bobot 7 Kriteria MCDA</span>
              <span className="text-slate-600">Total {fmt(total, 0)}% → 100%</span>
            </div>
            {Object.entries(groups).map(([kelompok, list]) => (
              <div key={kelompok} className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-[#1F6F5F]">{kelompok}</p>
                {list.map((i) => (
                  <div key={i.kode}>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor={`w-${i.kode}`} className="text-slate-700" title={i.deskripsi}>
                        {i.nama}
                      </label>
                      <span className="font-semibold text-slate-900">{fmt(weights[i.kode], 0)}%</span>
                    </div>
                    <input
                      id={`w-${i.kode}`}
                      type="range"
                      min="0"
                      max="100"
                      value={weights[i.kode] ?? 0}
                      onChange={(e) => setWeight(i.kode, e.target.value)}
                      className="sh-range"
                    />
                  </div>
                ))}
              </div>
            ))}
            <ErrorBox message={error} onClose={() => setError("")} />
            {ok && <p className="text-xs font-medium text-emerald-800" role="status">{ok}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button className={btnPrimary} disabled={!dirty || !!busy || total <= 0} onClick={() => run("simpan", saveWeights, "Bobot disimpan.")}>
                {busy === "simpan" ? <GeoLoader label="Menyimpan…" /> : "Simpan bobot"}
              </button>
              <button className={btnGhost} disabled={!dirty || !!busy} onClick={resetWeights}>
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Cari nama kecamatan..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setKatFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                katFilter === "ALL"
                  ? "bg-[#132a25] text-white border-[#132a25]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Semua ({countsByKat.ALL})
            </button>
            {KATEGORI_URUT.map((k) => (
              <button
                key={k}
                onClick={() => setKatFilter(katFilter === k ? "ALL" : k)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  katFilter === k
                    ? "bg-[#132a25] text-white border-[#132a25]"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: colorOf(k) }} />
                <span>{k} ({countsByKat[k] || 0})</span>
              </button>
            ))}
          </div>
        </div>

        <ol className="sh-list">
          {filteredRanking.map((f) => {
            const p = f.properties;
            const m = p.metrik || {};
            const active = String(selectedWilayahId) === String(p.id_wilayah);
            const rusak = (Number(m.ruang_kelas_rusak_berat) || 0) + (Number(m.ruang_kelas_rusak_sedang) || 0);
            const gap = Number(m.gap_kursi) || 0;
            return (
              <li key={p.id_wilayah} className={`sh-list-item ${active ? "is-selected" : ""}`}>
                <button
                  onClick={() => onPilihWilayah(p.id_wilayah)}
                  className="w-full text-left flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 w-6 shrink-0">#{p.ranking_live ?? "-"}</span>
                      <span className="text-[14px] font-semibold text-slate-900 truncate">Kec. {p.nama_wilayah}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 pl-8 truncate">
                      {gap > 0 ? `Kurang ${fmt(gap)} kursi` : `${fmt(m.jumlah_sekolah ?? 0)} sekolah`}
                      {rusak > 0 ? ` · ${fmt(rusak)} kelas rusak` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-[14px] font-bold" style={{ color: p.color }}>
                        {p.skor === null ? "-" : fmt(p.skor, 1)}
                      </div>
                    </div>
                    <KategoriBadge kategori={p.kategori_live} />
                    <ChevronRight size={15} className="text-slate-400" />
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
