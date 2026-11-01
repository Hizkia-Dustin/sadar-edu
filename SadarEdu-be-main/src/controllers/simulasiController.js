const db = require('../config/db');
const cfg = require('../config/analysis');
const S = require('../services/scoring');
const analysis = require('../services/analysisService');
const { httpError } = require('../middleware/errorHandler');

const TIPE = ['Sekolah Baru', 'Penambahan Ruang Kelas', 'Penambahan Guru', 'Kombinasi'];

const boundedInt = (v, max, name) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw httpError(400, `${name} harus berupa angka antara 0 dan ${max}.`);
  return Math.round(n);
};

const getScenarios = async (req, res, next) => {
  try {
    const params = [];
    let sql = `SELECT s.*, w.nama_wilayah, h.id_hasil, h.skor_sebelum, h.skor_sesudah, h.indikator_sebelum, h.indikator_sesudah
               FROM scenario_intervensi s
               LEFT JOIN wilayah w ON s.id_wilayah = w.id_wilayah
               LEFT JOIN hasil_simulasi h ON h.id_scenario = s.id_scenario WHERE 1=1`;
    if (req.query.id_wilayah) { params.push(req.query.id_wilayah); sql += ` AND s.id_wilayah = $${params.length}`; }
    sql += ' ORDER BY s.id_scenario DESC LIMIT 100';
    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

const deleteScenario = async (req, res, next) => {
  try {
    const r = await db.query('DELETE FROM scenario_intervensi WHERE id_scenario = $1 RETURNING id_scenario', [req.params.id]);
    if (r.rows.length === 0) throw httpError(404, 'Skenario tidak ditemukan.');
    res.json({ success: true, message: 'Skenario dihapus.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Menjalankan simulasi "bagaimana-jika" untuk satu wilayah.
 * Body: { id_wilayah, nama_scenario, tipe_intervensi, tahun?, simpan?,
 *         parameter_json: { sekolah_baru, ruang_kelas, guru, id_candidate | lokasi:[{lat,lng}], serap_kebutuhan } }
 * simpan=false -> hanya menghitung (pratinjau) tanpa menyimpan skenario.
 */
const createScenario = async (req, res, next) => {
  try {
    const b = req.body || {};
    const p = b.parameter_json || {};
    if (!b.id_wilayah) throw httpError(400, 'id_wilayah wajib diisi.');
    const tipe = b.tipe_intervensi || 'Kombinasi';
    if (!TIPE.includes(tipe)) throw httpError(400, `tipe_intervensi harus salah satu: ${TIPE.join(', ')}.`);
    const simpan = b.simpan !== false;
    if (simpan && !b.nama_scenario) throw httpError(400, 'nama_scenario wajib diisi.');

    let sekolahBaru = boundedInt(p.sekolah_baru, 50, 'sekolah_baru');
    const ruangKelas = boundedInt(p.ruang_kelas, 1000, 'ruang_kelas');
    const guru = boundedInt(p.guru, 1000, 'guru');

    const tahun = await analysis.resolveTahun(b.tahun);
    const ps = await db.query(
      `SELECT p.metrik, w.nama_wilayah FROM priority_score p JOIN wilayah w ON w.id_wilayah = p.id_wilayah
       WHERE p.id_wilayah = $1 AND p.tahun = $2`,
      [b.id_wilayah, tahun]
    );
    if (ps.rows.length === 0 || !ps.rows[0].metrik) {
      throw httpError(409, 'Skor prioritas wilayah ini belum dihitung. Jalankan perhitungan analisis terlebih dahulu.');
    }
    const metrik = ps.rows[0].metrik;

    const indikator = await analysis.getIndikator();
    const st = await db.query(
      `SELECT i.kode_indikator, MIN(ni.nilai_raw) AS min, MAX(ni.nilai_raw) AS max
       FROM nilai_indikator ni JOIN indikator i ON i.id_indikator = ni.id_indikator
       WHERE ni.tahun = $1 GROUP BY i.kode_indikator`,
      [tahun]
    );
    const stats = Object.fromEntries(st.rows.map((r) => [r.kode_indikator, { min: r.min, max: r.max }]));

    // Lokasi sekolah baru (opsional) -> efek aksesibilitas
    const points = [];
    if (p.id_candidate) {
      const c = await db.query('SELECT ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat FROM candidate_area WHERE id_candidate = $1', [p.id_candidate]);
      if (c.rows.length === 0) throw httpError(404, 'Area kandidat tidak ditemukan.');
      points.push({ lng: c.rows[0].lng, lat: c.rows[0].lat });
    }
    (Array.isArray(p.lokasi) ? p.lokasi : []).slice(0, 20).forEach((l) => {
      const lat = Number(l.lat ?? l.latitude);
      const lng = Number(l.lng ?? l.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw httpError(400, 'Koordinat lokasi tidak valid.');
      points.push({ lng, lat });
    });
    if (points.length > 0) sekolahBaru = Math.max(sekolahBaru, points.length);
    if (tipe === 'Sekolah Baru' && sekolahBaru === 0) sekolahBaru = 1;

    const skenario = {
      sekolah_baru: sekolahBaru, ruang_kelas: ruangKelas, guru,
      ruang_kelas_per_sekolah: p.ruang_kelas_per_sekolah, guru_per_sekolah: p.guru_per_sekolah,
      serap_kebutuhan: p.serap_kebutuhan,
    };
    let akses = null;
    if (points.length > 0) {
      const radius = metrik.radius_km || cfg.COVERAGE_RADIUS_KM;
      akses = await analysis.accessAfterNewSchools(b.id_wilayah, radius, points);
      if (akses) {
        skenario.blank_pct_after = akses.blank_pct;
        skenario.jarak_after = akses.jarak_km;
      }
    }

    const sim = S.simulate({ metrics: metrik, skenario, indikator, stats, cfg });
    const catatan = [];
    if (sekolahBaru > 0 && points.length === 0) {
      catatan.push('Lokasi sekolah baru tidak dipilih, sehingga efek terhadap aksesibilitas (blank spot & jarak) belum dihitung. Pilih area kandidat untuk memasukkannya.');
    }
    if (skenario.serap_kebutuhan === false) catatan.push('Jumlah siswa dianggap tetap (tanpa penyerapan penduduk yang belum tertampung).');

    let tersimpan = null;
    if (simpan) {
      tersimpan = await db.withTransaction(async (client) => {
        const sc = await client.query(
          `INSERT INTO scenario_intervensi (id_wilayah, nama_scenario, tipe_intervensi, perubahan_kapasitas, parameter_json)
           VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
          [b.id_wilayah, b.nama_scenario, tipe, sim.tambahan.kapasitas_kursi, JSON.stringify({ ...p, sekolah_baru: sekolahBaru, tahun, lokasi_dihitung: points })]
        );
        const h = await client.query(
          `INSERT INTO hasil_simulasi (id_scenario, skor_sebelum, skor_sesudah, indikator_sebelum, indikator_sesudah)
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING *`,
          [sc.rows[0].id_scenario, sim.before.skor, sim.after.skor, JSON.stringify(sim.before), JSON.stringify(sim.after)]
        );
        return { scenario: sc.rows[0], hasil_simulasi: h.rows[0] };
      });
    }

    res.status(simpan ? 201 : 200).json({
      success: true,
      message: simpan ? 'Skenario simulasi disimpan dan dihitung.' : 'Pratinjau simulasi dihitung (tidak disimpan).',
      wilayah: { id_wilayah: Number(b.id_wilayah), nama_wilayah: ps.rows[0].nama_wilayah },
      tahun,
      simulasi: sim,
      akses_setelah: akses,
      catatan,
      ...(tersimpan || {}),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getScenarios, createScenario, deleteScenario };
