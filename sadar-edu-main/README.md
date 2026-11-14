# SADAR Edu — Frontend (React + Vite + Mapbox GL)

Sistem Informasi Geografis (Web GIS) dan Sistem Pendukung Keputusan untuk perencanaan pemerataan akses pendidikan SMP di Kabupaten Bogor. Terhubung langsung ke backend server `SadarEdu-be` (PostgreSQL + PostGIS).

---

## 🚀 Menjalankan Aplikasi

```bash
# 1. Pindah ke direktori frontend
cd sadar-edu-main

# 2. Siapkan file konfigurasi environment
cp .env.example .env     # Pastikan VITE_API_URL dan VITE_MAPBOX_ACCESS_TOKEN terisi

# 3. Instalasi dependensi
npm install

# 4. Jalankan dev server
npm run dev              # Buka http://localhost:5173
```

> **Catatan Server:** Pastikan backend Node.js berjalan di `http://localhost:5000` dengan database PostgreSQL aktif.

---

## 👥 Rute & Hak Akses Pengguna

| Rute | Pengguna | Fungsi & Deskripsi |
|---|---|---|
| `/peta` | Publik (Tanpa Login) | Peta interaktif sekolah, filter zonasi kecamatan, kategori kebutuhan layanan, blank spot, profil sekolah, dan alternatif sekolah terdekat. |
| `/login` | Staf (Operator / Stakeholder) | Otentikasi berbasis JWT token resmi; otomatis diarahkan ke ruang kerja sesuai peran. |
| `/stakeholder/dashboard` | Stakeholder & Kepala Dinas | Analisis Multi-Kriteria (MCDA), penyesuaian bobot prioritas, diagnosis wilayah, dan simulasi sekolah baru. |
| `/operator/dataset` | Operator Data Dinas | **Pusat pengelolaan dataset spasial, multi-versi tahunan, pembaruan data satuan sekolah, ekspor CSV, dan validasi data.** |

---

## 📖 PANDUAN LENGKAP OPERATOR: CARA MENGELOLA & MENGGANTI DATA

Operator bertugas sebagai **Kurator dan Penjaga Kualitas Data Spasial Pendidikan (Data Gatekeeper)**. Semua pekerjaan dilakukan langsung melalui antarmuka web **tanpa perlu membuka MySQL, pgAdmin, atau terminal database**.

### Kredensial Login Operator
* **Email:** `operator@sadaredu.id`
* **Password:** `operator123`
* **URL:** `http://localhost:5173/login`

---

### Skenario 1: Mengubah Nama Sekolah atau Memperbaiki Koordinat Satuan (Single Edit)
> *Gunakan skenario ini jika hanya ada 1 atau beberapa sekolah yang salah nama, salah alamat, atau titik koordinatnya keliru. **Tidak perlu mengunggah ulang ribuan baris CSV.***

1. Masuk ke menu **"Dataset Sekolah"** (`/operator/dataset`).
2. Klik tab **"Edit Cepat Satuan Sekolah (Update Nama / Atribut)"**.
3. Ketik nama sekolah atau NPSN pada kolom pencarian (contoh: *"Cibinong"*, *"SMP Swasta 12"*, dll), lalu klik **"Cari Sekolah"**.
4. Pada baris sekolah yang ingin diganti, klik tombol **"Edit"**.
5. Modal dialog akan terbuka:
   * **Nama Sekolah:** Ganti langsung dengan nama sekolah yang baru/benar.
   * **Alamat / Jenjang / Status:** Sesuaikan data jika diperlukan.
   * **Koordinat (Latitude & Longitude):** Masukkan koordinat baru jika titik sekolah bergeser.
6. Klik tombol **"Simpan Perubahan ke Database"**.
7. Data akan langsung ter-update di database PostgreSQL PostGIS via endpoint `PUT /api/v1/sekolah/:id`. Jika koordinat diubah, PostGIS otomatis menghitung ulang relasi kecamatan (`ST_Covers`).

---

### Skenario 2: Mengunggah Dataset Massal Tahun Baru (Contoh: Dataset 2028)
> *Gunakan skenario ini jika ada pembaruan data pokok pendidikan serentak per tahun (misal: Data Dapodik tahun 2028).*

1. Di halaman **"Kelola Dataset"**, klik tombol **"Impor Versi Baru (Massal)"** di pojok kanan atas.
2. Unggah file berkas sumber (`.csv` atau `.xlsx`) melalui drag-and-drop.
3. Sistem secara otomatis mencocokkan kolom (`NPSN`, `Nama Sekolah`, `Lintang`, `Bujur`, `Jumlah Siswa`).
4. **Pilihan Alur Impor:**
   * **Mode Impor Cepat (1-Klik ke DB):** Klik tombol hijau *"Impor Cepat (1-Klik ke DB)"*. Jika data 100% valid dan bersih, sistem langsung memvalidasi dan menyimpannya ke PostgreSQL secara instan.
   * **Mode Validasi Manual:** Klik *"Jalankan validasi berurutan"* untuk meninjau temuan baris data terlebih dahulu.
5. Pada tahap Review, masukkan tahun periode (misal: `2028`) pada isian *Informasi Sumber & Periode Data*.
6. Klik **"Terapkan & Simpan ke Database"**. Dataset 2028 kini resmi tersimpan di PostgreSQL sebagai versi baru.

---

### Skenario 3: Gonta-Ganti Versi Aktif Dataset (Multi-Tahun: 2026 vs 2028)
> *Sistem mendukung arsip multi-versi. Mengunggah versi 2028 tidak menghapus versi 2026.*

1. Buka halaman **"Kelola Dataset"** (`/operator/dataset`) pada tab **"Riwayat & Gonta-Ganti Versi Dataset"**.
2. Gunakan dropdown **"Filter Tahun Periode"** untuk melihat dataset berdasarkan tahun (misal: *Tahun 2026* atau *Tahun 2028*).
3. Di samping setiap baris dataset:
   * Klik tombol **"Jadikan Aktif"** untuk menjadikan dataset tersebut sebagai acuan resmi analisis dan peta interaktif publik.
   * Klik tombol **"Nonaktifkan"** jika versi tersebut ingin diarsipkan sementara.
4. Perubahan status aktif tersimpan permanen di PostgreSQL via API `PATCH /api/v1/dataset/:id`.

---

### Skenario 4: Memahami Arti Status "Perlu Perbaikan" & Cara Mengatasinya
* **Apa artinya?** Status *"Perlu perbaikan"* muncul jika ada baris data yang:
  * Koordinatnya jatuh di luar batas wilayah Kabupaten Bogor (misal nyasar ke laut atau kabupaten tetangga).
  * Format NPSN bukan 8 digit angka.
  * Nama sekolah kosong atau jumlah siswa/guru bernilai negatif.
* **Cara Mengatasinya:**
  1. Buka menu **"Validasi Data"** (`/operator/validasi`).
  2. Klik tombol **"Ke Halaman Perbaikan"** (`/operator/validasi/perbaikan`).
  3. Klik baris yang bermasalah, lalu isi perbaikan nilai atau pilih titik yang benar melalui peta spasial (*Spatial Picker*).
  4. Klik **"Terapkan Perbaikan"**.

---

### Skenario 5: Mengunggah Berkas GeoJSON Wilayah Kecamatan & Sebaran Sekolah Lengkap (.json / .geojson)
> *Sistem kini mendukung unggah berkas spasial format `.json` atau `.geojson` FeatureCollection secara langsung lewat peramban web.*

**Urutan Unggah Terbaik:**
1. **Langkah 1: Unggah Batas Wilayah Kecamatan (`wilayah_kecamatan_bogor (1).json`)**
   * Masuk ke **"Kelola Dataset"** (`/operator/dataset`) ➔ klik **"Impor Versi Baru (Massal)"**.
   * Tarik atau pilih berkas `wilayah_kecamatan_bogor (1).json`.
   * Sistem otomatis mendeteksi **MultiPolygon Batas Wilayah (46 Kecamatan)** beserta statistik kependudukan 2024.
   * Klik tombol hijau **"Impor Cepat (1-Klik ke DB)"**.
   * PostGIS akan otomatis menyimpan 46 poligon batas kecamatan dan menghitung luas wilayahnya (`ST_Area`).
2. **Langkah 2: Unggah Data Sekolah SMP Lengkap (`SMPbogorSudahDiolah.json`)**
   * Masuk kembali ke menu **"Impor Versi Baru"**.
   * Tarik atau pilih berkas `SMPbogorSudahDiolah.json`.
   * Sistem otomatis memetakan kolom (`NPSN`, `Nama Sekolah`, `Latitude`, `Longitude`, dll) untuk 918 sekolah.
   * Klik **"Impor Cepat (1-Klik ke DB)"** (atau jalankan validasi bertahap bila ingin mengisi sumber/periode).
   * Titik-titik sekolah langsung tersimpan di PostGIS (`Point EPSG:4326`), terhubung otomatis ke kecamatan terdekat (`ST_Covers`), dan tabel `statistik_pendidikan` (kondisi ruang kelas, guru, siswa) terisi lengkap.

---

### Skenario 6: Mengekspor Cadangan Data (.CSV & .GeoJSON)
> *Digunakan jika operator membutuhkan file spreadsheet offline untuk laporan dinas atau analisis di QGIS.*

1. Buka halaman **"Kelola Dataset"** (`/operator/dataset`).
2. Di pojok kanan atas, tersedia dua pilihan ekspor:
   * **Tombol "Ekspor CSV":** Mengunduh data sekolah aktif ke format `.csv` dengan UTF-8 BOM (siap buka di Microsoft Excel).
   * **Tombol "Unduh GeoJSON":** Mengunduh file spasial `.geojson` untuk keperluan software GIS.

---

### Skenario 7: Menghapus / Mengarsipkan Dataset Usang dari Database
1. Pada tabel riwayat dataset di `/operator/dataset`, klik ikon tempat sampah merah (**Hapus**) pada baris dataset yang ingin dibersihkan.
2. Modal konfirmasi keamanan akan muncul.
3. Klik **"Ya, Hapus Permanen"**.
4. Server mengeksekusi `DELETE /api/v1/dataset/:id` dan menghapus seluruh record spasial terkait secara aman dari database.

---

### Skenario 8: Memahami Perbedaan Titik Peta Publik vs Peta Operator
* **Di Peta Publik (`/peta`):** Hanya menampilkan **521 sekolah** yang berada strictly di dalam batas poligon Kabupaten Bogor. 96 sekolah yang koordinatnya nyasar ke luar daerah sengaja disembunyikan agar warga tidak bingung.
* **Di Peta Operator (`OperatorMapPreview` / `OperatorIndicatorMap`):**
  * Terdapat saklar: `[☑] Hanya tampilkan dalam batas Kab. Bogor (521 titik • Sama dengan Peta Publik)`.
  * Jika saklar diaktifkan, tampilan akan **100% sama dengan peta publik**.
  * Jika saklar dimatikan (Mode Audit), 96 titik yang nyasar ke luar Bogor akan ditampilkan dengan **warna MERAH (`🔴 Luar Bogor`)**, sehingga operator tahu sekolah mana saja yang perlu dikoreksi koordinatnya.

---

## 🏗️ Arsitektur Penyimpanan: CSV vs GeoJSON vs PostgreSQL + PostGIS

```
┌─────────────────────────────────┐
│ Input Operator (Upload CSV/XLS) │ ──(Parsing Lat/Lng)──┐
└─────────────────────────────────┘                      │
                                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│             DATABASE SERVER (PostgreSQL 16 + PostGIS)                  │
│  • Tabel: `sekolah`, `wilayah`, `dataset_metadata`, `statistik`        │
│  • Kolom Geometri: `geom GEOMETRY(Point, 4326)` & `geom (MultiPolygon)`│
│  • Spatial Index: GiST (untuk kueri buffer zonasi & irisan kecamatan) │
└────────────────────────────────────────────────────────────────────────┘
                               │
            (Query: `ST_AsGeoJSON(geom)`)
                               ▼
┌─────────────────────────────────┐
│ Distribusi API (GeoJSON Stream) │ ──(Render Layer & Marker)──► Peta Interaktif
│ Endpoint: `/sekolah/geojson`    │                              (Mapbox GL JS)
└─────────────────────────────────┘
```
