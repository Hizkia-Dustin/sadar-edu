import { useEffect, useId, useRef } from 'react';
import IsoScene from './IsoScene';

// Penanda nilai kosong pada kartu dan tabel (bukan tanda baca di kalimat).
export const EMPTY = '\u2014';

export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6f5f]';

export const BTN_PRIMARY = `op-btn op-btn--primary inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-full bg-[#132a25] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#145646] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

export const BTN_OUTLINE = `op-btn inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-full border border-[#dde6e0] bg-white px-5 py-2 text-sm font-semibold text-[#132a25] transition-colors hover:border-[#c9e4d5] hover:bg-[#e7f4ed] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

export const CARD = 'op-card rounded-[22px] border border-[#e3ebe5] bg-white';

export const TH = 'bg-[#f2f7f3] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#52605a] first:rounded-l-xl last:rounded-r-xl';
export const TD = 'border-b border-[#edf2ee] px-3 py-4 text-[13px] leading-5 text-[#132a25]';

export function formatTimestamp(iso) {
  const date = new Date(iso);
  const time = date
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace('.', ':');
  if (date.toDateString() === new Date().toDateString()) return `Hari ini, ${time}`;
  const day = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day}, ${time}`;
}

export function PageHeader({ eyebrow, title, description, action, art }) {
  return (
    <div className={`op-page-header ${art ? 'op-page-header--art' : ''}`}>
      <div className="op-page-header__text">
        {eyebrow && <p className="op-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="op-page-header__desc">{description}</p>}
        {action && <div className="op-page-header__action">{action}</div>}
      </div>
      {art && (
        <div className="op-page-header__art" aria-hidden="true">
          <IsoScene variant={art} />
        </div>
      )}
    </div>
  );
}

// Keadaan kosong dengan ilustrasi isometrik kecil; `children` untuk tombol aksi.
export function EmptyState({ art = 'dataset', title, text, children, className = '' }) {
  return (
    <div className={`op-empty ${className}`}>
      <IsoScene variant={art} className="op-empty__art" />
      <div className="op-empty__body">
        {title && <p className="op-empty__title">{title}</p>}
        {text && <p className="op-empty__text">{text}</p>}
        {children && <div className="op-empty__actions">{children}</div>}
      </div>
    </div>
  );
}

const PILL_TONE = {
  neutral: 'bg-[#eef4f0] text-[#3d4d46]',
  error: 'bg-[#fff0f0] text-[#a12b31]',
  success: 'bg-[#e7f4ed] text-[#126552]',
  warning: 'bg-[#fff5e3] text-[#85520c]',
};

export function StatusPill({ tone = 'neutral', children }) {
  const style = PILL_TONE[tone] ?? PILL_TONE.neutral;
  return (
    <span
      className={`op-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-4 ${style}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#132a25]/45 p-4 backdrop-blur-[2px]"
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
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white p-6 text-[#132a25] shadow-[0_24px_60px_rgba(19,42,37,0.22)] outline-none ${
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
    <div className={`${CARD} op-metric relative min-h-[112px] overflow-hidden px-5 py-[18px]`}>
      <p className="flex items-center gap-2 text-xs font-medium leading-[18px] text-[#52605a]">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accent}`} />
        {label}
      </p>
      <p className="mt-2 text-[34px] font-semibold leading-10 tracking-[-0.03em] text-[#132a25] [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-[11px] font-medium leading-4 text-[#52605a]">{note}</p>
    </div>
  );
}
