# SADAR-EDU V1 — Sistem Informasi Geografis Pendidikan Kabupaten Bogor

Platform Web GIS dan Sistem Pendukung Keputusan (SPK) untuk perencanaan pemerataan dan analisis kebutuhan sekolah menengah pertama (SMP) di Kabupaten Bogor.

---

## 📁 Struktur Repositori

* **`sadar-edu-main/`**: Aplikasi Frontend berbasis **React 19 + Vite + Tailwind CSS + Mapbox GL JS + Zustand**.
* **`SadarEdu-be-main/`**: Server Backend RESTful API berbasis **Node.js (Express) + PostgreSQL 16 + PostGIS**.

---

## ⚡ Cara Menjalankan Aplikasi

### 1. Backend API (Server)
```bash
cd SadarEdu-be-main
npm install
npm run dev              # Berjalan di http://localhost:5000
```

### 2. Frontend WebGIS (Klien)
```bash
cd sadar-edu-main
npm install
npm run dev              # Berjalan di http://localhost:5173
```

---

## 🧭 Panduan Penggunaan Operator

Panduan lengkap mengenai:
- Mengganti nama sekolah satuan (Single School Edit) tanpa upload CSV
- Mengunggah dataset massal baru (Dataset 2028)
- Gonta-ganti versi aktif dataset (Multi-Tahun)
- Ekspor cadangan data (.CSV / .GeoJSON)
- Memahami arti status *"Perlu Perbaikan"* dan filter batas wilayah

Dapat dibaca secara lengkap pada:
👉 [Panduan Lengkap Operator](sadar-edu-main/README.md#panduan-lengkap-operator-cara-mengelola--mengganti-data)

---

## 🔐 Akun Pengujian

| Peran | Email | Password | Hak Akses |
|---|---|---|---|
| **Operator** | `operator@sadaredu.id` | `operator123` | Kelola dataset, CRUD data sekolah, ekspor/impor, validasi data spasial |
| **Stakeholder** | `stakeholder@sadaredu.id` | `stakeholder123` | Dashboard prioritas, penyesuaian bobot MCDA, diagnosis wilayah, simulasi |
| **Publik** | *(Tanpa login)* | — | Akses `/peta` interaktif, pencarian sekolah, dan profil jangkauan |
