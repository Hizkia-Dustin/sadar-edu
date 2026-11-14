# Pengukuran performa peta — 3 November 2026

Target 100 belum tercapai. Pengukuran berikut menggunakan Lighthouse CLI 13.6.0,
Chrome headless dengan profil bersih, build production di localhost:4174/peta,
dan API lokal melalui proxy. Pengaturan throttling mengikuti preset Lighthouse.
Skor 39 dari pengguna berasal dari desktop, tetapi URL dan kondisi pengujian
sebelumnya belum diketahui; angka itu bukan baseline A/B yang setara.

| Pengujian | Performance | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1 | 65 | 0,3 s | 2,0 s | 610 ms | 0,001 |
| Desktop 2 | 60 | 0,3 s | 2,4 s | 700 ms | 0,001 |
| Mobile 1 | 43 | 0,9 s | 10,3 s | 4.130 ms | 0 |
| Desktop setelah perbaikan kamera | 60 | 0,3 s | 1,9 s | 990 ms | 0,001 |

Pada desktop 1, Mapbox menghabiskan sekitar 1.562 ms untuk eksekusi JavaScript.
Ini adalah beban terbesar yang terukur. Bundel Mapbox tetap sekitar 1,84 MB
sebelum kompresi, atau 510 KB gzip. Mengganti basemap atau meminta klik sebelum
memuat peta belum dilakukan karena akan mengubah tampilan atau alur pengguna.

## Perubahan yang sudah diterapkan

- Route dipecah; intro dan transisi halaman tidak dimuat pada `/peta`.
  Bundel utama turun dari sekitar 558 KB menjadi 265 KB sebelum kompresi.
  Ini bukan ukuran total unduhan peta.
- Kamera publik disinkronkan ke state setelah gerakan selesai, bukan setiap frame.
  Kamera yang baru dipublikasikan tidak diterapkan kembali ke Mapbox. Pengujian
  drag menemukan loop pembaruan React sebelum guard ini ditambahkan; sesudah
  perbaikan, drag, zoom, fokus dari daftar, dan klik titik diuji kembali.
- GeoJSON untuk renderer hanya membawa koordinat, ID, dan status. Untuk 617
  sekolah, hasil serialisasi turun dari 337.212 menjadi 81.237 byte. Informasi
  lengkap tetap disimpan untuk popup, detail, dan perbandingan. Ukuran respons
  API tidak berubah.
- Permintaan data publik yang bersamaan dicegah; selector perbandingan tidak
  berlangganan ke seluruh state kamera.

Audit runtime singkat sebelum/sesudah tidak membuktikan kenaikan frame rate
(19 versus 17 fps dalam sampel empat detik). Jangan menyebutnya sebagai bukti
perbaikan kelancaran atau pengganti skor Lighthouse.

## Verifikasi

Build production dan ESLint pada lima file JavaScript yang diubah lulus.
Lint seluruh proyek masih gagal dengan 21 error di bagian lain.
Pemeriksaan browser memverifikasi 617 sekolah, fokus dari daftar, klik titik
membuka popup, profil dengan statistik lengkap, alternatif sekolah, serta
penambahan sekolah dan isi tabel perbandingan. Tidak ada console error baru
setelah perbaikan loop kamera. Tiga pengukuran awal mendahului perbaikan tersebut;
baris terakhir mengukur build dengan perbaikan kamera.

Jalankan ulang pada server production yang sama, satu audit per waktu:

```powershell
npx lighthouse http://localhost:4174/peta --preset=desktop --only-categories=performance --chrome-flags=--headless --output=json --output=html --output-path=./peta-desktop
```

Untuk mobile, hapus `--preset=desktop`. Bandingkan beberapa pengulangan dengan
versi browser, data, jaringan, dan beban komputer yang sama; jangan memilih
hanya hasil tertinggi.
