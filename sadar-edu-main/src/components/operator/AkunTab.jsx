import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ErrorBox, Spinner, inputCls, btnPrimary } from "../ui/kit";

export default function AkunTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({ nama: "", email: "", password: "", role: "Stakeholder" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers((await api.get("/auth/users")).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      await api.post("/auth/users", form);
      setOk(`Akun ${form.email} dibuat.`);
      setForm({ nama: "", email: "", password: "", role: "Stakeholder" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Buat akun staf</h2>
        <p className="text-[11px] text-slate-400">Pendaftaran mandiri hanya menghasilkan akun “Umum”. Akun Stakeholder dan Operator dibuat di sini.</p>
        <div><label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="an">Nama</label><input id="an" required className={inputCls} value={form.nama} onChange={set("nama")} /></div>
        <div><label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="ae">Email</label><input id="ae" type="email" required className={inputCls} value={form.email} onChange={set("email")} /></div>
        <div><label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="ap">Kata sandi (min. 8 karakter)</label><input id="ap" type="password" minLength={8} required autoComplete="new-password" className={inputCls} value={form.password} onChange={set("password")} /></div>
        <div><label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="ar">Peran</label>
          <select id="ar" className={inputCls} value={form.role} onChange={set("role")}><option>Stakeholder</option><option>Operator</option></select></div>
        <ErrorBox message={error} onClose={() => setError("")} />
        {ok && <p className="text-xs text-emerald-700" role="status">{ok}</p>}
        <button className={btnPrimary + " w-full"} disabled={saving}>{saving ? "Membuat..." : "Buat akun"}</button>
      </form>
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-semibold">Nama</th><th className="px-2 font-semibold">Email</th><th className="px-2 font-semibold">Peran</th><th className="px-2 font-semibold">Aktif</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id_user}><td className="px-4 py-2 font-semibold text-slate-800">{u.nama}</td><td className="px-2">{u.email}</td><td className="px-2">{u.role}</td><td className="px-2">{u.status_aktif ? "Ya" : "Tidak"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
