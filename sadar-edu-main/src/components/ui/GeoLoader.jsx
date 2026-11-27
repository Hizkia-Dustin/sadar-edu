import { useEffect, useState } from 'react';
import logoSadar from '../../assets/figma/logo-sadar.svg';
import './geo-loader.css';

export function GeoMark() {
  return <span className="geo-mark" aria-hidden="true" />;
}

export default function GeoLoader({ label = 'Memuat…', className = '' }) {
  return (
    <span className={`geo-loader ${className}`} role="status">
      <GeoMark />
      <span className="geo-loader-text">{label}</span>
    </span>
  );
}

const INTRO_MS = 1100;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function useLoadCounter(intro) {
  const [value, setValue] = useState(() => (reducedMotion() ? 100 : 0));
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = now - start;
      const next = intro
        ? Math.min(100, Math.round(100 * (1 - (1 - Math.min(1, t / INTRO_MS)) ** 2.6)))
        : Math.min(99, Math.round(99 * (1 - Math.exp(-t / 750))));
      setValue(next);
      if (next < (intro ? 100 : 99)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [intro]);
  return value;
}

export function GeoLoaderScreen({ label = 'Memuat halaman…', onSkip, leaving = false, onRevealed }) {
  const intro = Boolean(onSkip);
  const value = useLoadCounter(intro);

  function finishReveal(event) {
    if (event.target === event.currentTarget && event.animationName === 'sadar-fade-leave') {
      onRevealed?.();
    }
  }

  const statusText = intro
    ? value >= 100
      ? 'Menyiapkan peta…'
      : value >= 60
        ? 'Menyinkronkan data spasial…'
        : 'Memuat data sekolah…'
    : label.replace(/…$/, '');

  return (
    <aside
      className="geo-screen"
      data-intro={intro}
      data-leaving={leaving}
      onAnimationEnd={finishReveal}
      aria-label="Layar Memuat SADAR EDU"
    >
      <span className="sr-only" role="status">
        {intro ? 'Memuat SADAR EDU, WebGIS Analisis Pendidikan Kabupaten Bogor.' : label}
      </span>

      {intro && onSkip && (
        <button
          className="ld-skip-minimal"
          type="button"
          onClick={onSkip}
          aria-label="Lewati intro"
        >
          <span>Lewati</span>
          <span className="ld-skip-arr" aria-hidden="true">→</span>
        </button>
      )}

      <div className="ld-minimal-box" aria-hidden="true">
        {/* Brand Identitas Aplikasi */}
        <div className="ld-minimal-identity">
          <div className="ld-minimal-logo-wrap">
            <img src={logoSadar} alt="" className="ld-minimal-logo" />
          </div>
          <div className="ld-minimal-meta-text">
            <h1 className="ld-minimal-title">
              SADAR <span className="ld-minimal-accent">EDU</span>
            </h1>
            <p className="ld-minimal-sub">
              WebGIS Persebaran &amp; Prioritas SMP Kabupaten Bogor
            </p>
          </div>
        </div>

        {/* Minimalist Progress Meter */}
        <div className="ld-minimal-meter">
          <div className="ld-progress-track">
            <div
              className="ld-progress-fill"
              style={{ width: `${value}%` }}
            />
          </div>

          <div className="ld-minimal-row">
            <span className="ld-minimal-status">
              {statusText}
              <span className="ld-minimal-dots">
                <i>.</i><i>.</i><i>.</i>
              </span>
            </span>
            <span className="ld-minimal-counter">
              {String(value).padStart(2, '0')}%
            </span>
          </div>
        </div>

        {/* Lokasi & Status */}
        <div className="ld-minimal-tag">
          <span>Kabupaten Bogor</span>
          <span className="ld-tag-sep">·</span>
          <span>Sistem Informasi Geografis</span>
        </div>
      </div>
    </aside>
  );
}
