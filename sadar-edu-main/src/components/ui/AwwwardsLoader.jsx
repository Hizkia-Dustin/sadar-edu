import { useEffect, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import logo from "../../assets/figma/logo-sadar.svg";

/**
 * EditorialIntro - Clean, Anti-Slop Signature Intro for SADAR EDU
 *
 * Mengikuti standar design-taste-frontend & Impeccable:
 * - Tidak ada fake loading, persentase palsu, atau teks telemetri fiktif.
 * - Tipografi presisi dan berbobot tanpa ornamen neon/glow yang berlebihan.
 * - Muncul hanya pada kunjungan pertama ke landing page (session-persisted).
 * - Dapat dilewati seketika (Skip) via tombol atau tombol keyboard [Esc] / [Space] / [Enter].
 * - Transisi pembuka ke beranda berlangsung mulus dan cepat (~1.5s total).
 */
export default function EditorialIntro({ onComplete }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const timelineRef = useRef(null);
  const isFinishedRef = useRef(false);

  const finish = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    if (typeof onComplete === "function") {
      onComplete();
    }
  }, [onComplete]);

  const skip = useCallback(() => {
    if (isFinishedRef.current) return;
    if (timelineRef.current) {
      timelineRef.current.kill();
    }
    const container = containerRef.current;
    if (!container) {
      finish();
      return;
    }
    // Keluar seketika dan halus saat pengguna menekan skip
    gsap.to(container, {
      opacity: 0,
      yPercent: -100,
      duration: 0.35,
      ease: "power3.inOut",
      onComplete: finish,
    });
  }, [finish]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Aksesibilitas keyboard untuk skip instan
    const handleKey = (e) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", handleKey);

    const ctx = gsap.context(() => {
      // Timeline singkat, tegas, dan tenang
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(containerRef.current, {
            yPercent: -100,
            duration: 0.6,
            ease: "power4.inOut",
            onComplete: finish,
          });
        },
      });
      timelineRef.current = tl;

      gsap.set(containerRef.current, { opacity: 1, yPercent: 0 });
      gsap.set(contentRef.current, { opacity: 0, y: 16 });
      gsap.set(".intro-skip", { opacity: 0 });

      // Masuk secara tenang
      tl.to(contentRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
      }, 0.05);

      tl.to(".intro-skip", {
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
      }, 0.15);

      // Jeda apresiasi identitas yang ringkas (~0.9s), tidak berlama-lama
      tl.to({}, { duration: 0.9 });
    }, containerRef);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
      ctx.revert();
    };
  }, [finish, skip]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pengenalan SADAR EDU"
      onClick={skip}
      className="fixed inset-0 z-[9999] flex flex-col justify-between p-8 sm:p-14 select-none bg-[#092B30] text-slate-100 font-sans cursor-pointer"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#34D399]" aria-hidden="true" />
          <span>Dinas Pendidikan Kabupaten Bogor</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
          className="intro-skip inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 transition-colors cursor-pointer"
          aria-label="Lewati pengenalan dan buka beranda"
        >
          <span>Lewati</span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-black/40 text-slate-300">
            Esc
          </kbd>
          <ArrowRight size={13} className="text-[#34D399]" aria-hidden="true" />
        </button>
      </header>

      {/* Main Centered Brand Composition */}
      <main
        ref={contentRef}
        className="w-full max-w-2xl mx-auto my-auto flex flex-col items-center text-center px-4"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-6 flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10">
          <img
            src={logo}
            alt=""
            width="80"
            height="80"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-4">
          SADAR EDU
        </h1>

        <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl">
          Sistem Informasi Geografis & Analisis Kebutuhan Sekolah Menengah Pertama di Kabupaten Bogor.
        </p>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
        <span>Pemetaan Spasial & Perencanaan Berbasis Data</span>
        <span className="hidden sm:inline">Tekan Esc atau klik untuk melanjutkan</span>
      </footer>
    </div>
  );
}
