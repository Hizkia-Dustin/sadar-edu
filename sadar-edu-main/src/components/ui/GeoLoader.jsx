import { useEffect, useState } from 'react';
import { DotPin, DotText } from './DotMatrix';
import './geo-loader.css';

export function GeoMark() {
  return <span className="geo-mark" aria-hidden="true" />;
}

export default function GeoLoader({ label = 'Memuat…', className = '' }) {
  return <span className={`geo-loader ${className}`} role="status"><GeoMark />{label}</span>;
}

const INTRO_MS = 1500;
const SCATTER_DELAY_MS = 180;
const SCRAMBLE_MS = 620;
const SCRAMBLE_CHARS = 'SADREUBOGPTIKLN0123456789';

// Kata raksasa fase kedua; posisi dalam persen kartu (fakta nyata: 40 kecamatan di Kab. Bogor).
const SCATTER_WORDS = [
  { text: 'SADAR', x: 3, y: 22 },
  { text: 'EDU', x: 12, y: 49 },
  { text: '/PETA', x: 54, y: 7 },
  { text: 'BOGOR', x: 50, y: 31 },
  { text: 'SIG', x: 67, y: 56 },
  { text: '40', x: 3, y: 76 },
  { text: '2026', x: 35, y: 76 },
];

function scramble(text, progress) {
  return text
    .split('')
    .map((ch, i) => {
      if (ch === '/' || i / text.length < progress) return ch;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

// Fase kata raksasa: huruf diacak lalu mengendap dari kiri ke kanan.
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

  // Setelah 100%, intro berganti ke kartu berbingkai dengan kata dot-matrix raksasa.
  useEffect(() => {
    if (!intro || value < 100 || scatter) return undefined;
    const id = window.setTimeout(() => setScatter(true), SCATTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [intro, value, scatter]);

  function finishReveal(event) {
    if (event.target === event.currentTarget && event.animationName === 'sadar-brush-out') onRevealed?.();
  }

  return (
    <div className="geo-screen" data-intro={intro} data-phase={scatter ? 'scatter' : 'count'} data-leaving={leaving} onAnimationEnd={finishReveal}>
      <span className="sr-only" role="status">{intro ? 'Pembuka SADAR EDU, Kelompok 2.' : label}</span>

      <div className="ld-card" aria-hidden="true">
      {intro && (
        <div className="ld-scatter">
          <div className="ld-topbar">
            <DotText text="SADAR·EDU" className="ld-tag" />
            <span className="ld-topnav"><span>Peta</span><span>Sekolah</span><span>Analisis</span></span>
            <span className="ld-badge"><i />Kelompok 2</span>
          </div>
          {SCATTER_WORDS.map((w, i) => (
            <span key={w.text} className="ld-word" style={{ left: `${w.x}%`, top: `${w.y}%`, '--w': i }}>
              <DotText text={words[i]} print />
            </span>
          ))}
        </div>
      )}
      <div className="ld-board">
        <p className="ld-label">
          {intro ? 'Menyiapkan atlas pendidikan' : label.replace(/…$/, '')}
          <span className="ld-ellipsis"><i>.</i><i>.</i><i>.</i></span>
        </p>

        <div className="ld-counter">
          <DotText text={`${String(value).padStart(3, '0')}%`} className="ld-digits" />
          <div className="ld-meta">
            <DotText text="SADAR·EDU" className="ld-tag" />
            <span>Kab. Bogor · 2026</span>
          </div>
        </div>

        <DotPin className="ld-pin" animated />
      </div>
      </div>

      {intro && (
        <>
          <p className="ld-credit" aria-hidden="true">Kelompok <strong>2</strong></p>
          <button className="ld-skip" type="button" onClick={onSkip}>
            Lewati intro <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </div>
  );
}
