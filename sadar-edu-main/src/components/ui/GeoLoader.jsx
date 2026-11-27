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

// Kata raksasa fase kedua di atas kanvas; posisi dalam persen kartu (tentang aplikasi & Kab. Bogor).
const SCATTER_WORDS = [
  { text: 'SADAR', x: 4, y: 20, tone: 'ink' },
  { text: 'EDU', x: 13, y: 47, tone: 'green' },
  { text: '/PETA', x: 54, y: 9, tone: 'muted' },
  { text: 'BOGOR', x: 49, y: 33, tone: 'ink' },
  { text: 'SIG', x: 68, y: 58, tone: 'green' },
  { text: '40 KEC', x: 4, y: 76, tone: 'muted' },
  { text: '2026', x: 38, y: 76, tone: 'ink' },
];

function scramble(text, progress) {
  return text
    .split('')
    .map((ch, i) => {
      if (ch === '/' || ch === ' ' || i / text.length < progress) return ch;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

// Fase kata raksasa: huruf diacak lalu mengendap dari kiri ke kanan (animasi asli).
function useScatterWords(active) {
  const [words, setWords] = useState(() => SCATTER_WORDS.map((w) => w.text));
  useEffect(() => {
    if (!active || reducedMotion()) return undefined;
    const start = performance.now();
    const id = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / SCRAMBLE_MS);
      setWords(SCATTER_WORDS.map((w) => scramble(w.text, progress)));
      if (progress >= 1) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, [active]);
  return words;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Penghitung persen: intro naik ke 100 dalam waktu tetap; layar biasa mendekati 99 sampai halaman siap.
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

  // Setelah 100%, intro berganti ke kartu berbingkai dengan komposisi tipografi aplikasi.
  useEffect(() => {
    if (!intro || value < 100 || scatter) return undefined;
    const id = window.setTimeout(() => setScatter(true), SCATTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [intro, value, scatter]);

  function finishReveal(event) {
    if (event.target === event.currentTarget && event.animationName === 'sadar-brush-out') {
      onRevealed?.();
    }
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
        {intro ? 'Pembuka SADAR EDU, WebGIS Pendidikan Kabupaten Bogor.' : label}
      </span>

      <div className="ld-card" aria-hidden="true">
        {intro && (
          <div className="ld-scatter">
            <div className="ld-topbar">
              <span className="ld-brand-inline">
                <img src={logoSadar} alt="" className="ld-brand-logo" />
                <span>SADAR <strong>EDU</strong></span>
              </span>
              <span className="ld-topnav">
                <span>Peta</span>
                <span>Sekolah</span>
                <span>Analisis</span>
              </span>
              <span className="ld-badge">
                <i />
                Kab. Bogor
              </span>
            </div>

            {SCATTER_WORDS.map((w, i) => (
              <span
                key={w.text}
                className="ld-word"
                data-tone={w.tone}
                style={{ left: `${w.x}%`, top: `${w.y}%`, '--w': i }}
              >
                <span className="ld-word-glyph">{words[i]}</span>
              </span>
            ))}
          </div>
        )}

        <div className="ld-board">
          <p className="ld-label">
            {intro ? 'Menyiapkan atlas pendidikan' : label.replace(/…$/, '')}
            <span className="ld-ellipsis">
              <i>.</i><i>.</i><i>.</i>
            </span>
          </p>

          <div className="ld-counter">
            <div className="ld-digits">
              <span>{String(value).padStart(3, '0')}</span>
              <small>%</small>
            </div>
            <div className="ld-progress-line">
              <div className="ld-progress-fill" style={{ width: `${value}%` }} />
            </div>
            <div className="ld-meta">
              <span className="ld-tag">SADAR EDU</span>
              <span>Kab. Bogor · 2026</span>
            </div>
          </div>

          <div className="ld-pin" aria-hidden="true">
            <div className="ld-pin-ring" />
            <div className="ld-pin-core">
              <img src={logoSadar} alt="" className="ld-pin-logo" />
            </div>
          </div>
        </div>
      </div>

      {intro && (
        <>
          <p className="ld-credit" aria-hidden="true">
            WebGIS <strong>Pendidikan</strong>
          </p>
          <button className="ld-skip" type="button" onClick={onSkip}>
            Lewati intro <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </div>
  );
}
