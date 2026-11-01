import { useMemo } from "react";
import { useDataStore } from "../../store/useDataStore";
import { rescoreFeatures, fmt, colorOf } from "../../lib/analysis";
import { KategoriBadge, InfoBox, Bar } from "../ui/kit";

const TIPE_KE_SIMULASI = {
  "Sekolah Baru": "Sekolah Baru",
  "Penambahan Ruang Kelas": "Penambahan Ruang Kelas",
  "Penambahan Guru": "Penambahan Guru",
};

export default function DiagnosisPanel({ wilayahId, onSimulasi }) {
  const { prioritas, meta, weights } = useDataStore();

  const feature = useMemo(() => {
    const scored = rescoreFeatures(prioritas.features, weights, meta && meta.kategori);
    return scored.find((f) => String(f.properties.id_wilayah) === String(wilayahId));
  }, [prioritas, weights, meta, wilayahId]);

  if (!wilayahId || !feature) {
    return <InfoBox>Pilih kecamatan pada peta atau daftar peringkat untuk melihat diagnosis dan pilihan intervensi.</InfoBox>;
  }

  const p = feature.properties;
  const m = p.metrik || {};
  const rek = p.rekomendasi || { intervensi: [], faktor_utama: [] };
  const indikatorMeta = Object.fromEntries((meta ? meta.indikator : []).map((i) => [i.kode, i]));
  const totalW = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0) || 1;

  const rows = (p.indikator || [])
    .map((i) => {
      const im = indikatorMeta[i.kode] || {};
      const w = Number(weights[i.kode]) || 0;
      return { ...i, nama: im.nama || i.kode, satuan: im.satuan, kelompok: im.kelompok, kontribusi: i.norm === null ? 0 : (w / totalW) * i.norm * 100 };
    })
    .sort((a, b) => b.kontribusi - a.kontribusi);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-slate-800">Kec. {p.nama_wilayah}</h3>
          <KategoriBadge kategori={p.kategori_live} />
        </div>
        <p className="text-xs text-slate-500">
          Skor <strong style={{ color: p.color }}>{fmt(p.skor, 1)}</strong> / 100 · Peringkat {p.ranking_live ?? "-"} dari {prioritas.features.length}
        </p>
      </div>

      {p.diagnosis && <InfoBox tone="emerald">{p.diagnosis}</InfoBox>}

      <section>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kondisi layanan</h4>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {[
            ["Penduduk usia SMP", fmt(m.penduduk_usia_smp)],
            ["Sekolah SMP", fmt(m.jumlah_sekolah)],
            ["Siswa", fmt(m.jumlah_siswa)],
            ["Guru", fmt(m.jumlah_guru)],
            ["Ruang kelas", fmt(m.jumlah_ruang_kelas)],
            ["Estimasi kebutuhan kursi", fmt(m.demand_kursi)],
            ["Kapasitas kursi", fmt(m.kapasitas_kursi)],
            ["Kekurangan kursi", fmt(m.gap_kursi)],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              <dt className="text-[10px] text-slate-400">{k}</dt>
              <dd className="font-bold text-slate-800 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Faktor yang mempengaruhi skor</h4>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.kode}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-700">{r.nama}</span>
                <span className="text-slate-500 tabular-nums">
                  {r.raw === null ? "data belum ada" : `${fmt(r.raw, 1)} ${r.satuan || ""}`} · <strong style={{ color: colorOf(p.kategori_live) }}>+{fmt(r.kontribusi, 1)}</strong>
                </span>
              </div>
              <Bar value={r.kontribusi} max={Math.max(...rows.map((x) => x.kontribusi), 1)} color={p.color} />
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-400 mt-2">Angka tebal = kontribusi poin terhadap skor dengan bobot saat ini.</p>
      </section>

      <section>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilihan intervensi</h4>
        <ul className="space-y-2">
          {(rek.intervensi || []).map((it) => (
            <li key={it.tipe} className="border border-slate-200 rounded-xl p-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">
                  {it.tipe}{it.jumlah ? ` · ±${fmt(it.jumlah)}` : ""}
                </p>
                {TIPE_KE_SIMULASI[it.tipe] && (
                  <button
                    onClick={() => onSimulasi({ tipe: TIPE_KE_SIMULASI[it.tipe], jumlah: it.jumlah })}
                    className="text-[11px] font-semibold text-[#1F6F5F] hover:underline whitespace-nowrap"
                  >
                    Simulasikan
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{it.alasan}</p>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-400 mt-2">
          Rekomendasi bersifat bahan pertimbangan berdasarkan ambang parameter, bukan keputusan kebijakan.
        </p>
      </section>
    </div>
  );
}
