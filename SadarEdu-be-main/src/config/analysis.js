/**
 * Parameter analisis SADAR Edu.
 *
 * Semua angka di bawah adalah ASUMSI KERJA yang dapat diubah lewat .env.
 * Nilai-nilai ini BUKAN keputusan resmi pemerintah: sesuaikan dengan regulasi
 * dan standar Dinas Pendidikan setempat sebelum dipakai untuk rekomendasi nyata.
 */
const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};

const env = process.env;

module.exports = {
  // Kapasitas satu rombel/ruang kelas (acuan umum SMP: maksimum 32 siswa per rombel)
  SISWA_PER_ROMBEL: num(env.SISWA_PER_ROMBEL, 32),

  // Target angka partisipasi: porsi penduduk usia SMP yang ingin ditampung
  TARGET_APK: num(env.TARGET_APK, 0.9),

  // Radius jangkauan layanan sekolah (km) untuk analisis buffer / blank spot
  COVERAGE_RADIUS_KM: num(env.COVERAGE_RADIUS_KM, 3),

  // Ambang rasio untuk memicu diagnosis & rekomendasi intervensi
  AMBANG_SISWA_PER_GURU: num(env.AMBANG_SISWA_PER_GURU, 20),
  AMBANG_BLANK_SPOT_PCT: num(env.AMBANG_BLANK_SPOT_PCT, 30),

  // Sekolah baru "standar" untuk simulasi (3 rombel x 3 tingkat)
  SEKOLAH_BARU_RUANG_KELAS: num(env.SEKOLAH_BARU_RUANG_KELAS, 9),
  SEKOLAH_BARU_GURU: num(env.SEKOLAH_BARU_GURU, 18),

  // Sistem koordinat metrik untuk pembuatan grid (UTM 48S meliputi Bogor)
  UTM_SRID: num(env.UTM_SRID, 32748),

  // Kategori prioritas berdasarkan skor 0-100 (urut dari tertinggi)
  KATEGORI: [
    { min: 75, label: 'Sangat Tinggi' },
    { min: 55, label: 'Tinggi' },
    { min: 35, label: 'Sedang' },
    { min: 0, label: 'Rendah' },
  ],

  // Bobot default kriteria kesesuaian lokasi (area kandidat)
  BOBOT_KANDIDAT: {
    jarak_sekolah: 0.3,
    akses_jalan: 0.2,
    risiko_bencana: 0.15,
    lereng: 0.15,
    prioritas_wilayah: 0.2,
  },

  // Batas kelayakan lokasi kandidat
  KANDIDAT: {
    MIN_JARAK_SEKOLAH_KM: num(env.KANDIDAT_MIN_JARAK_SEKOLAH_KM, 1.0),
    MAX_JARAK_JALAN_KM: num(env.KANDIDAT_MAX_JARAK_JALAN_KM, 1.0),
    MAX_RISIKO_LEVEL: num(env.KANDIDAT_MAX_RISIKO_LEVEL, 3), // level >3 dieksklusi
    MAX_LERENG_PCT: num(env.KANDIDAT_MAX_LERENG_PCT, 25),
  },
};
