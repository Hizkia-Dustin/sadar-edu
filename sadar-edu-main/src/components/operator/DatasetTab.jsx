import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { fmt } from "../../lib/analysis";
import { ErrorBox, InfoBox, Spinner, inputCls, btnPrimary, btnGhost } from "../ui/kit";

// Petunjuk format per kategori (nama kolom/properti yang dikenali server)
const PETUNJUK = {
  wilayah: "GeoJSON poligon batas wilayah. Properti: kode_bps (atau KDCPUM/KDKEC), nama_wilayah (atau WADMKC/NAMOBJ), level_wilayah (default Kecamatan). Wajib dimuat sebelum data sekolah agar kecamatan sekolah terisi.",
  sekolah: "GeoJSON titik atau CSV. Dikenali: npsn, nama (nama_sekolah), status, kecamatan, kabupaten, desaKelurahan, akreditasi, jumlahSiswa, jumlahGuru, ruangKelas, ruangKelasBaik/RusakRingan/RusakSedang/RusakBerat (penamaan snake_case juga bisa). Nilai kosong/0 pada siswa, guru, ruang kelas dibaca sebagai 'belum diisi'.",
  statistik: "CSV/JSON per sekolah. Kolom: npsn, tahun, jumlah_siswa, jumlah_guru, jumlah_rombel, jumlah_ruang_kelas.",
  kependudukan: "CSV/JSON per kecamatan. Kolom: kode_bps (sama dengan batas wilayah), tahun, jumlah_penduduk, penduduk_usia_smp (13–15 tahun).",
  jalan: "GeoJSON garis (LineString/MultiLineString). Properti opsional: nama, kelas_jalan.",
  risiko_bencana: "GeoJSON poligon. Properti level (1–5) atau teks Rendah/Sedang/Tinggi/Sangat Tinggi. Level di atas 3 dikecualikan dari area kandidat.",
  lereng: "GeoJSON poligon. Properti nilai = kemiringan dalam persen (%). Di atas batas lereng dikecualikan dari area kandidat.",
  kawasan_lindung: "GeoJSON poligon kawasan terlarang (lindung/konservasi). Area kandidat tidak akan ditempatkan di dalamnya.",
};

const MAX_MB = 45;

export default function DatasetTab({ onChanged }) {
  const [list, setList] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ kategori: "wilayah", nama_dataset: "", sumber: "", tahun: new Date().getFullYear(), crs: 4326, nolKosong: true });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hasil, setHasil] = useState(null);
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const [d, k] = await Promise.all([api.get("/dataset"), api.get("/dataset/kategori")]);
      setList(d.data);
      setKategori(k.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const def = kategori.find((k) => k.kode === form.kategori);

  const onFile = (e) => {
    const f = e.target.files[0];
    setError("");
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setError(`Berkas terlalu besar (maks. ${MAX_MB} MB). Sederhanakan geometri atau potong ke area studi di QGIS.`);
      e.target.value = "";
      return setFile(null);
    }
    setFile(f || null);
    if (f && !form.nama_dataset) setForm((x) => ({ ...x, nama_dataset: f.name.replace(/\.[^.]+$/, "") }));
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return setError("Pilih berkas terlebih dahulu.");
    setUploading(true);
    setError("");
    setHasil(null);
    try {
      const text = await file.text();
      const isCsv = /\.(csv|txt)$/i.test(file.name);
      const res = await api.post("/dataset/import", {
        kategori: form.kategori,
        nama_dataset: form.nama_dataset,
        sumber: form.sumber || "Unggahan Operator",
        tahun: Number(form.tahun) || undefined,
        crs: Number(form.crs) || 4326,
        format: isCsv ? "CSV" : "GeoJSON",
        nol_dianggap_kosong: form.nolKosong,
        data: text,
      });
      setHasil(res);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setForm((x) => ({ ...x, nama_dataset: "" }));
      await load();
      onChanged && onChanged(res);
    } catch (err) {
      setError(err.message + (err.detail ? ` — ${[].concat(err.detail).slice(0, 3).join(" | ")}` : ""));
    } finally {
      setUploading(false);
    }
  };

  const toggle = async (d) => {
    setBusyId(d.id_dataset);
    setError("");
    try {
      await api.patch(`/dataset/${d.id_dataset}`, { aktif: !d.aktif });
      await load();
      onChanged && onChanged({ perlu_hitung_ulang: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Hapus dataset “${d.nama_dataset}” beserta ${fmt(d.jumlah_fitur)} data yang berasal darinya? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusyId(d.id_dataset);
    setError("");
    try {
      await api.del(`/dataset/${d.id_dataset}`);
      await load();
      onChanged && onChanged({ perlu_hitung_ulang: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <form onSubmit={upload} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Unggah dataset</h2>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="kat">Kategori</label>
          <select id="kat" className={inputCls} value={form.kategori} onChange={set("kategori")}>
            {kategori.map((k) => <option key={k.kode} value={k.kode}>{k.label}</option>)}
          </select>
        </div>
        <InfoBox>{PETUNJUK[form.kategori]}</InfoBox>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="nd">Nama dataset</label>
          <input id="nd" required className={inputCls} value={form.nama_dataset} onChange={set("nama_dataset")} placeholder="mis. Batas Kecamatan BIG 2024" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="sm">Sumber</label>
            <input id="sm" className={inputCls} value={form.sumber} onChange={set("sumber")} placeholder="BPS / BIG / Disdik" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="th">Tahun data (tahun statistik)</label>
            <input id="th" type="number" className={inputCls} value={form.tahun} onChange={set("tahun")} />
          </div>
        </div>
        {(form.kategori === "sekolah" || form.kategori === "statistik") && (
          <label className="flex items-start gap-2 text-[11px] text-slate-600">
            <input type="checkbox" className="mt-0.5 accent-[#1F6F5F]" checked={form.nolKosong} onChange={(e) => setForm({ ...form, nolKosong: e.target.checked })} />
            <span>Anggap nilai 0 pada siswa/guru/ruang kelas sebagai “belum diisi” (disarankan untuk data Dapodik).</span>
          </label>
        )}
        {def && def.format !== "tabel" && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="crs">Kode EPSG koordinat berkas</label>
            <input id="crs" type="number" className={inputCls} value={form.crs} onChange={set("crs")} />
            <p className="text-[10px] text-slate-400 mt-1">4326 = WGS 84 (lon/lat). Isi kode lain (mis. 32748) bila berkas berada di CRS berbeda; server mengonversinya.</p>
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="fl">Berkas ({def && def.format === "tabel" ? ".csv" : ".geojson / .json / .csv"})</label>
          <input id="fl" ref={fileRef} type="file" accept=".geojson,.json,.csv,.txt" onChange={onFile} className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-[#1F6F5F] file:font-semibold" />
        </div>
        <ErrorBox message={error} onClose={() => setError("")} />
        <button className={btnPrimary + " w-full"} disabled={uploading || !file}>{uploading ? "Mengunggah & memproses..." : "Unggah & impor"}</button>

        {hasil && (
          <div className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1" role="status">
            <p className="font-semibold text-emerald-800">Impor berhasil: {fmt(hasil.data.hasil.diproses)} data diproses</p>
            <p className="text-emerald-700">Ditambah {fmt(hasil.data.hasil.ditambah)} · diperbarui {fmt(hasil.data.hasil.diperbarui)} · dilewati {fmt(hasil.data.hasil.dilewati)}</p>
            {hasil.analisis && <p className="text-emerald-700">Analisis dihitung ulang otomatis ({hasil.analisis.jumlah_wilayah} kecamatan).</p>}
            {hasil.analisis_catatan && <p className="text-amber-700">Analisis belum dihitung: {hasil.analisis_catatan}</p>}
            {hasil.data.hasil.galat.length > 0 && (
              <details className="text-amber-800">
                <summary className="cursor-pointer">{hasil.data.hasil.galat.length} catatan/peringatan</summary>
                <ul className="list-disc ml-4 mt-1 max-h-32 overflow-auto">{hasil.data.hasil.galat.map((g, i) => <li key={i}>{g}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </form>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Dataset terunggah ({list.length})</h2>
          <button className={btnGhost} onClick={load}>Muat ulang</button>
        </div>
        {loading ? <Spinner /> : list.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">Belum ada dataset. Mulai dengan batas wilayah (kecamatan), lalu sekolah, statistik, dan kependudukan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="px-4 py-2 font-semibold">Dataset</th><th className="px-2 font-semibold">Kategori</th><th className="px-2 font-semibold text-right">Data</th><th className="px-2 font-semibold">Sumber</th><th className="px-2 font-semibold">Aktif</th><th className="px-4" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((d) => (
                  <tr key={d.id_dataset} className={d.aktif ? "" : "opacity-50"}>
                    <td className="px-4 py-2.5"><p className="font-semibold text-slate-800">{d.nama_dataset}</p><p className="text-[10px] text-slate-400">{d.tahun || "-"} · {d.format} · {d.crs}</p></td>
                    <td className="px-2">{d.label_kategori}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(d.jumlah_fitur)}</td>
                    <td className="px-2 max-w-[160px] truncate" title={d.sumber}>{String(d.sumber || "").toUpperCase().startsWith("DEMO") ? <span className="text-amber-700 font-semibold">{d.sumber}</span> : d.sumber}</td>
                    <td className="px-2">
                      <button role="switch" aria-checked={d.aktif} aria-label={`Aktifkan ${d.nama_dataset}`} disabled={busyId === d.id_dataset} onClick={() => toggle(d)}
                        className={`w-9 h-5 rounded-full relative transition-colors ${d.aktif ? "bg-[#1F6F5F]" : "bg-slate-300"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${d.aktif ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 text-right"><button disabled={busyId === d.id_dataset} onClick={() => remove(d)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
