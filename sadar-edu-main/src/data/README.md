# Batas Bogor (Kabupaten dan Kota)

Kedua outline diturunkan dari 46 poligon kecamatan pada satu coverage BIG:

- `bogor.geojson.json`: union Kabupaten Bogor (32.01) dan Kota Bogor (32.71),
  dipakai untuk batas kamera, outline luar dan penyaringan sekolah.
- `kabupaten-bogor.geojson.json`: union 40 kecamatan kabupaten. Lubang kota
  memberikan garis pemisah kota/kabupaten tanpa menutupi Kota Bogor.

Sumber: [BIG, Peta Wilayah Administrasi Kecamatan, edisi 2022 (revisi 27 Desember 2022)](https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3).
Diambil 4 November 2026. Ini menggantikan outline BIG 2023 agar outline dan
poligon kecamatan tidak memakai versi batas berbeda.

Jangan menyederhanakan tiap poligon sendiri-sendiri. Jalankan dari folder backend:

```powershell
python src/scripts/prepareBogorDistricts.py C:/path/to/source-folder
python test/bogorGeometry.test.py
```

Lihat `../../../SadarEdu-be-main/src/data/README.md` untuk query pengunduhan.
Pipeline mempertahankan sisi bersama, memeriksa overlap/celah, lalu membangun
outline dari coverage yang sama. Sumber GeoJSON Mapbox memakai `tolerance=0`
agar geometri tidak disederhanakan ulang secara terpisah pada tiap tile.

Area luar tetap terlihat tanpa mask; Kota Bogor tetap termasuk cakupan.
Dashboard tidak memakai pembatasan kamera ini. Data dibundel lokal dan tidak
bergantung pada ketersediaan layanan BIG saat halaman dibuka.
