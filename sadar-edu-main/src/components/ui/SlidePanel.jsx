import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function SlidePanel({ side = 'left', open, title, children, onClose, width = 320, id }) {
  const panel = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    panel.current?.querySelector('button')?.focus({ preventScroll: true });
    const handleKey = (event) => { if (event.key === 'Escape') close.current(); };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); trigger?.focus({ preventScroll: true }); };
  }, [open]);
  return (
    <aside ref={panel} id={id} inert={!open} aria-label={title || 'Daftar sekolah'} aria-hidden={!open} className={`slide-panel slide-panel-${side} ${open ? 'slide-panel-open' : ''}`} style={{ '--panel-width': `${width}px` }}>
      {title ? <div className="slide-panel-header"><h2>{title}</h2><button onClick={onClose} aria-label={`Tutup ${title}`}><X size={18}/></button></div> : <button className="slide-panel-close-floating" onClick={onClose} aria-label="Tutup panel"><X size={18}/></button>}
      <div className="slide-panel-content">{children}</div>
    </aside>
  );
}
