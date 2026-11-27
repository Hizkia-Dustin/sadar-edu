import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { GeoLoaderScreen, GeoMark } from './GeoLoader';
import logoSadar from '../../assets/figma/logo-sadar.svg';

const ENTER_MS = 380;
const LEAVE_MS = 540;
const MIN_HOLD_MS = 70;

// Efek ini baru berjalan setelah halaman lazy pada rute tujuan selesai dirender.
function WhenPageReady({ onReady }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

export default function GeoRouteBoundary({ location, children }) {
  const pathname = location.pathname;
  const [opening] = useState(() => ({
    path: pathname,
    start: performance.now(),
    enabled: ['/', '/intro', '/intro/'].includes(pathname) && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));

  const [openingPhase, setOpeningPhase] = useState(opening.enabled ? 'loading' : 'done');
  const [seenLocation, setSeenLocation] = useState(location);
  const [displayLocation, setDisplayLocation] = useState(location);
  // stage: 'idle' | 'entering' | 'holding' | 'leaving'
  const [stage, setStage] = useState('idle');
  const [showSlowHint, setShowSlowHint] = useState(false);

  const holdStartedAtRef = useRef(0);

  // Deteksi perpindahan halaman secara sinkron saat prop location berubah (pola resmi React 19).
  if (location !== seenLocation) {
    setSeenLocation(location);
    if (location.pathname === displayLocation.pathname) {
      setDisplayLocation(location);
    } else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (openingPhase !== 'done') setOpeningPhase('done');
      setDisplayLocation(location);
      if (stage !== 'idle') setStage('idle');
    } else {
      if (openingPhase !== 'done') setOpeningPhase('done');
      if (stage === 'holding') {
        setDisplayLocation(location);
      } else if (stage !== 'entering') {
        setShowSlowHint(false);
        setStage('entering');
      }
    }
  }

  const showOpening = opening.enabled && openingPhase !== 'done';

  // Opening intro pada landing / intro pertama kali:
  // Hitung 0-100%, lalu fase kedua kartu berbingkai, kemudian slide up (sadar-brush-out).
  const exitOpeningWhenReady = useCallback(() => {
    const remaining = Math.max(0, 3700 - (performance.now() - opening.start));
    const timer = window.setTimeout(() => setOpeningPhase('leaving'), remaining);
    return () => window.clearTimeout(timer);
  }, [opening]);

  useEffect(() => {
    if (!opening.enabled || openingPhase === 'done') return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setOpeningPhase('done');
    const timeout = openingPhase === 'leaving' ? window.setTimeout(finish, 900) : undefined;
    if (preference.matches) {
      const immediate = window.setTimeout(finish, 0);
      return () => {
        window.clearTimeout(immediate);
        window.clearTimeout(timeout);
      };
    }
    preference.addEventListener('change', finish);
    return () => {
      window.clearTimeout(timeout);
      preference.removeEventListener('change', finish);
    };
  }, [opening, openingPhase]);

  const commitSwap = useCallback(() => {
    holdStartedAtRef.current = performance.now();
    setDisplayLocation(seenLocation);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setStage('holding');
  }, [seenLocation]);

  const startLeave = useCallback(() => {
    setShowSlowHint(false);
    setStage('leaving');
  }, []);

  // Pengatur timer pengaman & indikator memuat untuk tiap tahap sapuan
  useEffect(() => {
    if (stage === 'entering') {
      const safety = window.setTimeout(commitSwap, ENTER_MS + 60);
      return () => window.clearTimeout(safety);
    }
    if (stage === 'holding') {
      const slow = window.setTimeout(() => setShowSlowHint(true), 260);
      return () => window.clearTimeout(slow);
    }
    if (stage === 'leaving') {
      const safety = window.setTimeout(() => setStage('idle'), LEAVE_MS + 140);
      return () => window.clearTimeout(safety);
    }
    return undefined;
  }, [stage, commitSwap]);

  // Dipanggil otomatis ketika halaman tujuan (termasuk lazy chunk) selesai render
  const handleTargetReady = useCallback(() => {
    if (stage !== 'holding') return undefined;
    const elapsed = performance.now() - holdStartedAtRef.current;
    const wait = Math.max(0, MIN_HOLD_MS - elapsed);
    let rafId = 0;
    const timer = window.setTimeout(() => {
      rafId = requestAnimationFrame(() => startLeave());
    }, wait);
    return () => {
      window.clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [stage, startLeave]);

  const handleBrushAnimationEnd = (event) => {
    if (event.target !== event.currentTarget) return;
    if (stage === 'entering' && event.animationName === 'sadar-brush-in') {
      commitSwap();
    } else if (stage === 'leaving' && event.animationName === 'sadar-brush-out') {
      setStage('idle');
    }
  };

  const renderedChildren = typeof children === 'function' ? children(displayLocation) : children;

  return (
    <>
      {showOpening && (
        <GeoLoaderScreen
          leaving={openingPhase === 'leaving'}
          onRevealed={() => setOpeningPhase('done')}
          onSkip={() => setOpeningPhase('done')}
        />
      )}

      {!showOpening && stage !== 'idle' && (
        <div
          className="sadar-route-transition"
          data-stage={stage}
          aria-hidden={!showSlowHint}
        >
          <div
            className="sadar-route-brush-veil"
            data-stage={stage}
            onAnimationEnd={handleBrushAnimationEnd}
          />
          <div className="sadar-route-brand" data-visible={stage === 'holding' || stage === 'entering'}>
            <div className="sadar-route-wordmark">
              <img src={logoSadar} alt="" className="sadar-route-logo" />
              <span className="sadar-route-title">
                SADAR <strong>EDU</strong>
              </span>
            </div>
            {showSlowHint && (
              <span className="sadar-route-wait" role="status">
                <GeoMark /> Memuat halaman…
              </span>
            )}
          </div>
        </div>
      )}

      <div
        inert={showOpening || stage === 'entering' || stage === 'holding' || undefined}
        className="w-full min-h-screen bg-[#F8FAFC] font-sans text-slate-800 antialiased"
      >
        <Suspense fallback={showOpening || stage !== 'idle' ? null : <GeoLoaderScreen />}>
          {renderedChildren}
          {showOpening && <WhenPageReady onReady={exitOpeningWhenReady} />}
          {stage === 'holding' && (
            <WhenPageReady key={displayLocation.pathname} onReady={handleTargetReady} />
          )}
        </Suspense>
      </div>
    </>
  );
}
