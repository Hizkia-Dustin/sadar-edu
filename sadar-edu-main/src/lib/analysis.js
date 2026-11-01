// Helper analisis di sisi klien: pembobotan MCDA langsung (tanpa menunggu server), warna, pemetaan data.

export const KATEGORI_URUT = ['Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah'];

export const KATEGORI_STYLE = {
  'Sangat Tinggi': { color: '#dc2626', badge: 'bg-red-100 text-red-700 border-red-200' },
  Tinggi: { color: '#f97316', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  Sedang: { color: '#eab308', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  Rendah: { color: '#10b981', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'Belum dihitung': { color: '#94a3b8', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const colorOf = (kategori) => (KATEGORI_STYLE[kategori] || KATEGORI_STYLE['Belum dihitung']).color;

export function categorize(skor, kategoriMeta) {
  if (skor === null || skor === undefined || Number.isNaN(skor)) return 'Belum dihitung';
  const list = kategoriMeta && kategoriMeta.length ? kategoriMeta : [
    { min: 75, label: 'Sangat Tinggi' }, { min: 55, label: 'Tinggi' }, { min: 35, label: 'Sedang' }, { min: 0, label: 'Rendah' },
  ];
  const hit = list.find((k) => skor >= k.min);
  return hit ? hit.label : 'Rendah';
}

/** Bobot awal (persen) dari metadata indikator server */
export function initialWeights(indikatorMeta = []) {
  return Object.fromEntries(indikatorMeta.map((i) => [i.kode, Math.round(Number(i.bobot) * 1000) / 10]));
}

/**
 * Hitung ulang skor tiap kecamatan dengan bobot (persen) tertentu dari nilai ternormalisasi server.
 * Rumus identik dengan server: sum(w*norm)/sum(w tersedia)*100.
 */
export function rescoreFeatures(features, weights, kategoriMeta) {
  const scored = features.map((f) => {
    const list = f.properties.indikator || [];
    let sumW = 0;
    let acc = 0;
    list.forEach((i) => {
      const w = Number(weights[i.kode]) || 0;
      if (i.norm !== null && i.norm !== undefined && w > 0) {
        sumW += w;
        acc += w * i.norm;
      }
    });
    const skor = sumW > 0 ? Math.round((acc / sumW) * 10000) / 100 : null;
    return { f, skor };
  });
  const ranked = [...scored].filter((s) => s.skor !== null).sort((a, b) => b.skor - a.skor);
  const rankOf = new Map();
  ranked.forEach((s, i) => rankOf.set(s.f.id, i > 0 && ranked[i - 1].skor === s.skor ? rankOf.get(ranked[i - 1].f.id) : i + 1));

  return scored.map(({ f, skor }) => {
    const kategori = categorize(skor, kategoriMeta);
    return {
      ...f,
      properties: { ...f.properties, skor, ranking_live: rankOf.get(f.id) ?? null, kategori_live: kategori, color: colorOf(kategori) },
    };
  });
}

/** Properti sekolah dari API -> bentuk yang dipakai komponen UI */
export function mapSchoolFeature(f) {
  const p = f.properties || {};
  return {
    ...f,
    properties: {
      id: p.id_sekolah,
      npsn: p.npsn,
      nama: p.nama_sekolah,
      status: p.status_sekolah,
      jenjang: p.jenjang,
      alamat: p.alamat,
      akreditasi: p.akreditasi || null,
      idWilayah: p.id_wilayah,
      kecamatan: p.nama_wilayah,
      jumlahSiswa: p.jumlah_siswa ?? 0,
      jumlahGuru: p.jumlah_guru ?? 0,
      ruangKelas: p.jumlah_ruang_kelas ?? 0,
      rombel: p.jumlah_rombel ?? 0,
      tahunStatistik: p.tahun_statistik ?? null,
      jarakKm: p.jarak_km ?? null,
    },
  };
}

export const fmt = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '-'
    : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d });

/** Rasio "1 : n" aman terhadap pembagian nol */
export const rasio = (siswa, guru) => (guru > 0 ? `1 : ${Math.round(siswa / guru)}` : '-');
