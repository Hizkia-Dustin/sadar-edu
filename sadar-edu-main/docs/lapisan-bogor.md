# Panduan pengembang: lapisan Bogor

Perubahan dibatasi pada eksplorasi publik `/peta`. Lihat sumber dan prosedur
pembaruan pada `../../SadarEdu-be-main/src/data/README.md`.

## Alur kode

- `src/hooks/useBogorLayers.js` memuat penduduk, kebutuhan, dan area akses secara independen.
  Peta penduduk tidak menunggu query buffer; request dibatalkan saat unmount.
  Kegagalan ditampilkan di tab Lapisan, dengan tombol mencoba ulang.
- `src/lib/population.js` adalah satu sumber ambang warna dan label legenda.
  Ambang tetap 75.000, 125.000, 200.000, 300.000 jiwa; warna hijau, hijau muda,
  kuning, oranye, merah. Data kosong berwarna abu-abu;
  jangan mengubahnya menjadi nol. Filter sekolah tidak boleh mengubah ambang.
- `src/lib/bogorBoundary.js` memeriksa Polygon/MultiPolygon, termasuk lubang.
  Filter kecamatan memakai koordinat sekolah terhadap batas asli, bukan ID
  wilayah demo. Bounding box hanya untuk penolakan cepat dan pergerakan kamera.
- `EksplorasiPeta.jsx` menyimpan pilihan lapisan publik dan kecamatan geografis.
  Penduduk dan MCDA saling menggantikan agar dua arti warna tidak ditumpuk.
  Kebutuhan adalah tampilan default. Area minim akses memakai garis biru putus-putus
  agar tidak bercampur dengan merah pada kategori kebutuhan. Dataset MCDA kosong
  tidak dianggap nol kebutuhan; pilihannya nonaktif sampai pratinjau tersedia.
- `MapCanvas.jsx` menggambar poligon, garis administratif, dan popup. Klik titik
  sekolah/cluster didahulukan dari klik poligon. Popup penduduk memuat tahun,
  sumber, dan aksi filter sekolah. Gunakan `publicExplorer` untuk menjaga
  perilaku dashboard. `publicBlankSpots` dan `publicNeeds` mengganti data hanya
  pada peta publik. `publicNeeds` menampilkan hasil backend secara langsung,
  tidak dihitung ulang menggunakan bobot store dashboard. Klik poligon kebutuhan
  memilih kecamatan dan menampilkan skor serta diagnosis pada panel.

Kabupaten **dan Kota Bogor** tetap masuk cakupan. Daerah sekitar tetap terlihat;
tidak ada mask penutup. Garis kabupaten BIG mencakup perimeter kota sebagai
lubang geometri, sementara batas gabungan mengatur cakupan kamera.

## Perintah pemeriksaan

Hover pada poligon kebutuhan atau penduduk menampilkan nama kecamatan, jumlah jiwa,
dan tahun BPS melalui `src/components/map/useDistrictHover.js`. Hook memakai
`Popup.trackPointer()` Mapbox agar gerakan mouse tidak memicu render React.
Tooltip memakai `textContent`, tidak menangkap pointer, dan dibersihkan saat
keluar wilayah, menggeser peta, membuka popup klik, mengganti layer, atau unmount.
Jumlah jiwa selalu berasal dari snapshot penduduk, bukan input usia SMP demo.
Pada layar sentuh informasi tetap tersedia melalui klik/panel.

Referensi API: [Popup saat hover](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/).

Dari folder frontend:

```powershell
node --test src/lib/bogorBoundary.test.js src/lib/population.test.js
npx eslint src/components/map/MapCanvas.jsx src/pages/public/EksplorasiPeta.jsx src/hooks/useBogorLayers.js src/lib/bogorBoundary.js src/lib/population.js
npm run build
```

Dari folder backend:

```powershell
npm test
npm start
```

API smoke test setelah backend berjalan:

```powershell
(Invoke-RestMethod 'http://localhost:5000/api/v1/analisis/penduduk').count
(Invoke-RestMethod 'http://localhost:5000/api/v1/analisis/blank-spots?scope=bogor').count
(Invoke-RestMethod 'http://localhost:5000/api/v1/analisis/kebutuhan-bogor').count
```

Penduduk dan kebutuhan harus memuat 46 geometri. Pada dataset demo sekarang,
40 kecamatan kabupaten memiliki skor kebutuhan dan 6 kecamatan kota memiliki skor
null (abu-abu, belum cukup data). Jumlah poligon area akses dapat berubah ketika sekolah atau
radius berubah; jangan hardcode angka hasil saat ini sebagai kontrak aplikasi.

Pemeriksaan UI manual: klik titik → popup sekolah; klik poligon → jumlah jiwa;
pilih **Lihat sekolah** → daftar mengikuti geometri; ganti status/cari nama;
matikan/aktifkan lapisan; cek Kota Bogor, kecamatan tepi, dan layar ponsel.
Pemeriksaan browser pada sesi ini belum dilakukan karena akses browser lokal
dinonaktifkan. Build/API/test bukan pengganti pemeriksaan visual.
