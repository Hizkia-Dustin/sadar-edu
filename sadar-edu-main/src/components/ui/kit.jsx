import GeoLoader from './GeoLoader';
import { KATEGORI_STYLE } from "../../lib/analysis";

export const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/35 focus:border-[#1F6F5F] transition-colors";
export const btnPrimary =
  "px-3.5 py-2 bg-[#1F6F5F] hover:bg-[#175649] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors";
export const btnGhost =
  "px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors";

export function KategoriBadge({ kategori }) {
  const st = KATEGORI_STYLE[kategori] || KATEGORI_STYLE["Belum dihitung"];
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border leading-tight ${st.badge}`}>
      {kategori || "Belum dihitung"}
    </span>
  );
}

export function ErrorBox({ message, onClose }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-red-600 hover:text-red-900 font-bold" aria-label="Tutup pesan">✕</button>
      )}
    </div>
  );
}

export function InfoBox({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50/70 border-emerald-200 text-emerald-950",
  };
  return <div className={`text-xs border rounded-lg px-3.5 py-2.5 leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function Spinner({ label = "Memuat…" }) {
  return <div className="py-6 text-center text-xs text-slate-600"><GeoLoader label={label} /></div>;
}

export function Bar({ value, max = 100, color = "#1F6F5F" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
