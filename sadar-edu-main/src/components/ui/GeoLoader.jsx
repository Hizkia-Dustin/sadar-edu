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

const INTRO_MS = 1500;
const SCATTER_DELAY_MS = 180;
const SCRAMBLE_MS = 620;
const SCRAMBLE_CHARS = 'SADREUBOGPTIKLN0123456789';

// Kata-kata editorial fase kedua berakar pada tema spasial SADAR EDU Kab. Bogor
const SCATTER_WORDS = [
  { text: 'SADAR EDU', sub: 'WebGIS Analisis Pendidikan', x: 4, y: 16 },
  { text: 'KAB. BOGOR', sub: 'Wilayah Kajian 40 Kecamatan', x: 50, y: 16 },
  { text: 'ZONASI SMP', sub: 'Analisis Blank Spot & Daya Tampung', x: 4, y: 46 },
  { text: '918 SEKOLAH', sub: 'Sebaran SMP Negeri & Swasta', x: 50, y: 46 },
  { text: 'SIMULASI USB', sub: 'Unit Sekolah Baru & RKB', x: 4, y: 74 },
  { text: '2026', sub: 'Edisi Pemutakhiran Spasial', x: 50, y: 74 },
];

function scramble(text, progress) {
  return text
    .split('')
    .map((ch, i) => {
      if (ch === ' ' || ch === '.' || ch === '&' || i / text.length < progress) return ch;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

function useScatterWords(active) {
  const [words, setWords] = useState(() => SCATTER_WORDS.map((w) => w.text));
  useEffect(() => {
    if (!active || reducedMotion()) return undefined;
    const start = performance.now();
    const id = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / SCRAMBLE_MS);
      setWords(SCATTER_WORDS.map((w) => scramble(w.text, progress)));
      if (progress >= 1) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [active]);
  return words;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function useLoadCounter(intro) {
  const [value, setValue] = useState(() => (reducedMotion() ? (intro ? 100 : 99) : 0));
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = now - start;
      const next = intro
        ? Math.min(100, Math.round(100 * (1 - (1 - Math.min(1, t / INTRO_MS)) ** 3)))
        : Math.min(99, Math.round(99 * (1 - Math.exp(-t / 900))));
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
  const [scatter, setScatter] = useState(false);
  const words = useScatterWords(scatter);

  useEffect(() => {
    if (!intro || value < 100 || scatter) return undefined;
    const id = window.setTimeout(() => setScatter(true), SCATTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [intro, value, scatter]);

  function finishReveal(event) {
    if (event.target === event.currentTarget && event.animationName === 'sadar-brush-out') onRevealed?.();
  }

  return (
    <div
      className="geo-screen"
      data-intro={intro}
      data-phase={scatter ? 'scatter' : 'count'}
      data-leaving={leaving}
      onAnimationEnd={finishReveal}
    >
      <span className="sr-only" role="status">
        {intro ? 'Pembuka SADAR EDU, WebGIS Analisis Pendidikan Kabupaten Bogor.' : label}
      </span>

      <div className="ld-card" aria-hidden="true">
        {intro && (
          <div className="ld-scatter">
            <div className="ld-topbar">
              <div className="ld-brand-pill">
                <img src={logoSadar} alt="" className="ld-logo-icon" />
                <span className="ld-brand-name">
                  SADAR <span className="ld-brand-accent">EDU</span>
                </span>
              </div>
              <div className="ld-topnav">
                <span>Peta Interaktif</span>
                <span>Analisis Spasial</span>
                <span>Simulasi Zonasi</span>
              </div>
              <span className="ld-badge">
                <i />
                Kelompok 2
              </span>
            </div>

            <div className="ld-words-grid">
              {SCATTER_WORDS.map((w, i) => (
                <div key={w.text} className="ld-word-card" style={{ '--w': i }}>
                  <span className="ld-word-title">{words[i]}</span>
                  <span className="ld-word-sub">{w.sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ld-board">
          <div className="ld-header-area">
            <div className="ld-brand-pill">
              <img src={logoSadar} alt="" className="ld-logo-icon" />
              <span className="ld-brand-name">
                SADAR <span className="ld-brand-accent">EDU</span>
              </span>
            </div>
            <p className="ld-label">
              {intro ? 'Menyiapkan atlas spasial pendidikan' : label.replace(/…$/, '')}
              <span className="ld-ellipsis">
                <i>.</i><i>.</i><i>.</i>
              </span>
            </p>
          </div>

          <div className="ld-counter">
            <div className="ld-num-counter">
              <span className="ld-num-val">{String(value).padStart(2, '0')}</span>
              <span className="ld-num-pct">%</span>
            </div>
            <div className="ld-progress-track">
              <div className="ld-progress-fill" style={{ width: `${value}%` }} />
            </div>
            <div className="ld-meta">
              <span className="ld-meta-loc">Kabupaten Bogor</span>
              <span className="ld-meta-dot">·</span>
              <span className="ld-meta-year">2026</span>
            </div>
          </div>
        </div>
      </div>

      {intro && (
        <div className="ld-footer-bar">
          <p className="ld-credit" aria-hidden="true">
            WebGIS Pendidikan <span className="ld-credit-sep">·</span> <strong>Kelompok 2</strong>
          </p>
          <button className="ld-skip" type="button" onClick={onSkip}>
            <span>Lewati intro</span>
            <span className="ld-skip-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
