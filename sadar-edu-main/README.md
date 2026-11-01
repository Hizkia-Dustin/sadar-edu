# SADAR Edu — Frontend (React + Vite + Mapbox)

Web GIS untuk analisis kebutuhan dan prioritas pembangunan SMP di Kabupaten Bogor. Terhubung ke backend `SadarEdu-be`.

## Menjalankan

```bash
cp .env.example .env     # isi VITE_API_URL dan VITE_MAPBOX_ACCESS_TOKEN
npm install
npm run dev              # http://localhost:5173
```

Pastikan backend berjalan dan `CORS_ORIGIN` di `.env` backend memuat `http://localhost:5173`.

## Halaman

| Rute | Pengguna | Isi |
|---|---|---|
| `/peta` | Masyarakat (tanpa login) | Peta sekolah, filter kecamatan/status/kata kunci, kategori kebutuhan layanan per kecamatan, area minim akses, profil sekolah, alternatif sekolah terdekat, perbandingan sekolah |
| `/login` | Staf | Login sungguhan (JWT); diarahkan sesuai peran |
| `/stakeholder/dashboard` | Stakeholder, Operator | **Prioritas** (slider bobot MCDA langsung mengubah peta & ranking, simpan bobot), **Diagnosis** (faktor, kondisi, pilihan intervensi), **Kandidat** (buat & kelola area kandidat), **Simulasi** (what-if kapasitas) |
| `/operator/dataset` | Operator | **Dataset** (unggah GeoJSON/CSV, aktif/nonaktif, hapus), **Data Sekolah** (CRUD + statistik), **Analisis** (kesiapan data, hitung ulang), **Akun** (buat akun staf) |

Pemeriksaan peran di FE hanya untuk kenyamanan; keamanan sebenarnya ditegakkan backend.

## Catatan teknis

- Skor di peta dihitung ulang di browser dari nilai ternormalisasi server saat slider digeser (`src/lib/analysis.js`); rumusnya identik dengan backend dan sudah diuji paritasnya. Hanya tombol **Simpan bobot** yang mengubah data di server.
- State: `useAuthStore` (sesi, tersimpan di `localStorage`), `useDataStore` (data API + bobot), `useMapStore` (tampilan peta, layer, seleksi).
- File dummy lama (`src/data/*`, `SearchPanel`) dihapus. `FigmaExplorer`, `SchoolList`, `FilterSidebar`, `SlidePanel` tidak dipakai router dan dibiarkan apa adanya.
