import { useEffect, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import logo from "../../assets/figma/logo-sadar.svg";

/**
 * EditorialIntro - Anti-Slop, Clean Light Signature Intro for SADAR EDU
 *
 * Mengikuti pedoman antislop-ui & identitas asli Sadar Edu:
 * - Warna solid terang (tanpa gradient, tidak gelap): latar #F5F7F5 dan teks #173E50.
 * - Tanpa dot dekoratif maupun aksen visual klise.
 * - Tanpa fake loading, angka ticker palsu, atau progress bar.
 * - Dapat dilewati kapan saja (klik di mana saja, tombol Lewati, atau tombol Esc / Space / Enter).
 * - Hanya tampil 1x pada kunjungan pertama ke landing page (session-persisted).
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
      duration: 0.32,
      ease: "power3.inOut",
      onComplete: finish,
    });
  }, [finish]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", handleKey);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(containerRef.current, {
            yPercent: -100,
            duration: 0.55,
            ease: "power4.inOut",
            onComplete: finish,
          });
        },
      });
      timelineRef.current = tl;

      gsap.set(containerRef.current, { opacity: 1, yPercent: 0 });
      gsap.set(contentRef.current, { opacity: 0, y: 14 });
      gsap.set(".intro-skip-btn", { opacity: 0 });

      tl.to(contentRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
      }, 0.05);

      tl.to(".intro-skip-btn", {
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
      }, 0.12);

      // Jeda singkat (~0.85s) agar terbaca jelas sebelum otomatis mengangkat curtain
      tl.to({}, { duration: 0.85 });
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
      className="fixed inset-0 z-[9999] flex flex-col justify-between p-6 sm:p-12 md:p-16 select-none bg-[#F5F7F5] text-[#173E50] font-sans cursor-pointer border-b border-[#E7EEEA]"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pointer-events-auto">
        <span className="text-xs sm:text-sm font-semibold tracking-tight text-[#173E50]/80">
          Dinas Pendidikan Kabupaten Bogor
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
          className="intro-skip-btn inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#173E50] bg-white hover:bg-[#E7EEEA] border border-[#CBD5E1] transition-colors cursor-pointer shadow-xs"
          aria-label="Lewati pengenalan dan buka beranda"
        >
          <span>Lewati</span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Esc
          </kbd>
          <ArrowRight size={13} className="text-[#1F6F5F]" aria-hidden="true" />
        </button>
      </header>

      {/* Main Brand Composition (Solid, Clean, Anti-Slop) */}
      <main
        ref={contentRef}
        className="w-full max-w-xl mx-auto my-auto flex flex-col items-center text-center px-4"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-5 flex items-center justify-center p-2 rounded-2xl bg-white border border-[#E7EEEA] shadow-xs">
          <img
            src={logo}
            alt=""
            width="64"
            height="64"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#173E50] mb-3 leading-tight">
          SADAR EDU
        </h1>

        <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-md">
          Sistem Informasi Geografis & Analisis Kebutuhan Sekolah Menengah Pertama di Kabupaten Bogor.
        </p>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-500 border-t border-[#E7EEEA] pt-4">
        <span>Pemetaan Spasial Berbasis Data</span>
        <span className="hidden sm:inline">Klik layar atau tekan Esc untuk langsung masuk</span>
      </footer>
    </div>
  );
}
