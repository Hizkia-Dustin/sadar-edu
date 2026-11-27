const db = require('../config/db');
const { active } = require('../utils/sql');

const teacher = /\b(guru|pengajar|pendidik)\b/i;
const schoolList = /\b(?:list|daftar|nama|rincian|detail)\s+(?:nama\s+)?(?:smp|sekolah)|\b(?:smp|sekolah)(?:nya)?\s+(?:mana|apa|yang|aja|saja)|\b(?:per|tiap) sekolah/i;
const ordinal = /\b(?:yang|sekolah|smp|urutan|nomor)\s+(pertama|kedua|ketiga|keempat|kelima|[1-5])\b/i;

function staffingRequest(question, last) {
  const q = question.toLowerCase();
  if (/\b(?:kecamatan|wilayah)(?:nya)?\s+mana|\b(?:berapa|jumlah)\s+(?:smp|sekolah)|kekurangan sekolah|butuh sekolah baru/.test(q)) return null;
  const refers = ordinal.exec(q);
  const previousStaffing = last?.topic === 'guru_sekolah';
  const singleReference = previousStaffing && last.schoolIds?.length === 1 && /sekolah (?:itu|ini|tersebut)|^(?:kenapa|mengapa)(?: begitu)?[?\s]*$/.test(q);
  const continuation = schoolList.test(q) || /^(?:lebih detail|rinci|detailnya|sebutkan namanya)/.test(q);
  if (!teacher.test(q) && /rusak|rehab|ruang kelas|blank spot|jangkauan|biaya/.test(q)) return null;
  if (!(schoolList.test(q) && teacher.test(q)) &&
      !(continuation && (previousStaffing || teacher.test([last?.question, last?.summary, last?.headline].join(' ')))) &&
      !(previousStaffing && (refers || singleReference || /^(?:(?:kalau|bagaimana)\s+)?(?:di\s+|yang (?:negeri|swasta))/.test(q)))) return null;

  const position = refers && (Number(refers[1]) || ['pertama','kedua','ketiga','keempat','kelima'].indexOf(refers[1]) + 1);
  return { position: singleReference ? 1 : position, status: /\bnegeri\b/.test(q) ? 'Negeri' : /\bswasta\b/.test(q) ? 'Swasta' : null };
}

async function schoolStaffingReply({ districtIds, scopeName, year, request, last }) {
  const schoolId = request.position ? last?.schoolIds?.[request.position - 1] : null;
  const common = { topic: 'guru_sekolah', source: 'Statistik sekolah SADAR EDU', suggested_layers: ['showSchools'], tahun: year };
  if (request.position && !schoolId) return { ...common, summary: 'Urutan itu belum ada dalam daftar SMP sebelumnya. Minta daftar SMP terlebih dahulu.' };
  // Gunakan cakupan spasial yang sama dengan analisis peta. Ambil statistik terbaru hingga tahun peta sebelum menyaring data kosong.
  const { rows } = await db.query(`
    WITH schools AS (
      SELECT DISTINCT ON (s.id_sekolah) s.id_sekolah, s.nama_sekolah, w.id_wilayah, w.nama_wilayah
      FROM wilayah w JOIN sekolah s ON ST_Covers(w.geom, s.geom)
      WHERE w.id_wilayah = ANY($1::bigint[]) AND ${active('s')} AND ${active('w')}
        AND upper(trim(s.jenjang)) = 'SMP'
        AND ($3::text IS NULL OR lower(s.status_sekolah) = lower($3))
        AND ($4::bigint IS NULL OR s.id_sekolah = $4)
      ORDER BY s.id_sekolah, w.id_wilayah
    )
    SELECT s.*, st.*, st.jumlah_siswa::numeric / NULLIF(st.jumlah_guru, 0) AS rasio
    FROM schools s JOIN LATERAL (
      SELECT x.tahun, x.jumlah_siswa, x.jumlah_guru FROM statistik_pendidikan x
      WHERE x.id_sekolah = s.id_sekolah AND x.tahun <= $2 AND ${active('x')}
      ORDER BY x.tahun DESC, x.id_statistik DESC LIMIT 1
    ) st ON TRUE
    WHERE st.jumlah_siswa > 0 AND st.jumlah_guru >= 0
    ORDER BY (st.jumlah_guru = 0) DESC, rasio DESC NULLS LAST, s.nama_sekolah, s.id_sekolah
    LIMIT 5`, [districtIds, year, request.status, schoolId || null]);

  const schools = rows.map(row => ({
    id: row.id_sekolah, name: row.nama_sekolah, district: row.nama_wilayah,
    detail: `${row.jumlah_siswa} siswa, ${row.jumlah_guru} guru · ${row.rasio == null ? 'jumlah guru tercatat nol, perlu verifikasi' : Number(row.rasio).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' siswa/guru'} · ${row.tahun}`,
  }));
  return { ...common, schools, headline: 'Beban guru per SMP',
    summary: schools.length ? `Di ${scopeName}, ${schoolId ? 'berikut rincian sekolah yang Anda pilih' : 'berikut SMP yang perlu ditinjau berdasarkan jumlah siswa per guru'}. Kebutuhan formasi guru perlu dikonfirmasi dengan data rombel dan mata pelajaran.`
      : `Belum ada data siswa dan guru yang dapat dibandingkan untuk SMP pada cakupan ${scopeName}.`,
    highlight_wilayah: [...new Set(rows.map(r => r.id_wilayah))],
    follow_ups: schools.length > 1 ? ['Rinci sekolah pertama.'] : [],
  };
}

module.exports = { staffingRequest, schoolStaffingReply };
