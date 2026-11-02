# SadarEdu Backend API (Express + PostgreSQL/PostGIS)

Backend **SADAR Edu**: Web GIS + sistem pendukung keputusan untuk analisis kebutuhan dan prioritas pembangunan SMP di Kabupaten Bogor (lihat *Project Charter*). Backend ini yang menghitung semua analisis spasial; FE hanya menampilkan.

> SADAR Edu menyediakan **bukti dan alternatif** untuk dipertimbangkan stakeholder. Hasilnya bukan penetapan lahan, bukan validasi status tanah/tata ruang, dan bukan keputusan kebijakan otomatis.

## Kebutuhan

- Node.js 18+
- PostgreSQL 15+ dengan **PostGIS ≥ 3.1** (memakai `ST_SquareGrid`, `ST_GeneratePoints`)

## Setup cepat

```bash
cp .env.example .env          # isi DB_*, JWT_SECRET, CORS_ORIGIN
npm install
# buat database kosong "SadarEdu", lalu:
npm run db:init               # menjalankan schema.sql (aman diulang, juga untuk DB lama)
npm run seed:users            # akun Operator & Stakeholder awal (kredensial dari .env)
npm run seed:demo             # OPSIONAL: data demo SINTETIS Kab. Bogor
npm run demo:hapus            # hapus data demo sebelum mengunggah data asli
npm run dev                   # http://localhost:5000
npm test                      # tes logika analisis, parser, role, simulasi
```

Server saat start otomatis mengisi master `role` dan katalog `indikator` (bobot yang sudah diubah Stakeholder tidak ditimpa).

**Data demo bukan data resmi.** Batas kecamatan dibuat dari poligon Voronoi, angka penduduk/sekolah dibangkitkan acak-deterministik. Semua dataset demo bersumber `DEMO ...` sehingga FE menampilkan banner. Untuk data nyata: hapus dataset demo di Panel Operator lalu unggah data resmi (BPS, BIG, BNPB/InaRISK, Disdik).

## Alur kerja data → analisis

1. **Operator** unggah dataset (`POST /dataset/import`, atau lewat Panel Operator) dengan urutan: `wilayah` → `kependudukan` → `sekolah` (+ statistik) → `statistik` → opsional `jalan`, `risiko_bencana`, `lereng`, `kawasan_lindung`.
2. Setelah impor yang memengaruhi analisis, server otomatis menghitung ulang (atau `POST /analisis/hitung`).
3. Publik melihat kategori kebutuhan, blank spot, sekolah, alternatif sekolah.
4. **Stakeholder/Operator**: atur bobot MCDA, lihat diagnosis & intervensi, buat area kandidat, jalankan simulasi.

### Format dataset (kolom/properti yang dikenali)

| Kategori | Bentuk | Kolom/properti |
|---|---|---|
| `wilayah` | GeoJSON poligon | `kode_bps` (alias `KDCPUM`,`KDKEC`), `nama_wilayah` (alias `WADMKC`,`NAMOBJ`), `level_wilayah` (default `Kecamatan`), `luas_km2` opsional |
| `kependudukan` | CSV/JSON | `kode_bps`, `tahun`, `jumlah_penduduk`, `penduduk_usia_smp` (13–15 th) |
| `sekolah` | GeoJSON titik / CSV | `npsn`, `nama_sekolah` (atau `nama`), `status_sekolah` (atau `status`), `latitude`/`longitude` (atau geometri Point); opsional `alamat`, `akreditasi` (A/B/C; selain itu dikosongkan), `kecamatan`, `kabupaten`, `desaKelurahan`, `jumlahSiswa`/`jumlah_siswa`, `jumlahGuru`, `jumlah_rombel`, `ruangKelas`, `ruangKelasBaik/RusakRingan/RusakSedang/RusakBerat`, `tahun`. Penamaan camelCase dan snake_case sama-sama dikenali |
| `statistik` | CSV/JSON | `npsn`, `tahun`, `jumlah_siswa`, `jumlah_guru`, `jumlah_rombel`, `jumlah_ruang_kelas` |
| `jalan` | GeoJSON garis | `nama`, `kelas_jalan` opsional |
| `risiko_bencana` | GeoJSON poligon | `level` 1–5 (atau Rendah/Sedang/Tinggi/Sangat Tinggi) |
| `lereng` | GeoJSON poligon | `nilai` = kemiringan (%) |
| `kawasan_lindung` | GeoJSON poligon | — |

`crs` default 4326; isi kode EPSG lain bila berkas berada di CRS berbeda (dikonversi server). CSV boleh berpemisah koma atau titik-koma. Kode `kode_bps` pada `kependudukan` harus sama dengan batas wilayah. Berkas > ±45 MB: potong ke area studi & sederhanakan geometri di QGIS dulu.

Setiap baris data tertaut ke dataset asalnya sehingga dataset dapat **dinonaktifkan** (tidak ikut analisis/peta) atau **dihapus beserta datanya**. Setelah perubahan, jalankan hitung ulang.

### Data kosong ≠ nol

Pada data sekolah nyata banyak nilai belum terisi (mis. `ruangKelas: null`). Importer menyimpannya sebagai **kosong (NULL)**, dan nilai `0` pada siswa/guru/ruang kelas ikut dianggap kosong (dapat dimatikan dengan `nol_dianggap_kosong: false`). Mesin analisis lalu: (1) menghitung rasio siswa/kelas hanya dari sekolah yang ruang kelasnya tercatat, (2) rasio siswa/guru hanya dari sekolah yang gurunya tercatat, (3) menganggap kapasitas sekolah tanpa data ruang kelas setara jumlah siswanya (netral), dan (4) mencatat kelengkapan di diagnosis. Tanpa ini, kecamatan dengan data bolong akan tampak lebih padat daripada kenyataannya.

### Sekolah sebelum batas wilayah tersedia

Dataset `sekolah` dapat diunggah lebih dulu. Peta publik tetap menampilkan sekolah dan filter kecamatan memakai nama kecamatan dari data sumber. Analisis (skor, blank spot, kandidat) baru berjalan setelah dataset `wilayah` dan `kependudukan` ada; sekolah otomatis terhubung ke kecamatan lewat spatial join saat batas wilayah diunggah.

Sekolah Kota Bogor ikut tersimpan (`kabupaten_kota`) dan ikut menghitung jangkauan layanan kecamatan Kabupaten di sekitarnya, tetapi tidak masuk peringkat selama polygon kecamatan Kota Bogor tidak diunggah sebagai level `Kecamatan`.

## Metodologi (ringkas)

Per **kecamatan**, dari data aktif:

| Indikator | Arti | Bobot awal |
|---|---|---|
| `GAP_KAPASITAS` | % estimasi penduduk usia SMP yang tidak tertampung kapasitas kelas | 20% |
| `RASIO_SISWA_KELAS` | siswa ÷ ruang kelas | 15% |
| `BEBAN_SISWA_SEKOLAH` | siswa ÷ sekolah | 10% |
| `RASIO_SISWA_GURU` | siswa ÷ guru | 10% |
| `KEPADATAN_USIA_SMP` | penduduk usia SMP per km² | 15% |
| `AKSES_BLANK_SPOT` | % luas kecamatan di luar buffer radius (default 3 km) dari semua sekolah | 20% |
| `JARAK_SEKOLAH` | jarak titik representatif kecamatan ke sekolah terdekat | 10% |

Normalisasi min-max antar-kecamatan → skor = Σ(bobot × nilai) / Σ(bobot indikator yang tersedia) × 100. Kategori: ≥75 Sangat Tinggi, ≥55 Tinggi, ≥35 Sedang, selain itu Rendah. Indikator tanpa data dilewati dan bobotnya dinormalkan ulang. Kebutuhan kursi = penduduk usia SMP × `TARGET_APK`; kapasitas = ruang kelas × `SISWA_PER_ROMBEL`.

**Area kandidat**: grid (default 1 km) di kecamatan berperingkat teratas; sel dieksklusi bila terlalu dekat sekolah eksisting, di kawasan lindung, risiko bencana > level 3, atau lereng > 25%; sisanya diberi skor dari jarak ke sekolah (mengisi blank spot), akses jalan, risiko, lereng, dan skor prioritas kecamatan. Layer yang datanya belum ada dilewati (dicatat di respons).

**Simulasi**: tambah sekolah baru / ruang kelas / guru → hitung ulang indikator & skor dengan rentang normalisasi yang sama, sehingga "sebelum" identik dengan skor tersimpan. Bila lokasi (area kandidat) dipilih, efek buffer terhadap blank spot & jarak dihitung dengan PostGIS.

### Asumsi yang dapat diubah (`.env`)

`SISWA_PER_ROMBEL=32`, `TARGET_APK=0.9`, `COVERAGE_RADIUS_KM=3`, `AMBANG_SISWA_PER_GURU=20`, `AMBANG_BLANK_SPOT_PCT=30`, `SEKOLAH_BARU_RUANG_KELAS=9`, `SEKOLAH_BARU_GURU=18`, `KANDIDAT_*`. Ini asumsi kerja, **bukan standar resmi**; sesuaikan dengan regulasi dan arahan Dinas Pendidikan.

## Hak akses

| Peran | Akses |
|---|---|
| Publik (tanpa login) | `GET` wilayah, sekolah (+detail, alternatif, nearby), `/analisis/prioritas|blank-spots|coverage|ringkasan`, `/indikator` |
| Stakeholder | + `/analisis/hitung|intervensi|status`, `PUT /indikator/bobot`, `/candidate-areas/*`, `/simulasi/*` |
| Operator | semua hak Stakeholder + `/dataset/*`, CRUD sekolah & statistik, `/auth/users` |

Registrasi mandiri (`POST /auth/register`) **selalu** menghasilkan role Umum. Akun Stakeholder/Operator dibuat Operator lewat `POST /auth/users` atau `npm run seed:users`.

## Endpoint utama (`/api/v1`)

```
POST /auth/login · GET /auth/profile · POST /auth/register · GET|POST /auth/users (Operator)
GET  /wilayah/list · /wilayah/geojson · /wilayah/:id
GET  /sekolah/geojson?q=&status_sekolah=&id_wilayah=&tahun= · /sekolah/nearby · /sekolah/:id · /sekolah/:id/alternatif
POST|PUT|DELETE /sekolah[/:id] (Operator) · GET|POST /sekolah/statistik
GET  /indikator · PUT /indikator/bobot {bobot:{KODE:0..1}}
GET  /analisis/prioritas · /blank-spots?radius_km= · /coverage · /ringkasan
POST /analisis/hitung {tahun?, radius_km?} · GET /analisis/intervensi · /analisis/status
POST /candidate-areas/generate · GET /candidate-areas/geojson · PATCH|DELETE /candidate-areas/:id
POST /simulasi/scenarios {id_wilayah, tipe_intervensi, simpan?, parameter_json} · GET /simulasi/scenarios · DELETE /simulasi/scenarios/:id
GET  /dataset · /dataset/kategori · POST /dataset/import · PATCH|DELETE /dataset/:id   (Operator)
```

Respons sukses `{ success: true, data, ... }`; galat `{ success: false, message }` dengan status 400/401/403/404/409.

## Batasan yang perlu diketahui

- Analisis dihitung per **kecamatan** (bukan desa). Jarak memakai garis lurus/buffer, **bukan routing jaringan jalan** (sesuai batas klaim charter).
- Sekolah dihitung milik kecamatan yang memuat titiknya; sekolah di perbatasan melayani kecamatan tetangga melalui buffer, tetapi rasio siswa/kelas hanya menghitung sekolah di dalam kecamatan.
- Data lereng/risiko berbentuk poligon (hasil olahan QGIS), bukan raster mentah.
- Belum ada rate limiting; tambahkan (mis. `express-rate-limit`) sebelum dipublikasikan.
- `ST_SquareGrid` + `UTM_SRID=32748` cocok untuk Bogor (UTM 48S); ubah bila area studi berpindah zona.
