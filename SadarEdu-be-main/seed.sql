-- ==========================================
-- SEED DATA MASTER ROLE SADAREDU
-- ==========================================

INSERT INTO role (id_role, nama_role, deskripsi) VALUES
(1, 'Umum', 'Pengguna publik/masyarakat yang memiliki hak akses untuk melihat (read-only) peta spasial SIG, sebaran sekolah, dan informasi umum pendidikan.'),
(2, 'Stakeholder', 'Pengambil kebijakan atau instansi pemerintah yang memiliki hak akses ke dashboard analisis eksekutif, skor prioritas wilayah, serta fitur simulasi skenario intervensi.'),
(3, 'Operator', 'Pengelola sistem/administrator data yang memiliki hak akses penuh untuk mengunggah, menginput, mengedit, dan mengelola data master spasial, demografi, serta statistik sekolah.')
ON CONFLICT (id_role) DO UPDATE 
SET nama_role = EXCLUDED.nama_role, deskripsi = EXCLUDED.deskripsi;

-- Set sequence id_role agar berlanjut dari 4
SELECT setval(pg_get_serial_sequence('role', 'id_role'), COALESCE(MAX(id_role), 1)) FROM role;
