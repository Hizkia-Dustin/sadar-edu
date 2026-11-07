# Menjalankan SADAR EDU lokal

Alamat peta: http://localhost:4174/peta

1. Di `SadarEdu-be-main`, jalankan `npm run dev` (API port 5000).
2. Di `sadar-edu-main`, jalankan `npm run dev` (frontend port 4174).

Frontend memakai `VITE_API_URL=/api/v1`; Vite meneruskan `/api` ke backend 5000.
Ini mencegah kegagalan CORS saat port frontend berbeda dari konfigurasi backend.
Jangan mengubah URL API produksi tanpa menyesuaikan konfigurasi deployment.

Port 4174 memakai `strictPort`: jika sibuk, server berhenti dengan pesan error,
bukan berpindah otomatis. Port 5173 di mesin ini dipakai proyek lain sehingga
tidak dapat dipakai untuk memastikan tampilan SADAR EDU.

Untuk memeriksa build produksi, hentikan dev server frontend terlebih dahulu,
lalu jalankan `npm run build` dan `npm run preview`. Preview juga memakai 4174.
Dev server memperbarui perubahan kode otomatis; preview perlu build ulang.
