import { KATEGORI_STYLE } from "../../lib/analysis";

export const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/40 focus:border-[#1F6F5F]";
export const btnPrimary =
  "px-3.5 py-2 bg-[#1F6F5F] hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors";
export const btnGhost =
  "px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors";

export function KategoriBadge({ kategori }) {
  const st = KATEGORI_STYLE[kategori] || KATEGORI_STYLE["Belum dihitung"];
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.badge}`}>
      {kategori || "Belum dihitung"}
    </span>
  );
}

export function ErrorBox({ message, onClose }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-red-400 hover:text-red-700 font-bold" aria-label="Tutup pesan">✕</button>
      )}
    </div>
  );
}

export function InfoBox({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 border-slate-200 text-slate-600",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  return <div className={`text-xs border rounded-lg px-3 py-2 leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function Spinner({ label = "Memuat..." }) {
  return <p className="text-xs text-slate-400 py-6 text-center" role="status">{label}</p>;
}

export function Bar({ value, max = 100, color = "#1F6F5F" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
