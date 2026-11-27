import { useMemo, useState } from "react";
import { ArrowRight, MapPin, ChevronDown } from "lucide-react";
import { useDataStore } from "../../store/useDataStore";
import { useMapStore } from "../../store/useMapStore";
import { rescoreFeatures, fmt } from "../../lib/analysis";
import { KategoriBadge, InfoBox, Bar, inputCls, btnGhost } from "../ui/kit";

const TIPE_KE_SIMULASI = {
  "Sekolah Baru": "Sekolah Baru",
  "Penambahan Ruang Kelas": "Penambahan Ruang Kelas",
  "Rehabilitasi Ruang Kelas": "Rehabilitasi Ruang Kelas",
  "Penambahan Guru": "Penambahan Guru",
};

export default function DiagnosisPanel({ wilayahId, onPilihWilayah, onSimulasi, onOpenChat }) {
  const { prioritas, meta, weights, sekolah, kecamatan } = useDataStore();
  const { setSelectedWilayahId, flyToBounds, flyToSchool, activeLayers, toggleLayer } = useMapStore();
  const [schoolFilter, setSchoolFilter] = useState("rusak");
  const [showAllSchools, setShowAllSchools] = useState(false);

  const scoredList = useMemo(
    () => rescoreFeatures(prioritas.features, weights, meta && meta.kategori),
    [prioritas, weights, meta]
  );

  const sortedByRank = useMemo(
    () => [...scoredList].sort((a, b) => (a.properties.ranking_live ?? 999) - (b.properties.ranking_live ?? 999)),
    [scoredList]
  );

  const feature = useMemo(
    () => scoredList.find((f) => String(f.properties.id_wilayah) === String(wilayahId)),
    [scoredList, wilayahId]
  );

  const handleSelectWilayah = (id) => {
    if (!id) return;
    setShowAllSchools(false);
    if (onPilihWilayah) {
      onPilihWilayah(id);
    } else {
      setSelectedWilayahId(id);
      const k = kecamatan.find((x) => x.id === String(id));
      if (k && k.bbox) flyToBounds(k.bbox);
    }
  };

  const schoolsInWilayah = useMemo(() => {
    if (!feature) return [];
    const idW = String(feature.properties.id_wilayah);
    const namaW = (feature.properties.nama_wilayah || "").toLowerCase().replace(/\s+/g, "");
    return (sekolah?.features || []).filter((s) => {
      const p = s.properties || {};
      if (p.id_wilayah && String(p.id_wilayah) === idW) return true;
      const kecSek = (p.kecamatan || "").toLowerCase().replace(/\s+/g, "");
      return kecSek && kecSek === namaW;
    });
  }, [sekolah, feature]);

  const schoolLists = useMemo(() => {
    const all = schoolsInWilayah.map((f) => {
      const p = f.properties || {};
      const siswa = Number(p.jumlahSiswa) || 0;
      const guru = Number(p.jumlahGuru) || 0;
      const kelas = Number(p.ruangKelas) || 0;
      const rb = Number(p.kelasRusakBerat) || 0;
      const rs = Number(p.kelasRusakSedang) || 0;
      const rr = Number(p.kelasRusakRingan) || 0;
      return {
        feature: f,
        ...p,
        rusakTotal: rb + rs,
        rusakBerat: rb,
        rusakSedang: rs,
        rusakRingan: rr,
        rasioKelas: kelas > 0 ? siswa / kelas : 0,
        butuhRkb: kelas > 0 && siswa / kelas > 32 ? Math.ceil(siswa / 32) - kelas : 0,
        rasioGuru: guru > 0 ? siswa / guru : 0,
        butuhGuru: guru > 0 && siswa / guru > 20 ? Math.ceil(siswa / 20) - guru : 0,
      };
    });
    return {
      rusak: all.filter((s) => s.rusakTotal > 0).sort((a, b) => b.rusakBerat * 2 + b.rusakSedang - (a.rusakBerat * 2 + a.rusakSedang)),
      padat: all.filter((s) => s.rasioKelas > 32).sort((a, b) => b.rasioKelas - a.rasioKelas),
      guru: all.filter((s) => s.rasioGuru > 20).sort((a, b) => b.rasioGuru - a.rasioGuru),
      semua: all.sort((a, b) => (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0)),
    };
  }, [schoolsInWilayah]);

  const fokusSekolah = (item) => {
    if (!activeLayers.showSchools) toggleLayer("showSchools");
    flyToSchool(item.feature);
  };

  return (
    <div>
      <section className="sh-section">
        <select
          id="diag-wilayah"
          aria-label="Pilih Kecamatan"
          className={inputCls}
          value={wilayahId || ""}
          onChange={(e) => handleSelectWilayah(e.target.value)}
        >
          <option value="">Pilih kecamatan untuk melihat diagnosis ({sortedByRank.length})...</option>
          {sortedByRank.map((f) => {
            const fp = f.properties;
            return (
              <option key={fp.id_wilayah} value={fp.id_wilayah}>
                #{fp.ranking_live ?? "-"} · Kec. {fp.nama_wilayah} — Skor {fmt(fp.skor, 1)} ({fp.kategori_live || "-"})
              </option>
            );
          })}
        </select>
      </section>

      {!wilayahId || !feature ? (
        <section className="sh-section">
          <InfoBox>
            Pilih kecamatan dari daftar di atas atau klik langsung wilayah pada peta untuk melihat diagnosis, rekomendasi keputusan, dan sekolah sasaran.
          </InfoBox>
        </section>
      ) : (
        (() => {
          const p = feature.properties;
          const m = p.metrik || {};
          const rek = p.rekomendasi || { intervensi: [], faktor_utama: [] };
          const indikatorMeta = Object.fromEntries((meta ? meta.indikator : []).map((i) => [i.kode, i]));
          const totalW = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0) || 1;

          const rows = (p.indikator || [])
            .map((i) => {
              const im = indikatorMeta[i.kode] || {};
              const w = Number(weights[i.kode]) || 0;
              return {
                ...i,
                nama: im.nama || i.kode,
                satuan: im.satuan,
                kelompok: im.kelompok,
                kontribusi: i.norm === null ? 0 : (w / totalW) * i.norm * 100,
              };
            })
            .sort((a, b) => b.kontribusi - a.kontribusi);

          const totalKelas = Math.max(1, Number(m.jumlah_ruang_kelas) || 0);
          const pctBaik = ((Number(m.ruang_kelas_baik) || 0) / totalKelas) * 100;
          const pctRingan = ((Number(m.ruang_kelas_rusak_ringan) || 0) / totalKelas) * 100;
          const pctSedang = ((Number(m.ruang_kelas_rusak_sedang) || 0) / totalKelas) * 100;
          const pctBerat = ((Number(m.ruang_kelas_rusak_berat) || 0) / totalKelas) * 100;
          const rusakTotal = (Number(m.ruang_kelas_rusak_berat) || 0) + (Number(m.ruang_kelas_rusak_sedang) || 0);

          const activeSchoolList = schoolLists[schoolFilter] || [];
          const displayedSchools = showAllSchools ? activeSchoolList : activeSchoolList.slice(0, 6);

          return (
            <>
              <button type="button" className="sh-pill-btn" onClick={onOpenChat}>Tanya asisten tentang wilayah ini</button>
              {schoolLists.padat[0] && <button type="button" className="block text-left text-xs font-semibold text-[#1f6f5f] underline" onClick={() => fokusSekolah(schoolLists.padat[0])}>
                Lihat kelas terpadat di peta · {schoolLists.padat[0].nama}
              </button>}
              <button type="button" className="block mt-2 text-xs font-semibold text-[#1f6f5f] underline" onClick={() => onSimulasi({ id_wilayah: p.id_wilayah, tipe: 'Penambahan Ruang Kelas' })}>
                Simulasikan penambahan ruang kelas
              </button>
              <section className="sh-section">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kec. {p.nama_wilayah}</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Skor <strong style={{ color: p.color }}>{fmt(p.skor, 1)}</strong> / 100 · Peringkat{" "}
                      <strong>#{p.ranking_live ?? "-"}</strong> dari {prioritas.features.length} kecamatan
                    </p>
                  </div>
                  <KategoriBadge kategori={p.kategori_live} />
                </div>

                {p.diagnosis && (
                  <p className="mt-3.5 text-[13px] text-slate-700 leading-relaxed">{p.diagnosis}</p>
                )}

                <div className="sh-overview-grid mt-5 pt-4 border-t border-slate-100">
                  <div className="sh-overview-stat">
                    <div className="sh-overview-num is-amber">{fmt(m.gap_kursi)}</div>
                    <div className="sh-overview-label">Kurang Kursi</div>
                    <div className="sh-overview-sub">Usia SMP: {fmt(m.penduduk_usia_smp)}</div>
                  </div>
                  <div className="sh-overview-stat">
                    <div className="sh-overview-num is-rose">{fmt(rusakTotal)}</div>
                    <div className="sh-overview-label">Kelas Rusak</div>
                    <div className="sh-overview-sub">{fmt(m.ruang_kelas_rusak_berat ?? 0)} rusak berat</div>
                  </div>
                  <div className="sh-overview-stat">
                    <div className="sh-overview-num">{fmt(m.jumlah_sekolah)}</div>
                    <div className="sh-overview-label">Sekolah SMP</div>
                    <div className="sh-overview-sub">
                      {fmt(m.jumlah_sekolah_negeri ?? 0)} Negeri · {fmt(m.jumlah_sekolah_swasta ?? 0)} Swasta
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                    <span>Kondisi {fmt(m.jumlah_ruang_kelas)} ruang kelas</span>
                    <span className="font-semibold text-rose-700">{fmt(m.persen_kelas_rusak ?? 0, 1)}% perlu rehab</span>
                  </div>
                  <div className="sh-stack-bar" aria-label="Proporsi kondisi ruang kelas">
                    <div style={{ width: `${pctBaik}%`, background: "#10b981" }} title={`Baik: ${fmt(m.ruang_kelas_baik)}`} />
                    <div style={{ width: `${pctRingan}%`, background: "#0ea5e9" }} title={`Rusak Ringan: ${fmt(m.ruang_kelas_rusak_ringan)}`} />
                    <div style={{ width: `${pctSedang}%`, background: "#f59e0b" }} title={`Rusak Sedang: ${fmt(m.ruang_kelas_rusak_sedang)}`} />
                    <div style={{ width: `${pctBerat}%`, background: "#e11d48" }} title={`Rusak Berat: ${fmt(m.ruang_kelas_rusak_berat)}`} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                      Baik {fmt(m.ruang_kelas_baik ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
                      Ringan {fmt(m.ruang_kelas_rusak_ringan ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      Sedang {fmt(m.ruang_kelas_rusak_sedang ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#e11d48]" />
                      Berat {fmt(m.ruang_kelas_rusak_berat ?? 0)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="sh-section">
                <div className="sh-section-head">
                  <h3 className="sh-section-title">Rekomendasi Tindakan</h3>
                </div>
                <ul className="sh-list">
                  {(rek.intervensi || []).map((it) => (
                    <li key={it.tipe} className="sh-list-item px-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-bold text-slate-900">
                          {it.tipe}
                          {it.jumlah ? ` · ±${fmt(it.jumlah)}` : ""}
                        </span>
                        {TIPE_KE_SIMULASI[it.tipe] && (
                          <button
                            onClick={() =>
                              onSimulasi({
                                id_wilayah: p.id_wilayah,
                                tipe: TIPE_KE_SIMULASI[it.tipe],
                                jumlah: it.jumlah,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6F5F] hover:underline shrink-0"
                          >
                            <span>Simulasikan</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{it.alasan}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sh-section">
                <div className="sh-section-head">
                  <h3 className="sh-section-title">Sekolah Sasaran</h3>
                  <span className="sh-section-meta">{schoolsInWilayah.length} SMP di Kec. {p.nama_wilayah}</span>
                </div>

                <div className="sh-segmented mb-3" role="group" aria-label="Filter kategori masalah sekolah">
                  {[
                    ["rusak", `Rehab (${schoolLists.rusak.length})`],
                    ["padat", `RKB (${schoolLists.padat.length})`],
                    ["guru", `Guru (${schoolLists.guru.length})`],
                    ["semua", `Semua (${schoolLists.semua.length})`],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setSchoolFilter(id);
                        setShowAllSchools(false);
                      }}
                      className={schoolFilter === id ? "is-active" : ""}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeSchoolList.length === 0 ? (
                  <p className="text-xs text-slate-600 py-3">
                    Tidak ada sekolah dalam kategori ini di Kec. {p.nama_wilayah}.
                  </p>
                ) : (
                  <>
                    <ul className="sh-list">
                      {displayedSchools.map((s) => (
                        <li key={s.id} className="sh-list-item px-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => fokusSekolah(s)}
                              className="text-left text-[13px] font-semibold text-slate-900 hover:text-[#1F6F5F] leading-snug"
                            >
                              {s.nama}
                            </button>
                            <button
                              onClick={() => fokusSekolah(s)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6F5F] hover:underline shrink-0"
                            >
                              <MapPin size={12} />
                              <span>Peta</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {s.status} · Akred. {s.akreditasi || "Belum"} · {fmt(s.jumlahSiswa)} siswa · {fmt(s.ruangKelas)} kelas
                          </p>
                          {(s.rusakBerat > 0 || s.rusakSedang > 0 || s.butuhRkb > 0 || s.butuhGuru > 0) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
                              {s.rusakBerat > 0 && <span className="text-rose-700 font-semibold">{s.rusakBerat} rusak berat</span>}
                              {s.rusakSedang > 0 && <span className="text-amber-800 font-semibold">{s.rusakSedang} rusak sedang</span>}
                              {s.butuhRkb > 0 && <span className="text-slate-800">Perlu +{s.butuhRkb} RKB</span>}
                              {s.butuhGuru > 0 && <span className="text-slate-800">Perlu +{s.butuhGuru} guru</span>}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {activeSchoolList.length > 6 && (
                      <button
                        onClick={() => setShowAllSchools((v) => !v)}
                        className={`${btnGhost} w-full mt-3 inline-flex items-center justify-center gap-1.5`}
                      >
                        <span>
                          {showAllSchools
                            ? "Ringkas daftar sekolah"
                            : `Lihat semua (${activeSchoolList.length} sekolah)`}
                        </span>
                        <ChevronDown size={14} className={showAllSchools ? "rotate-180 transition-transform" : "transition-transform"} />
                      </button>
                    )}
                  </>
                )}
              </section>

              <section className="sh-section">
                <details className="sh-details">
                  <summary>
                    <span>Rincian Statistik & 7 Indikator MCDA</span>
                    <ChevronDown size={15} className="text-slate-500" />
                  </summary>
                  <div className="sh-details-body space-y-5">
                    <dl className="sh-dl">
                      <div className="sh-dl-row">
                        <dt>Penduduk total</dt>
                        <dd>{fmt(m.penduduk)} jiwa</dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Anak usia SMP (13–15 thn)</dt>
                        <dd>{fmt(m.penduduk_usia_smp)} anak</dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Kebutuhan kursi (Target APK)</dt>
                        <dd>{fmt(m.demand_kursi)} kursi</dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Kapasitas kursi total vs layak</dt>
                        <dd>
                          {fmt(m.kapasitas_kursi)} / {fmt(m.kapasitas_layak_kursi ?? m.kapasitas_kursi)} kursi
                        </dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Kekurangan kursi layak pakai</dt>
                        <dd className="text-rose-700">{fmt(m.gap_kursi_layak ?? m.gap_kursi)} kursi</dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Total tenaga pendidik</dt>
                        <dd>
                          {fmt(m.jumlah_guru)} guru ({fmt(m.rasio_siswa_guru, 1)} siswa/guru)
                        </dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Sebaran akreditasi</dt>
                        <dd>
                          A: {fmt(m.akreditasi_a ?? 0)} · B: {fmt(m.akreditasi_b ?? 0)} · C: {fmt(m.akreditasi_c ?? 0)} · Belum:{" "}
                          {fmt(m.belum_terakreditasi ?? 0)}
                        </dd>
                      </div>
                      <div className="sh-dl-row">
                        <dt>Blank spot di luar radius 3 km</dt>
                        <dd>{fmt(m.blank_pct, 1)}% luas kecamatan</dd>
                      </div>
                    </dl>

                    <div className="space-y-2.5 pt-2">
                      <h4 className="text-xs font-bold text-slate-800">Kontribusi 7 Indikator MCDA</h4>
                      {rows.map((r) => (
                        <div key={r.kode}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700">{r.nama}</span>
                            <span className="text-slate-600">
                              {r.raw === null ? "-" : `${fmt(r.raw, 1)} ${r.satuan || ""}`} ·{" "}
                              <strong className="text-slate-900">+{fmt(r.kontribusi, 1)}</strong>
                            </span>
                          </div>
                          <Bar value={r.kontribusi} max={Math.max(...rows.map((x) => x.kontribusi), 1)} color={p.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </section>
            </>
          );
        })()
      )}
    </div>
  );
}
