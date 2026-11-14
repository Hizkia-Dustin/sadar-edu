import { useEffect, useId, useRef } from 'react';

// Penanda nilai kosong pada kartu dan tabel (bukan tanda baca di kalimat).
export const EMPTY = '\u2014';

export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c6e8e]';

export const BTN_PRIMARY = `inline-flex h-[42px] cursor-pointer items-center justify-center rounded-lg bg-[#1b4965] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#153a52] ${FOCUS}`;

export const BTN_OUTLINE = `inline-flex h-[42px] cursor-pointer items-center justify-center rounded-lg border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173042] transition-colors hover:bg-[#edf3f6] ${FOCUS}`;

export const CARD =
  'rounded-[10px] border border-[#d7e1e8] bg-white shadow-[0_12px_30px_rgba(10,36,51,0.1)]';

export const TH = 'bg-[#edf3f6] px-3 py-3 text-[11px] font-medium text-[#445665]';
export const TD = 'border-b border-[#d7e1e8] px-3 py-[17px] text-xs text-[#173042]';

export function formatTimestamp(iso) {
  const date = new Date(iso);
  const time = date
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace('.', ':');
  if (date.toDateString() === new Date().toDateString()) return `Hari ini, ${time}`;
  const day = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day}, ${time}`;
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-medium uppercase leading-4 text-[#2c6e8e]">{eyebrow}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-9 text-[#173042]">{title}</h1>
        <p className="mt-0.5 max-w-[760px] text-xs leading-[18px] text-[#445665]">{description}</p>
      </div>
      {action}
    </div>
  );
}

const PILL_TONE = {
  neutral: { box: 'bg-[#edf3f6] text-[#445665]', dot: 'bg-[#445665]' },
  error: { box: 'bg-[#fff0f0] text-[#a12b31]', dot: 'bg-[#a12b31]' },
  success: { box: 'bg-[#e8f3f0] text-[#126552]', dot: 'bg-[#126552]' },
};

export function StatusPill({ tone = 'neutral', children }) {
  const style = PILL_TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase leading-4 ${style.box}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}

export function Dialog({ title, onClose, focusRef, wide = false, children }) {
  const boxRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    (focusRef?.current ?? boxRef.current)?.focus();
  }, [focusRef]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 text-[#173042] shadow-xl outline-none ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function MetricCard({ label, value, note, accent }) {
  return (
    <div className={`${CARD} relative min-h-[112px] overflow-hidden px-[17px] py-[17px]`}>
      <span aria-hidden="true" className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <p className="text-xs leading-[18px] text-[#445665]">{label}</p>
      <p className="mt-1.5 text-[28px] font-bold leading-9 text-[#173042]">{value}</p>
      <p className="mt-1 text-[11px] font-medium leading-4 text-[#445665]">{note}</p>
    </div>
  );
}