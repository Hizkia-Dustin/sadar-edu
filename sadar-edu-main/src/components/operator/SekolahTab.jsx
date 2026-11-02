import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmt, mapSchoolFeature } from "../../lib/analysis";
import { ErrorBox, Spinner, inputCls, btnPrimary, btnGhost } from "../ui/kit";

const kosongNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const EMPTY = { npsn: "", nama_sekolah: "", status_sekolah: "Negeri", alamat: "", jenjang: "SMP", akreditasi: "", latitude: "", longitude: "", tahun: new Date().getFullYear(), jumlah_siswa: "", jumlah_guru: "", jumlah_rombel: "", jumlah_ruang_kelas: "" };

export default function SekolahTab({ onChanged }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null); // null | { id?, ...form }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query) => {
    setLoading(true);
    try {
      const res = await api.get("/sekolah/geojson", { q: query });
      setRows(res.data.features.map(mapSchoolFeature).map((f) => f.properties));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  const bukaEdit = async (r) => {
    try {
      const d = (await api.get(`/sekolah/${r.id}`)).data;
      setEdit({
        id: d.id_sekolah, npsn: d.npsn, nama_sekolah: d.nama_sekolah, status_sekolah: d.status_sekolah, alamat: d.alamat || "", jenjang: d.jenjang || "SMP",
        akreditasi: d.akreditasi || "", latitude: d.latitude, longitude: d.longitude, tahun: d.tahun_statistik || new Date().getFullYear(),
        jumlah_siswa: d.jumlah_siswa ?? "", jumlah_guru: d.jumlah_guru ?? "", jumlah_rombel: d.jumlah_rombel ?? "", jumlah_ruang_kelas: d.jumlah_ruang_kelas ?? "",
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const simpan = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = { ...edit, latitude: Number(edit.latitude), longitude: Number(edit.longitude), tahun: Number(edit.tahun) || undefined,
      // kosong tetap kosong (null), bukan 0: data yang belum diisi tidak boleh dihitung sebagai nol
      jumlah_siswa: kosongNull(edit.jumlah_siswa), jumlah_guru: kosongNull(edit.jumlah_guru), jumlah_rombel: kosongNull(edit.jumlah_rombel), jumlah_ruang_kelas: kosongNull(edit.jumlah_ruang_kelas) };
    try {
      const res = edit.id ? await api.put(`/sekolah/${edit.id}`, body) : await api.post("/sekolah", body);
      setEdit(null);
      await load(q);
      onChanged && onChanged(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (r) => {
    if (!window.confirm(`Hapus sekolah “${r.nama}” beserta statistiknya?`)) return;
    try {
      const res = await api.del(`/sekolah/${r.id}`);
      await load(q);
      onChanged && onChanged(res);
    } catch (e) {
      setError(e.message);
    }
  };

  const num = (k, label, props = {}) => (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1" htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} type="number" className={inputCls} value={edit[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input aria-label="Cari sekolah" className={inputCls + " max-w-sm"} placeholder="Cari nama atau NPSN..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btnPrimary} onClick={() => setEdit({ ...EMPTY })}>+ Tambah sekolah</button>
        <span className="text-xs text-slate-400 ml-auto">{fmt(rows.length)} sekolah</span>
      </div>
      <ErrorBox message={error} onClose={() => setError("")} />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-left sticky top-0">
                <tr><th className="px-4 py-2 font-semibold">Sekolah</th><th className="px-2 font-semibold">Kecamatan</th><th className="px-2 font-semibold">Status</th><th className="px-2 font-semibold text-right">Siswa</th><th className="px-2 font-semibold text-right">Guru</th><th className="px-2 font-semibold text-right">Kelas</th><th className="px-4" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2"><p className="font-semibold text-slate-800">{r.nama}</p><p className="text-[10px] text-slate-400">NPSN {r.npsn}</p></td>
                    <td className="px-2">{r.kecamatan || <span className="text-amber-600">di luar kecamatan</span>}</td>
                    <td className="px-2">{r.status}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.jumlahSiswa)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.jumlahGuru)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.ruangKelas)}</td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <button className="text-[#1F6F5F] font-semibold mr-3 hover:underline" onClick={() => bukaEdit(r)}>Ubah</button>
                      <button className="text-red-500 font-semibold hover:text-red-700" onClick={() => hapus(r)}>Hapus</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-slate-400">Tidak ada sekolah.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Form sekolah">
          <form onSubmit={simpan} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-3">
            <h2 className="font-bold text-slate-800">{edit.id ? "Ubah sekolah" : "Tambah sekolah"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] text-slate-500 mb-1" htmlFor="f-npsn">NPSN</label><input id="f-npsn" required disabled={!!edit.id} className={inputCls} value={edit.npsn} onChange={set("npsn")} /></div>
              <div><label className="block text-[11px] text-slate-500 mb-1" htmlFor="f-status">Status</label>
                <select id="f-status" className={inputCls} value={edit.status_sekolah} onChange={set("status_sekolah")}><option>Negeri</option><option>Swasta</option></select></div>
              <div className="col-span-2"><label className="block text-[11px] text-slate-500 mb-1" htmlFor="f-nama">Nama sekolah</label><input id="f-nama" required className={inputCls} value={edit.nama_sekolah} onChange={set("nama_sekolah")} /></div>
              <div className="col-span-2"><label className="block text-[11px] text-slate-500 mb-1" htmlFor="f-alamat">Alamat</label><input id="f-alamat" className={inputCls} value={edit.alamat} onChange={set("alamat")} /></div>
              {num("latitude", "Latitude", { step: "any", required: true, placeholder: "-6.59" })}
              {num("longitude", "Longitude", { step: "any", required: true, placeholder: "106.80" })}
              <div><label className="block text-[11px] text-slate-500 mb-1" htmlFor="f-akr">Akreditasi</label><input id="f-akr" maxLength={5} className={inputCls} value={edit.akreditasi} onChange={set("akreditasi")} /></div>
              {num("tahun", "Tahun statistik")}
              {num("jumlah_siswa", "Jumlah siswa", { min: 0 })}
              {num("jumlah_guru", "Jumlah guru", { min: 0 })}
              {num("jumlah_rombel", "Jumlah rombel", { min: 0 })}
              {num("jumlah_ruang_kelas", "Jumlah ruang kelas", { min: 0 })}
            </div>
            <p className="text-[10px] text-slate-400">Kosongkan kolom statistik yang datanya belum ada (jangan isi 0). Kecamatan ditentukan otomatis dari koordinat. Setelah menyimpan, hitung ulang analisis agar skor diperbarui.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setEdit(null)}>Batal</button>
              <button className={btnPrimary} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
