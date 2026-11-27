const db = require('../config/db');
const analysis = require('../services/analysisService');
const { active } = require('../utils/sql');
const { answerQuestion } = require('../services/wilayahConversation');
const { staffingRequest, schoolStaffingReply } = require('../services/schoolStaffing');

const topics = new Set(['prioritas', 'jangkauan', 'kapasitas']);
const format = value => Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 });

function explain(properties, meta, weights, topic) {
  if (!properties) return { summary: 'Konteks wilayah belum dipilih.', evidence: [] };
  const metrics = properties.metrik || {};
  if (topic === 'jangkauan') {
    if (metrics.blank_pct == null) return { summary: 'Luas wilayah di luar jangkauan belum tersedia.', evidence: [] };
    return {
      summary: 'Area di luar radius layanan menunjukkan bagian kecamatan yang jauh dari titik sekolah menurut analisis jarak.',
      evidence: [format(metrics.blank_pct) + '% luas wilayah di luar radius ' + format(metrics.radius_km ?? meta?.radius_km ?? 3) + ' km.'],
    };
  }
  if (topic === 'kapasitas') {
    const gapIndicator = properties.indikator?.find(i => i.kode === 'GAP_KAPASITAS');
    if (metrics.gap_kursi == null || (gapIndicator && gapIndicator.raw == null)) return { summary: 'Data kapasitas belum cukup untuk memperkirakan kekurangan kursi.', evidence: [] };
    return {
      summary: Number(metrics.gap_kursi) > 0 ? 'Estimasi kebutuhan tempat belajar melebihi kapasitas yang tercatat.' : 'Perhitungan kapasitas tidak menunjukkan kekurangan kursi secara agregat.',
      evidence: ['Estimasi kekurangan kursi: ' + format(metrics.gap_kursi) + '.', ...(metrics.penduduk_usia_smp == null ? [] : ['Penduduk usia SMP: ' + format(metrics.penduduk_usia_smp) + ' jiwa.'])],
    };
  }
  const weighted = (properties.indikator || []).filter(i => i.norm != null && weights && weights[i.kode] > 0)
    .map(i => ({ ...i, weighted: Number(i.norm) * weights[i.kode] })).sort((a, b) => b.weighted - a.weighted);
  if (!weighted.length) {
    if (properties.skor_total != null) {
      const score = Number(properties.skor_total);
      const category = properties.kategori_prioritas || meta?.kategori?.find(k => score >= k.min)?.label || 'Sedang';
      return {
        summary: `Prioritas ${properties.nama_wilayah || 'wilayah ini'} berada pada kategori ${category} dengan skor ${format(score)} dari 100.`,
        evidence: properties.rekomendasi?.intervensi?.map(i => `${i.tipe}: ${i.alasan}`).slice(0, 2) || []
      };
    }
    return { summary: 'Skor belum dapat dihitung dari indikator dan bobot yang tersedia.', evidence: [] };
  }
  const total = weighted.reduce((sum, i) => sum + weights[i.kode], 0);
  const score = Math.round(weighted.reduce((sum, i) => sum + i.weighted, 0) / total * 10000) / 100;
  const category = meta?.kategori?.find(k => score >= k.min)?.label || 'Sedang';
  return {
    summary: 'Dengan bobot pada peta, prioritas wilayah ini ' + category + ' dengan skor ' + format(score) + ' dari 100.',
    evidence: weighted.filter(i => i.weighted > 0).slice(0, 3).map(i => {
      const def = meta?.indikator?.find(d => d.kode === i.kode);
      return (def?.nama || i.kode) + ': ' + (i.raw == null ? 'nilai mentah tidak tersedia' : format(i.raw) + ' ' + (def?.satuan || '')) + ' · kontribusi ' + format(i.weighted / total * 100) + ' poin.';
    }),
  };
}

function detectMentionedDistrictIds(question, allRanked, activeId = null) {
  const ids = [];
  if (activeId) ids.push(Number(activeId));
  if (typeof question !== 'string' || !question.trim()) return ids;
  const normalizedQ = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const sortedByNameLen = [...allRanked].sort((a, b) => (b.nama?.length || 0) - (a.nama?.length || 0));
  for (const w of sortedByNameLen) {
    const cleanName = String(w.nama || '').toLowerCase().trim();
    if (cleanName.length < 3) continue;
    const regex = new RegExp(`\\b${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(normalizedQ) && !ids.includes(w.id)) {
      ids.push(w.id);
      if (ids.length >= 4) break;
    }
  }
  return ids;
}

async function fetchCandidateSummary(tahun) {
  try {
    const r = await db.query(
      `SELECT id_wilayah,
              COUNT(*)::int AS jumlah,
              ROUND(MAX(skor_suitability)::numeric, 1) AS skor_tertinggi,
              COUNT(*) FILTER (WHERE status_kandidat = 'Disetujui')::int AS disetujui
       FROM candidate_area
       WHERE ($1::int IS NULL OR tahun = $1::int)
       GROUP BY id_wilayah`,
      [tahun || null]
    );
    return new Map(r.rows.map(row => [Number(row.id_wilayah), {
      jumlah: Number(row.jumlah || 0),
      skor_tertinggi: row.skor_tertinggi != null ? Number(row.skor_tertinggi) : null,
      disetujui: Number(row.disetujui || 0),
    }]));
  } catch {
    return new Map();
  }
}

async function fetchSchoolsForDistricts(districtIds, tahun) {
  if (!districtIds.length) return {};
  try {
    const r = await db.query(
      `SELECT s.id_sekolah, w.id_wilayah, w.nama_wilayah, s.nama_sekolah, s.status_sekolah, s.akreditasi,
              st.jumlah_siswa, st.jumlah_guru, st.jumlah_rombel, st.jumlah_ruang_kelas,
              st.ruang_kelas_baik, st.ruang_kelas_rusak_ringan, st.ruang_kelas_rusak_sedang, st.ruang_kelas_rusak_berat
       FROM wilayah w
       JOIN sekolah s ON s.geom IS NOT NULL AND ST_Covers(w.geom, s.geom) AND ${active('s')}
       LEFT JOIN LATERAL (
         SELECT x.jumlah_siswa, x.jumlah_guru, x.jumlah_rombel, x.jumlah_ruang_kelas,
                x.ruang_kelas_baik, x.ruang_kelas_rusak_ringan, x.ruang_kelas_rusak_sedang, x.ruang_kelas_rusak_berat
         FROM statistik_pendidikan x
         WHERE x.id_sekolah = s.id_sekolah AND ($2::int IS NULL OR x.tahun <= $2::int) AND ${active('x')}
         ORDER BY x.tahun DESC LIMIT 1
       ) st ON TRUE
       WHERE w.id_wilayah = ANY($1::bigint[]) AND w.geom IS NOT NULL AND ${active('w')}
       ORDER BY COALESCE(st.ruang_kelas_rusak_berat, 0) DESC,
                COALESCE(st.ruang_kelas_rusak_sedang, 0) DESC,
                COALESCE(st.jumlah_siswa, 0) DESC`,
      [districtIds, tahun || null]
    );
    const byDistrict = {};
    for (const row of r.rows) {
      const id = Number(row.id_wilayah);
      if (!byDistrict[id]) byDistrict[id] = [];
      if (byDistrict[id].length < 8) {
        const kelas = Number(row.jumlah_ruang_kelas || 0);
        const siswa = Number(row.jumlah_siswa || 0);
        byDistrict[id].push({
          nama: row.nama_sekolah,
          status: row.status_sekolah,
          akreditasi: row.akreditasi || '-',
          siswa,
          guru: Number(row.jumlah_guru || 0),
          kelas,
          siswa_per_kelas: kelas > 0 ? Number((siswa / kelas).toFixed(1)) : null,
          rusak_berat: Number(row.ruang_kelas_rusak_berat || 0),
          rusak_sedang: Number(row.ruang_kelas_rusak_sedang || 0),
        });
      }
    }
    return byDistrict;
  } catch {
    return {};
  }
}

async function ask(req, res, next) {
  try {
    const { wilayahId, tahun, weights = {}, topic, question, previousTopic, history = [] } = req.body || {};

    const validHistory = Array.isArray(history) && history.length <= 6 && history.every(turn =>
      typeof turn?.question === 'string' && turn.question.length <= 600 &&
      typeof turn.summary === 'string' && turn.summary.length <= 2000 &&
      (turn.topic == null || (typeof turn.topic === 'string' && turn.topic.length <= 32)));

    const validPrompt = question === undefined ? topics.has(topic) : typeof question === 'string' && question.trim() && question.length <= 600;

    // wilayahId boleh null, undefined, "all", "semua", atau angka ID positif
    const isGlobalScope = wilayahId == null || wilayahId === '' || wilayahId === 'all' || wilayahId === 'semua' || wilayahId === 0;
    const numericWilayahId = isGlobalScope ? null : Number(wilayahId);
    const validWilayah = isGlobalScope || (Number.isSafeInteger(numericWilayahId) && numericWilayahId > 0);

    if (!validWilayah || !validPrompt || !validHistory || typeof weights !== 'object' || Array.isArray(weights) ||
      Object.values(weights).some(w => !Number.isFinite(w) || w < 0 || w > 100)) {
      return res.status(400).json({ message: 'Konteks peta atau pertanyaan tidak valid.' });
    }

    const resolvedTahun = Number.isInteger(Number(tahun)) ? Number(tahun) : 2026;
    const [{ features, meta }, candidateMap] = await Promise.all([
      analysis.getPrioritasGeoJSON({ tahun: resolvedTahun }),
      fetchCandidateSummary(resolvedTahun),
    ]);

    // Bangun peringkat lengkap seluruh kecamatan berbasis bobot aktif
    const allRanked = (features || []).map(f => {
      const p = f.properties || {};
      const m = p.metrik || {};
      let liveScore = p.skor_total != null ? Number(p.skor_total) : 0;
      if (weights && Object.keys(weights).length > 0 && Array.isArray(p.indikator)) {
        const activeInd = p.indikator.filter(i => i.norm != null && weights[i.kode] > 0);
        const totalW = activeInd.reduce((sum, i) => sum + (weights[i.kode] || 0), 0);
        if (totalW > 0) {
          liveScore = Math.round(activeInd.reduce((sum, i) => sum + Number(i.norm) * (weights[i.kode] || 0), 0) / totalW * 10000) / 100;
        }
      }
      const category = meta?.kategori?.find(k => liveScore >= k.min)?.label || p.kategori_prioritas || 'Sedang';
      const id = Number(p.id_wilayah);
      const siswaKelasNum = m.siswa_dgn_kelas != null ? Number(m.siswa_dgn_kelas) : Number(m.jumlah_siswa || 0);
      const siswaGuruNum = m.siswa_dgn_guru != null ? Number(m.siswa_dgn_guru) : Number(m.jumlah_siswa || 0);
      const kelasTotal = Number(m.jumlah_ruang_kelas || 0);
      const guruTotal = Number(m.jumlah_guru || 0);
      const sekolahTotal = Number(m.jumlah_sekolah || 0);
      const cand = candidateMap.get(id) || { jumlah: 0, skor_tertinggi: null, disetujui: 0 };

      return {
        id,
        nama: p.nama_wilayah,
        skor: liveScore,
        kategori: category,
        luas_km2: m.luas_km2 != null ? Number(Number(m.luas_km2).toFixed(1)) : (p.luas_km2 != null ? Number(Number(p.luas_km2).toFixed(1)) : null),
        penduduk: Number(m.penduduk || 0),
        penduduk_usia_smp: Number(m.penduduk_usia_smp || 0),
        blank_pct: Number(Number(m.blank_pct || 0).toFixed(1)),
        jarak_terdekat_km: m.jarak_terdekat_km != null ? Number(Number(m.jarak_terdekat_km).toFixed(2)) : null,
        gap_kursi: Math.round(Number(m.gap_kursi || 0)),
        gap_kursi_layak: Math.round(Number(m.gap_kursi_layak || 0)),
        demand_kursi: Math.round(Number(m.demand_kursi || 0)),
        kapasitas_kursi: Math.round(Number(m.kapasitas_kursi || 0)),
        rusak_total: Number(m.ruang_kelas_rusak_total || 0),
        rusak_berat: Number(m.ruang_kelas_rusak_berat || 0),
        rusak_sedang: Number(m.ruang_kelas_rusak_sedang || 0),
        rusak_ringan: Number(m.ruang_kelas_rusak_ringan || 0),
        kelas_baik: Number(m.ruang_kelas_baik || 0),
        persen_kelas_rusak: Number(Number(m.persen_kelas_rusak || 0).toFixed(1)),
        sekolah_total: sekolahTotal,
        sekolah_negeri: Number(m.jumlah_sekolah_negeri || 0),
        sekolah_swasta: Number(m.jumlah_sekolah_swasta || 0),
        akreditasi_a: Number(m.akreditasi_a || 0),
        akreditasi_b: Number(m.akreditasi_b || 0),
        akreditasi_c: Number(m.akreditasi_c || 0),
        belum_terakreditasi: Number(m.belum_terakreditasi || 0),
        siswa_total: Number(m.jumlah_siswa || 0),
        guru_total: guruTotal,
        rombel_total: Number(m.jumlah_rombel || 0),
        kelas_total: kelasTotal,
        siswa_per_kelas: kelasTotal > 0 ? Number((siswaKelasNum / kelasTotal).toFixed(1)) : null,
        siswa_per_guru: guruTotal > 0 ? Number((siswaGuruNum / guruTotal).toFixed(1)) : null,
        siswa_per_sekolah: sekolahTotal > 0 ? Number((Number(m.jumlah_siswa || 0) / sekolahTotal).toFixed(0)) : null,
        kandidat_count: cand.jumlah,
        kandidat_max_skor: cand.skor_tertinggi,
        diagnosis: p.diagnosis || '',
        faktor_utama: p.rekomendasi?.faktor_utama || [],
        rekomendasi: (p.rekomendasi?.intervensi || []).map(i => ({ tipe: i.tipe, alasan: i.alasan, jumlah: i.jumlah })),
        raw_properties: p,
      };
    }).sort((a, b) => b.skor - a.skor).map((item, idx) => ({ ...item, ranking: idx + 1 }));

    const region = numericWilayahId ? features.find(f => Number(f.properties.id_wilayah) === numericWilayahId) : null;
    if (numericWilayahId && !region) {
      return res.status(404).json({ message: 'Kecamatan tidak tersedia pada peta ini.' });
    }

    if (question !== undefined) {
      const base = region ? Object.fromEntries([...topics].map(key => [key, explain(region.properties, meta, weights, key)])) : {};
      const validIds = new Set(allRanked.map(w => w.id));
      const recent = history.map(turn => ({
        question: turn.question, summary: turn.summary, topic: turn.topic,
        headline: String(turn.headline || '').slice(0, 100),
        districtIds: Array.isArray(turn.districtIds) ? turn.districtIds.slice(0, 6).map(Number).filter(id => validIds.has(id)) : [],
        scopeDistrictIds: Array.isArray(turn.scopeDistrictIds) ? turn.scopeDistrictIds.slice(0, 6).map(Number).filter(id => validIds.has(id)) : [],
        schoolIds: Array.isArray(turn.schoolIds) ? turn.schoolIds.slice(0, 5).map(Number).filter(Number.isSafeInteger) : [],
      }));
      const last = recent.at(-1);
      const request = staffingRequest(question, last);
      const global = /(?:seluruh|semua|se[- ]?)\s*bogor|seluruh (?:peta|kecamatan)/i.test(question);
      let focusDistrictIds = detectMentionedDistrictIds(question, allRanked);
      if (!focusDistrictIds.length && !global) {
        if (numericWilayahId) focusDistrictIds = [numericWilayahId];
        else if (request && last?.topic === 'guru_sekolah') focusDistrictIds = last.scopeDistrictIds;
        else if (last && (/tadi|tersebut|di sana|sebelumnya|lebih detail|(?:smp|sekolah)(?:nya)? mana|sekolah pertama/i.test(question)
            || (request && last.topic !== 'guru_sekolah' && /guru|pengajar|pendidik/i.test(last.question + ' ' + last.summary)))) {
          focusDistrictIds = last.districtIds.length ? last.districtIds : detectMentionedDistrictIds(last.summary, allRanked);
        }
      }
      if (request) {
        const districtIds = focusDistrictIds.length ? focusDistrictIds : [...validIds];
        const scopeName = focusDistrictIds.length ? allRanked.filter(w => focusDistrictIds.includes(w.id)).map(w => w.nama).join(', ') : 'seluruh Bogor';
        const reply = await schoolStaffingReply({ districtIds, scopeName, year: resolvedTahun, request, last });
        return res.json({ ...reply, scopeDistrictIds: focusDistrictIds, wilayahId: numericWilayahId });
      }
      const schoolsByDistrict = await fetchSchoolsForDistricts(focusDistrictIds, resolvedTahun);

      const reply = await answerQuestion({
        question: question.trim(),
        history: recent,
        previousTopic: recent.at(-1)?.topic || (topics.has(previousTopic) ? previousTopic : null),
        properties: region?.properties || null,
        allRanked,
        focusDistrictIds,
        schoolsByDistrict,
        meta,
        base,
        weights,
      });
      return res.json({ ...reply, wilayahId: numericWilayahId, tahun: resolvedTahun });
    }

    const result = region ? explain(region.properties, meta, weights, topic) : { summary: 'Pilih kecamatan atau ajukan pertanyaan.', evidence: [] };
    return res.json({ ...result, source: 'Ringkasan indikator', wilayahId: numericWilayahId, tahun: resolvedTahun });
  } catch (error) { return next(error); }
}

module.exports = { ask, explain };
