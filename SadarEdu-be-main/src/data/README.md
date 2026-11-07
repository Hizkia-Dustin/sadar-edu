# Batas kecamatan dan penduduk Bogor

Snapshot untuk peta publik `/peta`, diakses melalui `GET /api/v1/analisis/penduduk`.
Memuat **40 kecamatan Kabupaten Bogor + 6 kecamatan Kota Bogor**. Diambil pada
4 November 2026; tahun pengambilan bukan tahun statistik.

## Sumber dan pengolahan

| Data | Sumber | Pengolahan |
| --- | --- | --- |
| Batas 46 kecamatan kabupaten dan kota | [BIG, Peta Wilayah Administrasi Kecamatan](https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3) | Satu coverage, edisi 2022 (revisi 27 Desember 2022). Garis kabupaten/kota diturunkan dari geometri yang sama. |
| Penduduk kabupaten 2024 | [BPS Kabupaten Bogor](https://bogorkab.bps.go.id/id/statistics-table/2/MjkjMg%3D%3D/jumlah-penduduk.html%7C) | Jumlah laki-laki + perempuan, estimasi hasil SP2020. Total 5.682.303 jiwa. |
| Penduduk kota 2024 | [BPS Kota Bogor](https://bogorkota.bps.go.id/id/statistics-table/2/MTAwOCMy/Batagor%20-%20Bahas%20Data%20Kota%20Bogor) | Kolom **Penduduk (jiwa)**, catatan Disdukcapil DKB semester I Juni 2024. Total 1.137.018 jiwa. Jangan menjumlahkan kolom L/P lain pada tabel tersebut. |

Angka sumber disalin ke `bogor-population-2024.json` agar mudah diperiksa dan
diperbarui tanpa membaca koordinat. Nama sumber `Kelapa Nunggal` dipadankan dengan
`Klapanunggal`; variasi spasi nama dipadankan tanpa spasi dan huruf kecil.
ID `geo:*` adalah ID internal aplikasi, **bukan kode BPS** atau primary key tabel
`wilayah`. Kode BIG `kdcpum` disimpan terpisah sebagai `kode_kecamatan`.

Metode penduduk kabupaten dan kota berbeda. Warna menunjukkan **jumlah jiwa**,
bukan kepadatan, bukan penduduk usia SMP, dan bukan skor kebutuhan sekolah.
Karena itu angka penduduk total BPS tidak diimpor ke tabel kependudukan atau
dianggap penduduk usia SMP untuk MCDA. Geometri snapshot juga digunakan untuk
pratinjau kebutuhan di bawah. Tidak ada aktivasi ulang dataset demo atau perubahan
database pada proses ini.

## Membuat ulang snapshot

Prasyarat pengolahan saja: Python dengan Shapely 2.1. Runtime backend tidak
membutuhkan Python. Simpan respons GeoJSON dari endpoint `/query` berikut:

BIG `/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3/query`:
`where=kdpkab IN ('32.01','32.71')`,
`outFields=namobj,wadmkc,wadmkk,kdpkab,kdcpum`, `returnGeometry=true`,
`outSR=4326`, `f=geojson` → `bogor-big-districts-source.geojson` (46 fitur).

Dari folder backend:

```powershell
python src/scripts/prepareBogorDistricts.py C:/path/to/source-folder
node --test test/bogorMap.test.js
python test/bogorGeometry.test.py
```

Script menyederhanakan seluruh coverage sekaligus dengan
`coverage_simplify(tolerance=0.0001)` agar kedua sisi batas memakai vertex sama.
Koordinat dibulatkan tujuh desimal dan coverage diperiksa ulang. Script berhenti
jika ada overlap, sambungan tidak valid, celah internal, atau total data berubah.
Hasil `bogor-kecamatan.geojson.json` sekitar 979 KB tanpa kompresi. Dua outline
pada `sadar-edu-main/src/data/` dibangun dengan union coverage yang sama.

Perbaikan ini menggantikan campuran Geoportal kabupaten 2021 + SIGAPP kota yang
menimbulkan celah nyata. Tidak ada penambalan dengan buffer atau tetangga terdekat.
Batas BIG yang dipakai edisi 2022, bukan klaim batas terbaru. Jangan gunakan
geometri tampilan ini untuk penetapan batas hukum.

## Area minim akses

`GET /api/v1/analisis/blank-spots?scope=bogor` menghitung selisih 46 poligon
terhadap gabungan buffer geodesik seluruh sekolah aktif. Radius default mengikuti
`COVERAGE_RADIUS_KM` (saat ini 3 km); parameter `radius_km` harus > 0 dan ≤ 20.
Sekolah di seberang batas tetap dapat menjangkau wilayah di dalam Bogor.

Ini **jarak lurus**, bukan rute/jarak jalan. Area bergaris biru putus-putus tidak membuktikan
ketiadaan sekolah; hasil bergantung kelengkapan titik. Dataset sekolah saat ini
demo sehingga UI wajib menyebut simulasi. Tidak ada cache permanen hasil buffer:
perubahan sekolah aktif berlaku pada permintaan berikutnya. Endpoint lama tanpa
`scope=bogor` tetap menggunakan dataset wilayah analisis aktif untuk dashboard.

## Kebutuhan layanan dengan mesin demo sebelumnya

`GET /api/v1/analisis/kebutuhan-bogor` adalah simulasi read-only, dihitung ulang
melalui `analysisService.collectMetrics` dan `scoring.computeScores` yang sama
dengan backend lama. Tambahan parameter geometri opsional pada `collectMetrics`
tidak mengubah jalur dashboard tanpa parameter itu.

Batas geografis dari snapshot menggantikan poligon demo untuk spatial join
sekolah, luas kecamatan, buffer, dan jarak. Nama kecamatan kabupaten dinormalisasi
(huruf kecil, tanpa spasi) untuk menghubungkan data usia SMP aktif melalui ID
wilayah `DEMO-*`. Bentuk wilayah demo tidak digunakan dan datasetnya tetap nonaktif.
Ini sengaja mode simulasi; jangan memperlakukannya sebagai mekanisme impor data resmi.

Bobot diambil dari tabel `indikator`, bukan di-hardcode ulang di frontend:
gap kapasitas 20%, siswa/kelas 15%, siswa/sekolah 10%, siswa/guru 10%, kepadatan
usia SMP 15%, area minim akses 20%, jarak ke sekolah 10% pada konfigurasi saat ini.
Nilai mentah dinormalisasi min–max antarwilayah yang memenuhi syarat, kemudian
dijumlahkan berbobot. Skor relatif 0–100; kategori mengikuti konfigurasi backend.

Data usia SMP hanya tersedia pada 40 kecamatan kabupaten. Enam kecamatan kota
tetap memiliki geometri tetapi skor `null`/abu-abu. Mereka tidak diikutkan dalam
normalisasi; jangan menganggap data hilang sebagai kebutuhan rendah atau
menggunakan jumlah penduduk total BPS sebagai penggantinya. Tahun simulasi
mengikuti statistik pendidikan terbaru, saat ini 2026; bukan tahun BPS 2024.

Endpoint ini tidak menulis `priority_score`, `nilai_indikator` atau dataset.
Setelah input usia SMP resmi tersedia, gantikan pencocokan DEMO dengan relasi
kode wilayah resmi dan perbarui label sumber sebelum menyajikan analisis nyata.
