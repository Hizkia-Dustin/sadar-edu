-- ==========================================
-- DDL SCHEMA DATABASE SADAREDU (POSTGRESQL + POSTGIS)
-- Sistem Informasi Geografis & SDSS Pendidikan
-- ==========================================

-- 1. Aktifkan Extension PostGIS untuk data Spatial/Geospasial
CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------
-- MODUL A: USER & METADATA DATASET
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS role (
    id_role SERIAL PRIMARY KEY,
    nama_role VARCHAR(50) UNIQUE NOT NULL,
    deskripsi TEXT
);

CREATE TABLE IF NOT EXISTS user_account (
    id_user BIGSERIAL PRIMARY KEY,
    id_role INT REFERENCES role(id_role) ON DELETE SET NULL,
    nama VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status_aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dataset_metadata (
    id_dataset BIGSERIAL PRIMARY KEY,
    uploaded_by BIGINT REFERENCES user_account(id_user) ON DELETE SET NULL,
    nama_dataset VARCHAR(150) NOT NULL,
    kategori VARCHAR(50),
    sumber TEXT,
    tahun INT,
    format VARCHAR(20),
    crs VARCHAR(20),
    status_validasi VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------
-- MODUL B: MASTER WILAYAH & SPATIAL (POSTGIS)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS wilayah (
    id_wilayah BIGSERIAL PRIMARY KEY,
    kode_bps VARCHAR(20) UNIQUE NOT NULL,
    parent_id BIGINT REFERENCES wilayah(id_wilayah) ON DELETE SET NULL,
    nama_wilayah VARCHAR(120) NOT NULL,
    level_wilayah VARCHAR(30), -- e.g. Provinsi, Kabupaten, Kecamatan, Desa
    luas_km2 NUMERIC(12, 4),
    geom GEOMETRY(MULTIPOLYGON, 4326) -- Spatial Geometry EPSG:4326
);

-- Indeks Spasial GiST untuk tabel wilayah
CREATE INDEX IF NOT EXISTS idx_wilayah_geom ON wilayah USING GIST (geom);

CREATE TABLE IF NOT EXISTS sekolah (
    id_sekolah BIGSERIAL PRIMARY KEY,
    npsn VARCHAR(20) UNIQUE NOT NULL,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE SET NULL,
    nama_sekolah VARCHAR(160) NOT NULL,
    status_sekolah VARCHAR(20), -- e.g. Negeri / Swasta
    alamat TEXT,
    jenjang VARCHAR(20), -- e.g. SMP / MTs
    geom GEOMETRY(POINT, 4326) -- Spatial Point EPSG:4326
);

-- Indeks Spasial GiST untuk titik lokasi sekolah
CREATE INDEX IF NOT EXISTS idx_sekolah_geom ON sekolah USING GIST (geom);

-- ------------------------------------------
-- MODUL C: DEMOGRAFI & STATISTIK SEKOLAH
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS kependudukan (
    id_penduduk BIGSERIAL PRIMARY KEY,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE CASCADE,
    tahun INT NOT NULL,
    jumlah_penduduk INT DEFAULT 0,
    penduduk_usia_smp INT DEFAULT 0,
    kepadatan NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS statistik_pendidikan (
    id_statistik BIGSERIAL PRIMARY KEY,
    id_sekolah BIGINT REFERENCES sekolah(id_sekolah) ON DELETE CASCADE,
    tahun INT NOT NULL,
    jumlah_siswa INT DEFAULT 0,
    jumlah_guru INT DEFAULT 0,
    jumlah_rombel INT DEFAULT 0,
    jumlah_ruang_kelas INT DEFAULT 0
);

-- ------------------------------------------
-- MODUL D: INDIKATOR & SKOR PRIORITAS
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS indikator (
    id_indikator SERIAL PRIMARY KEY,
    kode_indikator VARCHAR(20) UNIQUE NOT NULL,
    nama_indikator VARCHAR(150) NOT NULL,
    satuan VARCHAR(50),
    arah_pengaruh VARCHAR(15), -- Positif / Negatif
    bobot NUMERIC(5, 4)
);

CREATE TABLE IF NOT EXISTS nilai_indikator (
    id_nilai BIGSERIAL PRIMARY KEY,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE CASCADE,
    id_indikator INT REFERENCES indikator(id_indikator) ON DELETE CASCADE,
    tahun INT NOT NULL,
    nilai_raw NUMERIC(14, 4),
    nilai_normalisasi NUMERIC(8, 4)
);

CREATE TABLE IF NOT EXISTS priority_score (
    id_priority BIGSERIAL PRIMARY KEY,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE CASCADE,
    tahun INT NOT NULL,
    skor_total NUMERIC(8, 4),
    ranking INT,
    kategori_prioritas VARCHAR(50),
    diagnosis TEXT
);

-- ------------------------------------------
-- MODUL E: PERENCANAAN & SIMULASI INTERVENSI
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS candidate_area (
    id_candidate BIGSERIAL PRIMARY KEY,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE CASCADE,
    tahun INT NOT NULL,
    skor_suitability NUMERIC(8, 4),
    status_kandidat VARCHAR(50),
    luas_ha NUMERIC(12, 4),
    geom GEOMETRY(POLYGON, 4326) -- Spatial Polygon EPSG:4326
);

-- Indeks Spasial GiST untuk candidate_area
CREATE INDEX IF NOT EXISTS idx_candidate_area_geom ON candidate_area USING GIST (geom);

CREATE TABLE IF NOT EXISTS scenario_intervensi (
    id_scenario BIGSERIAL PRIMARY KEY,
    id_wilayah BIGINT REFERENCES wilayah(id_wilayah) ON DELETE CASCADE,
    nama_scenario VARCHAR(150) NOT NULL,
    tipe_intervensi VARCHAR(50),
    perubahan_kapasitas INT,
    parameter_json JSONB
);

CREATE TABLE IF NOT EXISTS hasil_simulasi (
    id_hasil BIGSERIAL PRIMARY KEY,
    id_scenario BIGINT REFERENCES scenario_intervensi(id_scenario) ON DELETE CASCADE,
    skor_sebelum NUMERIC(8, 4),
    skor_sesudah NUMERIC(8, 4),
    indikator_sebelum JSONB,
    indikator_sesudah JSONB
);


-- ==========================================================
-- REVISI v2 (idempotent: aman dijalankan ulang di database lama)
-- Menambah kolom, tabel jalan & constraint spasial, dan unique index
-- yang dibutuhkan fitur analisis (skor prioritas, area kandidat, simulasi).
-- Kebutuhan: PostGIS >= 3.1 (memakai ST_SquareGrid).
-- ==========================================================

-- Metadata dataset: dipakai Operator untuk mengelola layer
ALTER TABLE dataset_metadata ADD COLUMN IF NOT EXISTS target_tabel VARCHAR(40);
ALTER TABLE dataset_metadata ADD COLUMN IF NOT EXISTS jumlah_fitur INT DEFAULT 0;
ALTER TABLE dataset_metadata ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE;
ALTER TABLE dataset_metadata ADD COLUMN IF NOT EXISTS catatan TEXT;

-- Tabel jalan (overlay akses jalan untuk area kandidat)
CREATE TABLE IF NOT EXISTS jalan (
    id_jalan BIGSERIAL PRIMARY KEY,
    nama VARCHAR(200),
    kelas_jalan VARCHAR(50),
    geom GEOMETRY(LINESTRING, 4326)
);

-- Layer constraint: risiko bencana (level 1-5), lereng (nilai = % kemiringan),
-- kawasan lindung (area terlarang)
CREATE TABLE IF NOT EXISTS layer_constraint (
    id_constraint BIGSERIAL PRIMARY KEY,
    jenis VARCHAR(30) NOT NULL, -- risiko_bencana | lereng | kawasan_lindung
    nama VARCHAR(200),
    level INT,
    nilai NUMERIC(10, 3),
    geom GEOMETRY(MULTIPOLYGON, 4326)
);

-- Penanda dataset asal setiap baris (untuk aktif/nonaktif & hapus layer)
ALTER TABLE wilayah ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;
ALTER TABLE kependudukan ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;
ALTER TABLE statistik_pendidikan ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;
ALTER TABLE jalan ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;
ALTER TABLE layer_constraint ADD COLUMN IF NOT EXISTS id_dataset BIGINT REFERENCES dataset_metadata(id_dataset) ON DELETE SET NULL;

-- Kolom tambahan
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS akreditasi VARCHAR(5);
ALTER TABLE indikator ADD COLUMN IF NOT EXISTS kelompok VARCHAR(40);
ALTER TABLE indikator ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE priority_score ADD COLUMN IF NOT EXISTS metrik JSONB;
ALTER TABLE priority_score ADD COLUMN IF NOT EXISTS rekomendasi JSONB;
ALTER TABLE candidate_area ADD COLUMN IF NOT EXISTS detail JSONB;

-- Unique index (dibutuhkan untuk upsert). Jika gagal dibuat karena data
-- ganda di database lama, hapus duplikat dulu lalu jalankan ulang file ini.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kependudukan_wilayah_tahun ON kependudukan (id_wilayah, tahun);
CREATE UNIQUE INDEX IF NOT EXISTS uq_statistik_sekolah_tahun ON statistik_pendidikan (id_sekolah, tahun);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nilai_indikator ON nilai_indikator (id_wilayah, id_indikator, tahun);
CREATE UNIQUE INDEX IF NOT EXISTS uq_priority_wilayah_tahun ON priority_score (id_wilayah, tahun);

-- Index bantu
CREATE INDEX IF NOT EXISTS idx_jalan_geom ON jalan USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_layer_constraint_geom ON layer_constraint USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_layer_constraint_jenis ON layer_constraint (jenis);
CREATE INDEX IF NOT EXISTS idx_sekolah_wilayah ON sekolah (id_wilayah);
CREATE INDEX IF NOT EXISTS idx_wilayah_level ON wilayah (level_wilayah);
CREATE INDEX IF NOT EXISTS idx_candidate_tahun ON candidate_area (tahun);

-- REVISI v3: atribut asal sekolah & kondisi ruang kelas (dari data Dapodik/Kemendikdasmen)
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS kabupaten_kota VARCHAR(40);
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS kecamatan_asal VARCHAR(100);
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS desa_kelurahan VARCHAR(100);
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE statistik_pendidikan ADD COLUMN IF NOT EXISTS ruang_kelas_baik INT;
ALTER TABLE statistik_pendidikan ADD COLUMN IF NOT EXISTS ruang_kelas_rusak_ringan INT;
ALTER TABLE statistik_pendidikan ADD COLUMN IF NOT EXISTS ruang_kelas_rusak_sedang INT;
ALTER TABLE statistik_pendidikan ADD COLUMN IF NOT EXISTS ruang_kelas_rusak_berat INT;
CREATE INDEX IF NOT EXISTS idx_sekolah_kecamatan_asal ON sekolah (kecamatan_asal);
