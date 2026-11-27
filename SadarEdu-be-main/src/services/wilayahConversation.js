const scopeReply = 'Saya bisa membantu menganalisis peta kebutuhan SMP se-Bogor maupun per kecamatan. Tanyakan misalnya "wilayah dengan prioritas rendah", "bandingkan kecamatan yang butuh sekolah baru vs renovasi", atau "sekolah mana di Nanggung yang kelasnya rusak berat?".';
const simulation = 'Di tab Simulasi & Lahan, pilih kecamatan dan jenis intervensi, lalu jalankan pratinjau untuk membandingkan skor sebelum dan sesudah.';

const VALID_LAYERS = new Set(['mcdaLayer', 'showBlankSpots', 'showCoverage', 'showCandidates', 'showSchools']);
const VALID_SIM_TYPES = new Set(['Sekolah Baru', 'Penambahan Ruang Kelas', 'Rehabilitasi Ruang Kelas', 'Penambahan Guru', 'Kombinasi']);

// Cooldown sementara jika sebuah model terkena 429 agar request berikutnya langsung memakai model yang kuotanya tersedia
const modelCooldownUntil = new Map();

const inventory = {
  jumlah_sekolah: 'Jumlah SMP', jumlah_sekolah_negeri: 'SMP negeri', jumlah_sekolah_swasta: 'SMP swasta',
  jumlah_siswa: 'Jumlah siswa', jumlah_guru: 'Jumlah guru', jumlah_ruang_kelas: 'Jumlah ruang kelas',
  ruang_kelas_rusak_berat: 'Ruang kelas rusak berat', ruang_kelas_rusak_sedang: 'Ruang kelas rusak sedang',
};

const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: d });

function buildAggregateSummary(allRanked = []) {
  if (!allRanked.length) return null;
  const distKategori = { 'Sangat Tinggi': 0, Tinggi: 0, Sedang: 0, Rendah: 0 };
  let totalSekolah = 0; let totalNegeri = 0; let totalSwasta = 0;
  let totalSiswa = 0; let totalGuru = 0; let totalKelas = 0;
  let totalRusakBerat = 0; let totalRusakSedang = 0; let totalRusak = 0;
  let totalKandidat = 0; let sumSkor = 0; let sumBlank = 0;

  for (const w of allRanked) {
    distKategori[w.kategori] = (distKategori[w.kategori] || 0) + 1;
    totalSekolah += w.sekolah_total || 0;
    totalNegeri += w.sekolah_negeri || 0;
    totalSwasta += w.sekolah_swasta || 0;
    totalSiswa += w.siswa_total || 0;
    totalGuru += w.guru_total || 0;
    totalKelas += w.kelas_total || 0;
    totalRusakBerat += w.rusak_berat || 0;
    totalRusakSedang += w.rusak_sedang || 0;
    totalRusak += w.rusak_total || 0;
    totalKandidat += w.kandidat_count || 0;
    sumSkor += w.skor || 0;
    sumBlank += w.blank_pct || 0;
  }

  return {
    jumlah_kecamatan: allRanked.length,
    distribusi_kategori: distKategori,
    rata_rata_skor: Number((sumSkor / allRanked.length).toFixed(1)),
    rata_rata_blank_pct: Number((sumBlank / allRanked.length).toFixed(1)),
    total_sekolah: totalSekolah,
    total_negeri: totalNegeri,
    total_swasta: totalSwasta,
    total_siswa: totalSiswa,
    total_guru: totalGuru,
    total_ruang_kelas: totalKelas,
    total_rusak_berat: totalRusakBerat,
    total_rusak_sedang: totalRusakSedang,
    total_kelas_rusak: totalRusak,
    total_kandidat_lahan: totalKandidat,
  };
}

function buildCompactTable(allRanked = []) {
  const header = 'id|nama|rank|skor|kat|blank%|jarak_km|gap_kursi|smp(N/S)|siswa|guru|kelas|rsk(brt/tot)|s_kls|s_gru|kand|rek';
  const rows = allRanked.map(k => [
    k.id,
    k.nama,
    k.ranking ?? '-',
    Number(k.skor || 0).toFixed(2),
    k.kategori || '-',
    Number(k.blank_pct || 0).toFixed(1),
    k.jarak_terdekat_km != null ? Number(k.jarak_terdekat_km).toFixed(2) : '-',
    k.gap_kursi ?? 0,
    `${k.sekolah_total || 0}(${k.sekolah_negeri || 0}/${k.sekolah_swasta || 0})`,
    k.siswa_total || 0,
    k.guru_total || 0,
    k.kelas_total || 0,
    `${k.rusak_berat || 0}/${k.rusak_total || 0}`,
    k.siswa_per_kelas ?? '-',
    k.siswa_per_guru ?? '-',
    k.kandidat_count || 0,
    (k.rekomendasi || []).map(r => r.tipe).slice(0, 2).join(';'),
  ].join('|'));
  return [header, ...rows].join('\n');
}

function conversationFacts(base = {}, properties = null, meta = {}, allRanked = [], weights = {}, focusDistrictIds = [], schoolsByDistrict = {}) {
  const facts = { ...base, simulasi: { summary: simulation, evidence: [] } };

  if (allRanked && allRanked.length > 0) {
    const topPrioritas = allRanked.slice(0, 5);
    const topBlank = [...allRanked].sort((a, b) => (b.blank_pct || 0) - (a.blank_pct || 0)).slice(0, 3);
    const topRusak = [...allRanked].sort((a, b) => (b.rusak_total || 0) - (a.rusak_total || 0)).slice(0, 3);

    facts.ringkasan_bogor = buildAggregateSummary(allRanked);
    facts.tabel_kecamatan = buildCompactTable(allRanked);

    facts.keseluruhan = {
      summary: `Analisis mencakup ${allRanked.length} kecamatan (${facts.ringkasan_bogor.total_sekolah} SMP, ${fmtNum(facts.ringkasan_bogor.total_siswa)} siswa).`,
      evidence: [
        `Prioritas Tertinggi: ${topPrioritas.slice(0, 3).map((k, i) => `#${i + 1} ${k.nama} (${Number(k.skor || 0).toFixed(1)} · ${k.kategori})`).join('; ')}.`,
        `Blank Spot Terluas (>3 km): ${topBlank.map(k => `${k.nama} (${k.blank_pct}%)`).join(', ')}.`,
        `Kelas Rusak Terbanyak: ${topRusak.map(k => `${k.nama} (${k.rusak_total} ruang, ${k.rusak_berat} berat)`).join(', ')}.`,
      ],
    };
  }

  if (Array.isArray(meta?.indikator) && meta.indikator.length > 0) {
    facts.bobot_indikator = meta.indikator.map(ind => ({
      kode: ind.kode || ind.kode_indikator,
      nama: ind.nama || ind.nama_indikator,
      bobot_aktif: weights && weights[ind.kode || ind.kode_indikator] != null
        ? Number(weights[ind.kode || ind.kode_indikator])
        : Math.round(Number(ind.bobot || 0) * 100),
      satuan: ind.satuan,
    }));
  }

  const detailTargets = [];
  for (const id of (focusDistrictIds || [])) {
    const found = allRanked.find(w => w.id === Number(id));
    if (found) {
      detailTargets.push({
        id: found.id,
        nama: found.nama,
        ranking: found.ranking,
        skor: found.skor,
        kategori: found.kategori,
        diagnosis: found.diagnosis,
        faktor_utama: found.faktor_utama,
        rekomendasi: found.rekomendasi,
        kandidat_lahan: { jumlah: found.kandidat_count, skor_tertinggi: found.kandidat_max_skor },
        indikator: (found.raw_properties?.indikator || []).filter(i => i.raw != null).map(i => {
          const def = meta?.indikator?.find(d => (d.kode || d.kode_indikator) === i.kode);
          return { kode: i.kode, nama: def?.nama || i.kode, raw: i.raw, norm: i.norm, satuan: def?.satuan || '' };
        }),
        sekolah_sorotan: schoolsByDistrict[found.id] || [],
      });
    }
  }
  if (detailTargets.length > 0) {
    facts.detail_kecamatan_fokus = detailTargets;
  }

  if (properties) {
    const interventions = properties.rekomendasi?.intervensi || [];
    const actions = interventions.map(item => item.tipe + ' — ' + item.alasan);
    facts.tindakan = {
      summary: actions.length
        ? 'Untuk ' + properties.nama_wilayah + ', mulai dengan menguji usulan ' + interventions[0].tipe.toLowerCase() + '. ' + simulation
        : 'Belum ada usulan intervensi yang tercatat untuk kecamatan ini. Periksa kelengkapan data sekolah sebelum memilih skenario.',
      evidence: actions,
    };
    const indicators = properties.indikator || [];
    facts.indikator = {
      summary: 'Berikut nilai indikator yang tersedia pada peta.',
      evidence: indicators.filter(i => i.raw != null).map(i => {
        const def = meta?.indikator?.find(d => d.kode === i.kode);
        return (def?.nama || i.kode) + ': ' + Number(i.raw).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' ' + (def?.satuan || '');
      }),
    };
    const metrics = properties.metrik || {};
    facts.sekolah = {
      summary: 'Berikut data sekolah yang tercatat di ' + properties.nama_wilayah + '.',
      evidence: Object.entries(inventory).filter(([key]) => metrics[key] != null)
        .map(([key, label]) => label + ': ' + Number(metrics[key]).toLocaleString('id-ID') + '.'),
    };
  }

  return facts;
}

const instruction = [
  'Anda adalah Analis Spasial & Kebijakan Pendidikan Senior untuk sistem SDSS/WebGIS SADAR EDU (Dinas Pendidikan Bogor).',
  'Anda memiliki akses penuh ke data nyata seluruh 46 kecamatan di Kota/Kabupaten Bogor pada `tabel_kecamatan`, `ringkasan_bogor`, `bobot_indikator`, dan `detail_kecamatan_fokus` (termasuk daftar `sekolah_sorotan`).',
  '',
  'ATURAN WAJIB:',
  'Untuk pertanyaan lanjutan, gunakan nama sekolah, urutan, angka, dan wilayah pada riwayat_singkat terbaru yang relevan. Jika pengguna meminta nama SMP, jawab pada tingkat sekolah. Jika datanya tidak tersedia, jelaskan batas datanya. Permintaan wilayah atau topik baru mengutamakan pertanyaan terbaru.',
  '1. FOKUS KETAT PADA PERTANYAAN PENGGUNA: Jawab PERSIS apa yang ditanyakan pengguna. JANGAN PERNAH mengalihkan jawaban ke kecamatan prioritas tertinggi jika pengguna menanyakan kategori/kriteria lain (misal: "prioritas rendah", "prioritas sedang", "kelas terpadat", "kekurangan guru", "SMP negeri tersedikit", perbandingan dua kecamatan tertentu, atau kondisi satu kecamatan spesifik).',
  '2. ANALISIS TAJAM & BERBASIS DATA NYATA: Gunakan angka persis dari `tabel_kecamatan` dan `detail_kecamatan_fokus` (skor MCDA, peringkat, kategori, % blank spot 3 km, gap kursi, kelas rusak berat/sedang, rasio siswa/kelas, rasio siswa/guru, jumlah SMP negeri/swasta, dan nama sekolah bila tersedia). Jangan pernah mengarang angka.',
  '3. BEDAKAN INTERVENSI: "Sekolah Baru" (USB) untuk blank_pct tinggi/jarak jauh; "Penambahan Ruang Kelas" (RKB) untuk s_kls > 32 & gap_kursi > 0; "Rehabilitasi Ruang Kelas" untuk kelas rusak berat/sedang banyak; "Penambahan Guru" untuk s_gru tinggi (>20). Untuk wilayah prioritas rendah, evaluasi apakah tetap ada kerentanan tersembunyi (seperti kelas rusak atau ketergantungan sekolah swasta).',
  '4. PAHAMI BAHASA SANTAI & TYPO: Pahami typo seperti "wilayang", "priotitas", "kuran sekola", "kruan gdari", "bandingin", "kek mana".',
  '5. BATASAN DATA: Jika ditanya biaya/anggaran rupiah atau sertifikat/legalitas tanah persil, jelaskan bahwa dataset memuat indikator pendidikan & kesesuaian spasial makro, bukan RAB atau status hukum persil.',
  '6. SOROTAN PETA HARUS SESUAI JAWABAN:',
  '   - `highlight_wilayah`: array 1-5 ID kecamatan yang PERSIS sedang Anda bahas pada jawaban ini (dari kolom `id` pada `tabel_kecamatan`).',
  '   - `primary_wilayah`: `{ "id": <id_utama>, "name": "<nama_utama>" }` sesuai wilayah utama jawaban Anda.',
  '   - `suggested_layers`: pilih dari ["mcdaLayer", "showBlankSpots", "showCoverage", "showCandidates", "showSchools"].',
  '   - `action_chips`: 2-4 tombol aksi relevan (sorot kecamatan, buka layer, atau `action: "simulate"` dengan `tipe` dari ["Sekolah Baru","Penambahan Ruang Kelas","Rehabilitasi Ruang Kelas","Penambahan Guru","Kombinasi"]).',
  '   - `follow_ups`: 2-3 pertanyaan lanjutan analitis yang natural.',
  '',
  'FORMAT OUTPUT WAJIB SATU OBJEK JSON VALID (bukan array, tanpa teks di luar JSON):',
  '{',
  '  "headline": "Judul singkat temuan utama (maks 9 kata)",',
  '  "summary": "Analisis 2-4 kalimat tajam dalam bahasa Indonesia yang langsung menjawab pertanyaan dengan angka nyata. Pakai **tebal** untuk penekanan.",',
  '  "metrics": [{ "label": "Label singkat", "value": "Nilai", "tone": "danger|warn|good|neutral" }],',
  '  "comparison": [{ "wilayahId": 0, "wilayah": "Nama Kecamatan", "badge": "Skor · Kategori", "detail": "Metrik kunci relevan" }],',
  '  "recommendation": "Rekomendasi kebijakan konkret sesuai pertanyaan (1-2 kalimat).",',
  '  "evidence": ["Fakta data pendukung 1", "Fakta data pendukung 2"],',
  '  "highlight_wilayah": [0],',
  '  "primary_wilayah": { "id": 0, "name": "Nama Kecamatan" },',
  '  "suggested_layers": ["mcdaLayer"],',
  '  "action_chips": [{ "label": "📍 Fokus Kec. X", "wilayahId": 0, "layer": "mcdaLayer" }],',
  '  "follow_ups": ["Pertanyaan lanjutan 1", "Pertanyaan lanjutan 2"],',
  '  "topic": "prioritas"',
  '}',
].join('\n');

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const unwrap = (val) => (Array.isArray(val) ? val.find(item => item && typeof item === 'object') || null : val);
  try {
    return unwrap(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return unwrap(JSON.parse(cleaned.slice(start, end + 1)));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildDistrictCard(w) {
  return {
    wilayahId: w.id,
    wilayah: w.nama,
    badge: `Skor ${Number(w.skor || 0).toFixed(1)} · ${w.kategori}`,
    detail: `Blank spot ${Number(w.blank_pct || 0).toFixed(1)}% · ${w.rusak_total || 0} kelas rusak (${w.rusak_berat || 0} berat) · ${w.sekolah_total || 0} SMP`,
  };
}

function fallback(question, previousTopic, facts, allRanked = [], properties = null, focusDistrictIds = [], schoolsByDistrict = {}) {
  const q = String(question || '');

  if (/anggaran|biaya|rupiah|rab\b/i.test(q)) {
    return {
      headline: 'Batasan Data Anggaran',
      summary: 'Diagnosis kecamatan ini belum memuat biaya satuan atau anggaran proyek (RUP/RAB). Untuk menghitung biayanya, diperlukan estimasi biaya satuan per intervensi (USB/RKB/rehabilitasi) di luar sistem peta.',
      evidence: [],
      follow_ups: ['Kecamatan mana yang paling mendesak intervensinya?', 'Bandingkan kebutuhan sekolah baru vs renovasi kelas'],
      source: 'Ringkasan indikator',
    };
  }

  if (/sertifikat|legalitas|status tanah|kepemilikan lahan/i.test(q)) {
    return {
      headline: 'Batasan Legalitas Lahan',
      summary: 'SADAR EDU menganalisis kesesuaian spasial makro (jarak jalan, blank spot, kontur, kawasan lindung), bukan legalitas sertifikat atau kepemilikan persil tanah. Verifikasi status hukum lahan tetap wajib dilakukan oleh Dinas Pendidikan/BPN di lapangan.',
      suggested_layers: ['showCandidates'],
      action_chips: [{ label: '🗺️ Lihat Area Kandidat', layer: 'showCandidates' }],
      evidence: [],
      source: 'Ringkasan indikator',
    };
  }

  // 1. Jika user menyebut 2+ kecamatan -> perbandingan langsung
  const mentioned = (focusDistrictIds || [])
    .map(id => allRanked.find(w => w.id === Number(id)))
    .filter(Boolean);
  if (mentioned.length >= 2) {
    const sorted = [...mentioned].sort((a, b) => b.skor - a.skor);
    const [a, b] = sorted;
    return {
      headline: `Perbandingan Kec. ${a.nama} vs Kec. ${b.nama}`,
      summary: `Secara komposit MCDA, **Kec. ${a.nama}** memiliki urgensi lebih tinggi (Peringkat #${a.ranking}, Skor **${a.skor.toFixed(1)}** · ${a.kategori}) dibanding **Kec. ${b.nama}** (Peringkat #${b.ranking}, Skor **${b.skor.toFixed(1)}** · ${b.kategori}). ${a.nama} mencatat blank spot **${a.blank_pct}%** dan **${a.rusak_total} ruang kelas rusak**, sedangkan ${b.nama} memiliki blank spot **${b.blank_pct}%** dan **${b.rusak_total} ruang kelas rusak**.`,
      metrics: [
        { label: `Skor ${a.nama}`, value: `${a.skor.toFixed(1)} (#${a.ranking})`, tone: a.skor >= 75 ? 'danger' : 'warn' },
        { label: `Skor ${b.nama}`, value: `${b.skor.toFixed(1)} (#${b.ranking})`, tone: b.skor >= 75 ? 'danger' : 'neutral' },
      ],
      comparison: sorted.slice(0, 4).map(buildDistrictCard),
      recommendation: `Prioritaskan intervensi pertama di Kec. ${a.nama}${a.rekomendasi?.[0] ? ` (${a.rekomendasi[0].tipe})` : ''}, lalu evaluasi kebutuhan lanjutan di Kec. ${b.nama}.`,
      highlight_wilayah: sorted.map(w => w.id),
      primary_wilayah: { id: a.id, name: a.nama },
      suggested_layers: ['mcdaLayer', ...(a.blank_pct > 15 || b.blank_pct > 15 ? ['showBlankSpots'] : [])],
      action_chips: [
        ...sorted.slice(0, 2).map(w => ({ label: `📍 Fokus Kec. ${w.nama}`, wilayahId: w.id, layer: 'mcdaLayer' })),
        { label: `🧪 Simulasi ${a.nama}`, action: 'simulate', wilayahId: a.id, tipe: a.rekomendasi?.[0]?.tipe || 'Sekolah Baru', jumlah: 1 },
      ],
      follow_ups: [
        `Sekolah mana di ${a.nama} yang kelasnya paling rusak?`,
        `Apa rekomendasi intervensi terbaik untuk ${b.nama}?`,
      ],
      topic: 'prioritas',
      evidence: sorted.map(w => `${w.nama}: Skor ${w.skor.toFixed(1)}, Blank spot ${w.blank_pct}%, Gap kursi ${fmtNum(w.gap_kursi)}, ${w.rusak_total} kelas rusak, ${w.sekolah_total} SMP (${w.sekolah_negeri}N/${w.sekolah_swasta}S).`),
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  // 2. Prioritas Rendah / Paling Aman / Sudah Memadai
  if (allRanked.length > 0 && /(?:priot?i?tas|kategori|skor)\s*(?:paling\s*)?rendah|terendah|paling\s*(?:aman|baik|memadai|rendah)/i.test(q)) {
    const lowList = allRanked.filter(w => String(w.kategori).toLowerCase() === 'rendah').sort((a, b) => a.skor - b.skor);
    const pool = lowList.length ? lowList : [...allRanked].sort((a, b) => a.skor - b.skor);
    const bottom3 = pool.slice(0, 3);
    const mostDamagedLow = [...pool].sort((a, b) => (b.rusak_total || 0) - (a.rusak_total || 0))[0];
    return {
      headline: `Analisis ${lowList.length || bottom3.length} Wilayah Prioritas Rendah`,
      summary: `Terdapat **${lowList.length} kecamatan** berkategori **Prioritas Rendah**, dipimpin oleh skor terendah di **Kec. ${bottom3[0].nama}** (Skor **${bottom3[0].skor.toFixed(1)}**), **Kec. ${bottom3[1]?.nama || bottom3[0].nama}** (**${(bottom3[1]?.skor || 0).toFixed(1)}**), dan **Kec. ${bottom3[2]?.nama || bottom3[0].nama}** (**${(bottom3[2]?.skor || 0).toFixed(1)}**). Meski akses geografisnya relatif aman, beberapa kecamatan prioritas rendah tetap memiliki pekerjaan rumah rehabilitasi fisik—tertinggi di **Kec. ${mostDamagedLow.nama}** (**${mostDamagedLow.rusak_total} kelas rusak**).`,
      metrics: [
        { label: 'Total Prioritas Rendah', value: `${lowList.length} Kecamatan`, tone: 'good' },
        { label: `Terendah (${bottom3[0].nama})`, value: `Skor ${bottom3[0].skor.toFixed(1)}`, tone: 'good' },
        { label: `Kelas Rusak (${mostDamagedLow.nama})`, value: `${mostDamagedLow.rusak_total} ruang`, tone: mostDamagedLow.rusak_total > 30 ? 'warn' : 'neutral' },
      ],
      comparison: bottom3.map(buildDistrictCard),
      recommendation: `Di zona prioritas rendah, tidak mendesak membangun sekolah baru (USB); fokuskan anggaran pada pemeliharaan mutu dan **Rehabilitasi Ruang Kelas** (khususnya di Kec. ${mostDamagedLow.nama}).`,
      highlight_wilayah: bottom3.map(w => w.id),
      primary_wilayah: { id: bottom3[0].id, name: bottom3[0].nama },
      suggested_layers: ['mcdaLayer', 'showSchools'],
      action_chips: [
        ...bottom3.slice(0, 2).map(w => ({ label: `📍 Fokus Kec. ${w.nama}`, wilayahId: w.id, layer: 'mcdaLayer' })),
        ...(mostDamagedLow.rusak_total > 0 ? [{ label: `🧪 Simulasi Rehab ${mostDamagedLow.nama}`, action: 'simulate', wilayahId: mostDamagedLow.id, tipe: 'Rehabilitasi Ruang Kelas', jumlah: Math.min(mostDamagedLow.rusak_total, 20) }] : []),
      ],
      follow_ups: [
        `Mengapa ${bottom3[0].nama} masuk prioritas rendah meski banyak kelas rusak?`,
        'Kecamatan mana saja yang masuk prioritas sedang?',
        'Bandingkan prioritas terendah dengan prioritas tertinggi',
      ],
      topic: 'prioritas',
      evidence: bottom3.map(w => `${w.nama}: Skor ${w.skor.toFixed(1)} (${w.kategori}), ${w.sekolah_total} SMP (${w.sekolah_negeri}N/${w.sekolah_swasta}S), blank spot ${w.blank_pct}%, ${w.rusak_total} kelas rusak.`),
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  // 3. Prioritas Sedang
  if (allRanked.length > 0 && /(?:priot?i?tas|kategori)\s*sedang/i.test(q)) {
    const medList = allRanked.filter(w => String(w.kategori).toLowerCase() === 'sedang');
    const topMed = medList.slice(0, 4);
    if (topMed.length > 0) {
      return {
        headline: `Analisis ${medList.length} Wilayah Prioritas Sedang`,
        summary: `Terdapat **${medList.length} kecamatan** dalam kategori **Prioritas Sedang**, dengan skor tertinggi di **Kec. ${topMed[0].nama}** (**${topMed[0].skor.toFixed(1)}**) dan **Kec. ${topMed[1]?.nama || topMed[0].nama}** (**${(topMed[1]?.skor || 0).toFixed(1)}**). Wilayah ini perlu intervensi selektif berupa penambahan ruang kelas (RKB) atau rehabilitasi sebelum tekanan beban layanan meningkat.`,
        metrics: [
          { label: 'Total Prioritas Sedang', value: `${medList.length} Kecamatan`, tone: 'warn' },
          { label: `Tertinggi (${topMed[0].nama})`, value: `Skor ${topMed[0].skor.toFixed(1)}`, tone: 'warn' },
        ],
        comparison: topMed.slice(0, 3).map(buildDistrictCard),
        recommendation: `Prioritaskan RKB dan rehabilitasi kelas di **Kec. ${topMed[0].nama}** agar tidak naik menjadi kategori Tinggi.`,
        highlight_wilayah: topMed.slice(0, 3).map(w => w.id),
        primary_wilayah: { id: topMed[0].id, name: topMed[0].nama },
        suggested_layers: ['mcdaLayer'],
        action_chips: topMed.slice(0, 2).map(w => ({ label: `📍 Fokus Kec. ${w.nama}`, wilayahId: w.id, layer: 'mcdaLayer' })),
        follow_ups: ['Bandingkan kecamatan prioritas sedang vs rendah', 'Kecamatan mana yang kelasnya paling padat?'],
        topic: 'prioritas',
        evidence: topMed.slice(0, 3).map(w => `${w.nama}: Skor ${w.skor.toFixed(1)}, Blank spot ${w.blank_pct}%, ${w.rusak_total} kelas rusak.`),
        source: 'Analisis Spasial SADAR EDU',
      };
    }
  }

  // 4. Kepadatan kelas / rasio guru / gap kursi / sekolah negeri tersedikit (global)
  if (allRanked.length > 0 && !properties && /padat|siswa per kelas|rasio kelas|rombel/i.test(q)) {
    const top = [...allRanked].filter(w => w.siswa_per_kelas != null).sort((a, b) => b.siswa_per_kelas - a.siswa_per_kelas).slice(0, 3);
    if (top.length) {
      return {
        headline: 'Kecamatan dengan Ruang Kelas Terpadat',
        summary: `Kepadatan ruang kelas tertinggi berada di **Kec. ${top[0].nama}** (**${top[0].siswa_per_kelas} siswa/kelas**), diikuti **Kec. ${top[1]?.nama || top[0].nama}** (**${top[1]?.siswa_per_kelas} siswa/kelas**) dan **Kec. ${top[2]?.nama || top[0].nama}** (**${top[2]?.siswa_per_kelas} siswa/kelas**).`,
        comparison: top.map(buildDistrictCard),
        recommendation: `Prioritaskan **Penambahan Ruang Kelas (RKB)** di Kec. ${top[0].nama} untuk menekan kepadatan kelas menuju standar ideal (≤32 siswa/kelas).`,
        highlight_wilayah: top.map(w => w.id),
        primary_wilayah: { id: top[0].id, name: top[0].nama },
        suggested_layers: ['mcdaLayer'],
        action_chips: [
          { label: `📍 Fokus Kec. ${top[0].nama}`, wilayahId: top[0].id, layer: 'mcdaLayer' },
          { label: `🧪 Simulasi RKB ${top[0].nama}`, action: 'simulate', wilayahId: top[0].id, tipe: 'Penambahan Ruang Kelas', jumlah: 5 },
        ],
        follow_ups: ['Kecamatan mana yang paling kekurangan guru?', 'Bandingkan kepadatan kelas dengan jumlah ruang kelas rusak'],
        topic: 'kapasitas',
        evidence: top.map(w => `${w.nama}: ${w.siswa_per_kelas} siswa/kelas (${fmtNum(w.siswa_total)} siswa / ${w.kelas_total} kelas).`),
        source: 'Analisis Spasial SADAR EDU',
      };
    }
  }

  if (allRanked.length > 0 && !properties && /guru|rasio guru|kekurangan guru|tenaga pendidik/i.test(q)) {
    const top = [...allRanked].filter(w => w.siswa_per_guru != null).sort((a, b) => b.siswa_per_guru - a.siswa_per_guru).slice(0, 3);
    if (top.length) {
      return {
        headline: 'Kecamatan dengan Rasio Siswa per Guru Tertinggi',
        summary: `Beban guru tertinggi berada di **Kec. ${top[0].nama}** (**${top[0].siswa_per_guru} siswa/guru** dari ${fmtNum(top[0].guru_total)} guru), diikuti **Kec. ${top[1]?.nama || top[0].nama}** (**${top[1]?.siswa_per_guru} siswa/guru**) dan **Kec. ${top[2]?.nama || top[0].nama}** (**${top[2]?.siswa_per_guru} siswa/guru**).`,
        comparison: top.map(buildDistrictCard),
        recommendation: `Lakukan pemerataan atau **Penambahan Guru** pada Kec. ${top[0].nama} dan Kec. ${top[1]?.nama || top[0].nama}.`,
        highlight_wilayah: top.map(w => w.id),
        primary_wilayah: { id: top[0].id, name: top[0].nama },
        suggested_layers: ['mcdaLayer'],
        action_chips: [
          { label: `📍 Fokus Kec. ${top[0].nama}`, wilayahId: top[0].id, layer: 'mcdaLayer' },
          { label: `🧪 Simulasi Tambah Guru`, action: 'simulate', wilayahId: top[0].id, tipe: 'Penambahan Guru', jumlah: 10 },
        ],
        follow_ups: ['Kecamatan mana yang kelasnya paling padat?', 'Bagaimana kondisi sekolah di ' + top[0].nama + '?'],
        topic: 'kapasitas',
        evidence: top.map(w => `${w.nama}: ${w.siswa_per_guru} siswa/guru (${fmtNum(w.siswa_total)} siswa, ${fmtNum(w.guru_total)} guru).`),
        source: 'Analisis Spasial SADAR EDU',
      };
    }
  }

  // 5. Satu kecamatan disebut eksplisit dalam pertanyaan (termasuk daftar sekolahnya!)
  if (mentioned.length === 1) {
    const w = mentioned[0];
    const schools = schoolsByDistrict[w.id] || [];
    const damagedSchools = schools.filter(s => (s.rusak_berat || 0) > 0 || (s.rusak_sedang || 0) > 0);
    if (/sekolah|smp|rusak/i.test(q) && schools.length > 0) {
      const targetSchools = damagedSchools.length ? damagedSchools.slice(0, 4) : schools.slice(0, 4);
      return {
        headline: `Rincian Sekolah di Kec. ${w.nama}`,
        summary: `Di **Kec. ${w.nama}** tercatat **${w.sekolah_total} SMP** (${w.sekolah_negeri} Negeri, ${w.sekolah_swasta} Swasta) dengan total **${w.rusak_total} ruang kelas rusak** (${w.rusak_berat} berat, ${w.rusak_sedang} sedang). Sekolah sorotan utama: ${targetSchools.map(s => `**${s.nama}** (${s.rusak_berat} berat, ${s.rusak_sedang} sedang)`).join('; ')}.`,
        metrics: [
          { label: 'Total SMP', value: `${w.sekolah_total} (${w.sekolah_negeri}N/${w.sekolah_swasta}S)`, tone: 'neutral' },
          { label: 'Rusak Berat', value: `${w.rusak_berat} kelas`, tone: w.rusak_berat > 0 ? 'danger' : 'good' },
          { label: 'Skor MCDA', value: `${w.skor.toFixed(1)} (#${w.ranking})`, tone: w.skor >= 75 ? 'danger' : 'warn' },
        ],
        recommendation: w.rusak_berat > 0
          ? `Prioritaskan **Rehabilitasi Ruang Kelas** pada sekolah dengan kerusakan berat di Kec. ${w.nama}.`
          : `Pantau kapasitas ruang belajar dan jangkauan layanan di Kec. ${w.nama}.`,
        highlight_wilayah: [w.id],
        primary_wilayah: { id: w.id, name: w.nama },
        suggested_layers: ['mcdaLayer', 'showSchools'],
        action_chips: [
          { label: `📍 Fokus Kec. ${w.nama}`, wilayahId: w.id, layer: 'showSchools' },
          { label: `🧪 Simulasi Rehab ${w.nama}`, action: 'simulate', wilayahId: w.id, tipe: 'Rehabilitasi Ruang Kelas', jumlah: Math.max(1, w.rusak_berat || 5) },
        ],
        follow_ups: [`Bandingkan ${w.nama} dengan kecamatan lain`, `Berapa blank spot di ${w.nama}?`],
        topic: 'sekolah',
        evidence: targetSchools.map(s => `${s.nama} (${s.status}, Akreditasi ${s.akreditasi}): ${s.siswa} siswa, ${s.kelas} kelas, ${s.rusak_berat} rusak berat, ${s.rusak_sedang} rusak sedang.`),
        source: 'Analisis Spasial SADAR EDU',
      };
    }
  }

  // 6. Query spesifik metrik rusak / blank spot se-Bogor
  if (allRanked.length > 0 && /rusak|renovasi|rehab|rehabilitasi/i.test(q) && !properties) {
    const top = [...allRanked].sort((a, b) => (b.rusak_total || 0) - (a.rusak_total || 0)).slice(0, 3);
    return {
      headline: 'Kecamatan dengan Ruang Kelas Rusak Terbanyak',
      summary: `Kebutuhan **rehabilitasi ruang kelas** terbesar berada di **Kec. ${top[0].nama}** (**${top[0].rusak_total} kelas rusak**, termasuk ${top[0].rusak_berat} rusak berat), diikuti **Kec. ${top[1].nama}** (${top[1].rusak_total} kelas rusak) dan **Kec. ${top[2]?.nama || top[1].nama}** (${top[2]?.rusak_total || 0} kelas rusak).`,
      metrics: [
        { label: 'Tertinggi', value: `${top[0].nama} (${top[0].rusak_total})`, tone: 'danger' },
        { label: 'Rusak Berat', value: `${top[0].rusak_berat} ruang`, tone: 'warn' },
      ],
      comparison: top.map(buildDistrictCard),
      recommendation: `Fokuskan skenario **Rehabilitasi Ruang Kelas** di Kec. ${top[0].nama} dan Kec. ${top[1].nama} untuk memulihkan kapasitas ruang belajar layak.`,
      highlight_wilayah: top.map(w => w.id),
      primary_wilayah: { id: top[0].id, name: top[0].nama },
      suggested_layers: ['mcdaLayer'],
      action_chips: [
        { label: `📍 Fokus Kec. ${top[0].nama}`, wilayahId: top[0].id, layer: 'mcdaLayer' },
        { label: `🧪 Simulasi Rehab ${top[0].nama}`, action: 'simulate', wilayahId: top[0].id, tipe: 'Rehabilitasi Ruang Kelas', jumlah: Math.min(top[0].rusak_berat || 5, 20) },
      ],
      follow_ups: [`Sekolah mana di ${top[0].nama} yang ruang kelasnya rusak berat?`, 'Kecamatan mana dengan blank spot terluas?'],
      topic: 'kapasitas',
      evidence: top.map(w => `${w.nama}: ${w.rusak_total} kelas rusak (${w.rusak_berat} berat, ${w.rusak_sedang} sedang, ${w.persen_kelas_rusak}% dari total kelas).`),
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  if (allRanked.length > 0 && /blank spot|jangkauan|radius|terpencil|jauh dari sekolah/i.test(q) && !properties) {
    const top = [...allRanked].sort((a, b) => (b.blank_pct || 0) - (a.blank_pct || 0)).slice(0, 3);
    return {
      headline: 'Wilayah Blank Spot Terluas (>3 km)',
      summary: `Area di luar radius jangkauan SMP 3 km (*blank spot*) paling luas terdapat di **Kec. ${top[0].nama}** (**${top[0].blank_pct}%** wilayah), disusul **Kec. ${top[1].nama}** (**${top[1].blank_pct}%**) dan **Kec. ${top[2]?.nama || top[1].nama}** (**${top[2]?.blank_pct || 0}%**). Wilayah ini paling kuat indikasinya untuk pembangunan **Unit Sekolah Baru (USB)**.`,
      metrics: [
        { label: `Blank Spot ${top[0].nama}`, value: `${top[0].blank_pct}%`, tone: 'danger' },
        { label: `Blank Spot ${top[1].nama}`, value: `${top[1].blank_pct}%`, tone: 'warn' },
      ],
      comparison: top.map(buildDistrictCard),
      recommendation: `Aktifkan lapisan **Blank Spot** dan **Area Kandidat** untuk meninjau tapak pembangunan SMP baru di Kec. ${top[0].nama}.`,
      highlight_wilayah: top.map(w => w.id),
      primary_wilayah: { id: top[0].id, name: top[0].nama },
      suggested_layers: ['mcdaLayer', 'showBlankSpots', 'showCandidates'],
      action_chips: [
        { label: `📍 Fokus Kec. ${top[0].nama}`, wilayahId: top[0].id, layer: 'showBlankSpots' },
        { label: '🗺️ Buka Area Kandidat', layer: 'showCandidates' },
        { label: `🧪 Simulasi USB ${top[0].nama}`, action: 'simulate', wilayahId: top[0].id, tipe: 'Sekolah Baru', jumlah: 1 },
      ],
      follow_ups: [`Bandingkan ${top[0].nama} dengan ${top[1].nama}`, 'Kecamatan mana yang paling banyak ruang kelas rusak?'],
      topic: 'jangkauan',
      evidence: top.map(w => `${w.nama}: Blank spot ${w.blank_pct}%, Skor MCDA ${w.skor.toFixed(1)} (${w.kategori}), ${w.sekolah_total} SMP tercatat.`),
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  // 7. Pertanyaan umum mencari wilayah kurang sekolah / prioritas tinggi
  const isGeneralNeedQuery = /kek mana|mana (yang|daerah|peta|wilayah|kecamatan)|kuran[g]?\s*sekola|butuh sekolah|paling (parah|tinggi|prioritas|butuh)|persebaran|ringkasan|se-bogor|keseluruhan/i.test(q);
  if (isGeneralNeedQuery && allRanked.length > 0) {
    const top1 = allRanked[0];
    const top2 = allRanked[1] || allRanked[0];
    const top3 = allRanked[2];
    const topList = [top1, top2, ...(top3 ? [top3] : [])];
    return {
      headline: 'Prioritas Kebutuhan Sekolah Se-Bogor',
      summary: `Berdasarkan analisis MCDA terhadap **${allRanked.length} kecamatan**, wilayah yang paling mendesak kekurangan akses dan sarana SMP adalah **Kec. ${top1.nama}** (Peringkat #1, Skor **${top1.skor.toFixed(1)}** · ${top1.kategori}) dan **Kec. ${top2.nama}** (Peringkat #2, Skor **${top2.skor.toFixed(1)}** · ${top2.kategori}). Di ${top1.nama}, **${top1.blank_pct.toFixed(1)}%** area berada di luar radius layanan 3 km dengan **${top1.rusak_total} ruang kelas rusak**.`,
      metrics: [
        { label: 'Prioritas #1', value: `${top1.nama} (${top1.skor.toFixed(1)})`, tone: 'danger' },
        { label: 'Blank Spot #1', value: `${top1.blank_pct.toFixed(1)}%`, tone: 'warn' },
        { label: 'Kelas Rusak #1', value: `${top1.rusak_total} ruang`, tone: 'warn' },
      ],
      comparison: topList.map(buildDistrictCard),
      recommendation: `Prioritaskan studi pembangunan sekolah baru (USB) dan rehabilitasi kelas di Kec. ${top1.nama} serta Kec. ${top2.nama}.`,
      highlight_wilayah: topList.map(w => w.id),
      primary_wilayah: { id: top1.id, name: top1.nama },
      suggested_layers: ['mcdaLayer', ...(top1.blank_pct > 20 ? ['showBlankSpots'] : [])],
      action_chips: [
        { label: `📍 Fokus Kec. ${top1.nama}`, wilayahId: top1.id, layer: 'mcdaLayer' },
        { label: `📍 Fokus Kec. ${top2.nama}`, wilayahId: top2.id, layer: 'mcdaLayer' },
        ...(top1.blank_pct > 20 ? [{ label: '🗺️ Tampilkan Blank Spot', layer: 'showBlankSpots' }] : []),
        { label: `🧪 Simulasi ${top1.nama}`, action: 'simulate', wilayahId: top1.id, tipe: 'Sekolah Baru', jumlah: 1 },
      ],
      follow_ups: [
        `Bandingkan ${top1.nama} dan ${top2.nama}`,
        'Analisis wilayah dengan prioritas rendah',
        'Kecamatan mana yang paling banyak ruang kelas rusak?',
      ],
      topic: 'prioritas',
      evidence: [
        `${top1.nama}: Skor ${top1.skor.toFixed(1)} (${top1.kategori}), Blank spot ${top1.blank_pct.toFixed(1)}%, ${top1.rusak_total} kelas rusak.`,
        `${top2.nama}: Skor ${top2.skor.toFixed(1)} (${top2.kategori}), Blank spot ${top2.blank_pct.toFixed(1)}%, ${top2.rusak_total} kelas rusak.`,
      ],
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  // 8. Diagnosis spesifik kecamatan aktif / disebut
  const targetActive = properties?.id_wilayah ? allRanked.find(w => w.id === Number(properties.id_wilayah)) : mentioned[0];
  if (targetActive && /menarik|kruan|kurang|masalah|kondisi|profil|diagnosis|bagaimana|gimana|tentang|analisis/i.test(q)) {
    const mainRec = targetActive.rekomendasi?.[0];
    return {
      headline: `Diagnosis Kec. ${targetActive.nama}`,
      summary: `**Kec. ${targetActive.nama}** berada di peringkat **#${targetActive.ranking} dari ${allRanked.length}** dengan skor **${targetActive.skor.toFixed(1)} (${targetActive.kategori})**. Tercatat **${targetActive.sekolah_total} SMP** (${targetActive.sekolah_negeri} Negeri, ${targetActive.sekolah_swasta} Swasta) melayani **${fmtNum(targetActive.siswa_total)} siswa**, dengan blank spot **${targetActive.blank_pct}%** dan **${targetActive.rusak_total} ruang kelas rusak** (${targetActive.rusak_berat} berat).`,
      metrics: [
        { label: 'Skor MCDA', value: `${targetActive.skor.toFixed(1)} (#${targetActive.ranking})`, tone: targetActive.skor >= 75 ? 'danger' : targetActive.skor >= 55 ? 'warn' : 'good' },
        { label: 'Blank Spot', value: `${targetActive.blank_pct}%`, tone: targetActive.blank_pct > 20 ? 'danger' : 'neutral' },
        { label: 'Kelas Rusak', value: `${targetActive.rusak_total} ruang`, tone: targetActive.rusak_total > 15 ? 'warn' : 'neutral' },
      ],
      recommendation: mainRec ? `Disarankan menguji **${mainRec.tipe}** — ${mainRec.alasan}` : simulation,
      highlight_wilayah: [targetActive.id],
      primary_wilayah: { id: targetActive.id, name: targetActive.nama },
      suggested_layers: ['mcdaLayer', ...(targetActive.blank_pct > 15 ? ['showBlankSpots'] : [])],
      action_chips: [
        { label: `📍 Fokus Kec. ${targetActive.nama}`, wilayahId: targetActive.id, layer: 'mcdaLayer' },
        ...(mainRec ? [{ label: `🧪 Simulasi ${mainRec.tipe}`, action: 'simulate', wilayahId: targetActive.id, tipe: mainRec.tipe, jumlah: mainRec.jumlah || 1 }] : []),
      ],
      follow_ups: [
        `Bandingkan ${targetActive.nama} dengan kecamatan lain`,
        `Sekolah mana di ${targetActive.nama} yang perlu perhatian?`,
      ],
      topic: 'prioritas',
      evidence: [
        `Rasio layanan: ${targetActive.siswa_per_kelas ?? '-'} siswa/kelas · ${targetActive.siswa_per_guru ?? '-'} siswa/guru.`,
        `Estimasi gap kursi: ${fmtNum(targetActive.gap_kursi)} kursi (penduduk usia SMP: ${fmtNum(targetActive.penduduk_usia_smp)} jiwa).`,
      ],
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  // 9. Urutan topik untuk wilayah spesifik (kompatibilitas unit test)
  const hints = [
    ['simulasi', /simulasi|skenario|skor sesudah/i],
    ['tindakan', /lakukan|memperbaiki|perbaiki|solusi|langkah|intervensi|rekomendasi|tindak lanjut|harus (apa|gimana)/i],
    ['jangkauan', /jangkau|jarak|radius|akses|blank spot/i],
    ['kapasitas', /kapasitas|kursi|daya tampung|tempat belajar/i],
    ['prioritas', /prioritas|skor|kebutuhan sekolah|kekurangan sekolah/i],
    ['sekolah', /(?:jumlah|berapa).*?(?:guru|siswa|sekolah|smp|kelas)|(?:guru|siswa|sekolah|smp|kelas).*?(?:jumlah|berapa)/i],
  ];
  const topic = hints.find(([, pattern]) => pattern.test(q))?.[0]
    || (/^(kenapa|mengapa|jelaskan lagi|maksudnya|contohnya|terus gimana)[\s?!.]*$/i.test(q) && previousTopic);

  if (Object.hasOwn(facts, topic)) {
    const res = { ...facts[topic], topic, source: 'Ringkasan indikator' };
    if (properties?.id_wilayah) {
      res.highlight_wilayah = [Number(properties.id_wilayah)];
      res.primary_wilayah = { id: Number(properties.id_wilayah), name: properties.nama_wilayah };
      res.action_chips = [{ label: `📍 Fokus Kec. ${properties.nama_wilayah}`, wilayahId: Number(properties.id_wilayah), layer: 'mcdaLayer' }];
    }
    return res;
  }

  if (facts.ringkasan_bogor) {
    const dist = facts.ringkasan_bogor.distribusi_kategori || {};
    return {
      headline: 'Distribusi Prioritas Pendidikan Se-Bogor',
      summary: `Peta mencakup **${allRanked.length} kecamatan** (${facts.ringkasan_bogor.total_sekolah} SMP, ${fmtNum(facts.ringkasan_bogor.total_siswa)} siswa): **${dist['Sangat Tinggi'] || 0}** Sangat Tinggi, **${dist.Tinggi || 0}** Tinggi, **${dist.Sedang || 0}** Sedang, dan **${dist.Rendah || 0}** Rendah. Sebutkan kategori, metrik, atau nama kecamatan tertentu untuk analisis mendalam.`,
      follow_ups: ['Analisis wilayah prioritas rendah', 'Kecamatan mana yang paling butuh sekolah baru?', 'Kecamatan mana yang kelasnya paling rusak?'],
      evidence: facts.keseluruhan?.evidence || [],
      topic: 'prioritas',
      source: 'Analisis Spasial SADAR EDU',
    };
  }

  return { summary: scopeReply, evidence: [], source: 'Asisten peta' };
}

function sanitizeActionChips(rawChips, validIdMap, highlights) {
  const chips = [];
  if (Array.isArray(rawChips)) {
    for (const c of rawChips.slice(0, 4)) {
      if (!c || typeof c.label !== 'string' || !c.label.trim()) continue;
      const chip = { label: c.label.trim().slice(0, 46) };
      if (c.wilayahId != null && validIdMap.has(Number(c.wilayahId))) {
        chip.wilayahId = Number(c.wilayahId);
      }
      if (typeof c.layer === 'string' && VALID_LAYERS.has(c.layer)) {
        chip.layer = c.layer;
      }
      if (c.action === 'simulate' && chip.wilayahId) {
        chip.action = 'simulate';
        chip.tipe = VALID_SIM_TYPES.has(c.tipe) ? c.tipe : 'Sekolah Baru';
        chip.jumlah = Number.isFinite(Number(c.jumlah)) && Number(c.jumlah) > 0 ? Math.min(Math.round(Number(c.jumlah)), 50) : 1;
      }
      if (chip.wilayahId || chip.layer || chip.action) chips.push(chip);
    }
  }
  if (!chips.length && highlights.length > 0) {
    for (const id of highlights.slice(0, 3)) {
      const w = validIdMap.get(id);
      if (w) chips.push({ label: `📍 Fokus Kec. ${w.nama}`, wilayahId: id, layer: 'mcdaLayer' });
    }
  }
  return chips;
}

async function callGeminiModel(modelName, requestBody, apiKey) {
  const model = encodeURIComponent(modelName);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const attempt = async () => fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: requestBody,
  });

  let response = await attempt();
  // Retry sekali jika 503 (lonjakan trafik sementara)
  if (response.status === 503) {
    await new Promise(r => setTimeout(r, 550));
    response = await attempt();
  }
  return response;
}

async function answerQuestion({
  question,
  history = [],
  previousTopic = null,
  properties = null,
  allRanked = [],
  focusDistrictIds = [],
  schoolsByDistrict = {},
  meta = {},
  base = {},
  weights = {},
}) {
  const facts = conversationFacts(base, properties, meta, allRanked, weights, focusDistrictIds, schoolsByDistrict);
  const validIdMap = new Map((allRanked || []).map(r => [r.id, r]));

  if (process.env.GEMINI_API_KEY) {
    const primaryModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
    const rawChain = [...new Set([
      primaryModel,
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
    ])];
    const now = Date.now();
    const activeChain = rawChain.filter(m => (modelCooldownUntil.get(m) || 0) <= now);
    const modelChain = activeChain.length ? activeChain : rawChain;

    const payload = {
      pertanyaan_pengguna: question,
      cakupan_aktif: properties ? {
        mode: 'kecamatan_terpilih',
        id: properties.id_wilayah,
        nama: properties.nama_wilayah,
        skor: properties.skor_total,
        kategori: properties.kategori_prioritas,
      } : { mode: 'seluruh_peta_bogor' },
      riwayat_singkat: history.slice(-4),
      topik_sebelumnya: previousTopic,
      ringkasan_bogor: facts.ringkasan_bogor,
      bobot_indikator: facts.bobot_indikator,
      detail_kecamatan_fokus: facts.detail_kecamatan_fokus,
      tabel_kecamatan: facts.tabel_kecamatan,
    };

    const makeBody = (withThinkingLow) => JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
        ...(withThinkingLow ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
      },
    });

    for (const modelName of modelChain) {
      try {
        const useLowThinking = /gemini-3\.(5|6|7|8)-flash/i.test(modelName) || /gemini-3-flash/i.test(modelName);
        const response = await callGeminiModel(modelName, makeBody(useLowThinking), process.env.GEMINI_API_KEY);

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.warn(`[wilayahConversation] ${modelName} HTTP ${response.status}:`, errBody.slice(0, 160));
          if (response.status === 429) {
            modelCooldownUntil.set(modelName, Date.now() + 60_000);
          }
          if (response.status === 401 || response.status === 403) break;
          continue;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map(p => p.text).filter(Boolean).join('');
        const reply = extractJsonObject(rawText);

        if (reply && typeof reply.summary === 'string' && reply.summary.trim()) {
          let highlights = Array.isArray(reply.highlight_wilayah)
            ? [...new Set(reply.highlight_wilayah.map(Number).filter(id => validIdMap.has(id)))].slice(0, 6)
            : [];

          if (!highlights.length && Array.isArray(reply.comparison)) {
            highlights = [...new Set(reply.comparison.map(c => Number(c?.wilayahId)).filter(id => validIdMap.has(id)))].slice(0, 6);
          }
          if (!highlights.length && focusDistrictIds.length > 0) {
            highlights = focusDistrictIds.filter(id => validIdMap.has(Number(id))).map(Number).slice(0, 5);
          }

          let primary = null;
          if (reply.primary_wilayah && validIdMap.has(Number(reply.primary_wilayah.id))) {
            const matched = validIdMap.get(Number(reply.primary_wilayah.id));
            primary = { id: matched.id, name: matched.nama };
          } else if (highlights.length > 0) {
            const matched = validIdMap.get(highlights[0]);
            if (matched) primary = { id: matched.id, name: matched.nama };
          }

          const layers = Array.isArray(reply.suggested_layers)
            ? reply.suggested_layers.filter(l => VALID_LAYERS.has(l))
            : ['mcdaLayer'];

          const metrics = Array.isArray(reply.metrics)
            ? reply.metrics
                .filter(m => m && typeof m.label === 'string' && m.value != null)
                .slice(0, 4)
                .map(m => ({
                  label: String(m.label).slice(0, 36),
                  value: String(m.value).slice(0, 36),
                  tone: ['danger', 'warn', 'good', 'neutral'].includes(m.tone) ? m.tone : 'neutral',
                }))
            : [];

          const comparison = Array.isArray(reply.comparison)
            ? reply.comparison
                .filter(c => c && typeof c.wilayah === 'string')
                .slice(0, 5)
                .map(c => ({
                  wilayahId: validIdMap.has(Number(c.wilayahId)) ? Number(c.wilayahId) : null,
                  wilayah: String(c.wilayah).slice(0, 40),
                  badge: c.badge ? String(c.badge).slice(0, 44) : '',
                  detail: c.detail ? String(c.detail).slice(0, 150) : '',
                }))
            : [];

          const followUps = Array.isArray(reply.follow_ups)
            ? reply.follow_ups.filter(f => typeof f === 'string' && f.trim()).slice(0, 3).map(f => f.trim().slice(0, 100))
            : [];

          return {
            headline: typeof reply.headline === 'string' && reply.headline.trim() ? reply.headline.trim().slice(0, 80) : null,
            summary: reply.summary.trim(),
            metrics,
            comparison,
            recommendation: typeof reply.recommendation === 'string' && reply.recommendation.trim() ? reply.recommendation.trim() : null,
            topic: typeof reply.topic === 'string' ? reply.topic.slice(0, 32) : 'prioritas',
            highlight_wilayah: highlights,
            primary_wilayah: primary,
            suggested_layers: layers.length ? layers : ['mcdaLayer'],
            action_chips: sanitizeActionChips(reply.action_chips, validIdMap, highlights),
            follow_ups: followUps,
            evidence: Array.isArray(reply.evidence) ? reply.evidence.filter(e => typeof e === 'string').slice(0, 4) : [],
            source: 'Gemini · Analis Spasial SADAR EDU',
          };
        }
      } catch (err) {
        console.warn(`[wilayahConversation] ${modelName} error:`, err?.message || err);
        if (err?.message === 'offline') break;
      }
    }
  }

  return fallback(question, previousTopic, facts, allRanked, properties, focusDistrictIds, schoolsByDistrict);
}

module.exports = { answerQuestion, conversationFacts };
