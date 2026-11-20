import { useEffect, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import logo from "../../assets/figma/logo-sadar.svg";

/**
 * EditorialIntro - Signature Intro for SADAR EDU
 *
 * Sesuai prinsip Impeccable:
 * 1. Tanpa fake loading counter (0-100%) atau teks telemetri buatan.
 * 2. Hanya muncul saat pertama kali pengguna membuka landing page.
 * 3. Dapat di-skip kapan saja secara instan via tombol "Lewati" maupun tombol keyboard [Esc] / [Space] / [Enter].
 * 4. Desain elegan bertema geospasial edukasi: aksen teal/mint, komposisi arsitektural bersih, dan transisi keluar mulus.
 */
export default function EditorialIntro({ onComplete }) {
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const timelineRef = useRef(null);
  const hasFinishedRef = useRef(false);

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    if (typeof onComplete === "function") {
      onComplete();
    }
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    if (hasFinishedRef.current) return;
    if (timelineRef.current) {
      timelineRef.current.kill();
    }
    const container = containerRef.current;
    if (!container) {
      handleFinish();
      return;
    }
    // Animasi keluar instan dan mulus saat di-skip
    gsap.to(container, {
      opacity: 0,
      yPercent: -12,
      duration: 0.24,
      ease: "power3.inOut",
      onComplete: handleFinish,
    });
  }, [handleFinish]);

  useEffect(() => {
    // 1. Kunci scroll selama intro berlangsung
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Dukungan keyboard: Escape, Space, atau Enter untuk langsung skip
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // 3. Rangkaian animasi intro yang ringkas, percaya diri (~1.8s total), tanpa fake loading
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(containerRef.current, {
            yPercent: -100,
            duration: 0.65,
            ease: "power4.inOut",
            onComplete: handleFinish,
          });
        },
      });
      timelineRef.current = tl;

      // Initial state
      gsap.set(containerRef.current, { opacity: 1, yPercent: 0 });
      gsap.set(cardRef.current, { opacity: 0, y: 16, scale: 0.98 });
      gsap.set(".intro-brand-logo", { scale: 0.85, opacity: 0 });
      gsap.set(".intro-brand-title", { opacity: 0, y: 12 });
      gsap.set(".intro-brand-desc", { opacity: 0, y: 8 });
      gsap.set(".intro-tag-pill", { opacity: 0, scale: 0.9 });
      gsap.set(".intro-skip-btn", { opacity: 0, y: -6 });

      // Entrance
      tl.to(cardRef.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: "power3.out",
      }, 0.05);

      tl.to(".intro-skip-btn", {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: "power2.out",
      }, 0.1);

      tl.to(".intro-brand-logo", {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: "back.out(1.5)",
      }, 0.15);

      tl.to(".intro-tag-pill", {
        opacity: 1,
        scale: 1,
        duration: 0.35,
        ease: "power2.out",
      }, 0.25);

      tl.to(".intro-brand-title", {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
      }, 0.3);

      tl.to(".intro-brand-desc", {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
      }, 0.4);

      // Jeda apresiasi visual singkat sebelum membuka beranda
      tl.to({}, { duration: 0.95 });
    }, containerRef);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      ctx.revert();
    };
  }, [handleFinish, handleSkip]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pengenalan Sadar Edu"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden font-sans text-white bg-[#06242B]"
      style={{
        background:
          "radial-gradient(ellipse 90% 80% at 50% 45%, #0B3A44 0%, #06242B 65%, #031418 100%)",
        willChange: "transform, opacity",
      }}
    >
      {/* Hairline Grid Accent */}
      <div className="absolute inset-0 pointer-events-none opacity-20" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#52D9C9] to-transparent" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-[#52D9C9] to-transparent" />
      </div>

      {/* Header Bar dengan Tombol Skip */}
      <div className="w-full max-w-5xl flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#A5F3FC]/75 uppercase">
          <span className="w-2 h-2 rounded-full bg-[#52D9C9] inline-block animate-pulse" />
          <span>Sistem Informasi Geografis Pendidikan</span>
        </div>

        <button
          onClick={handleSkip}
          className="intro-skip-btn group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-[#E0F2FE] bg-white/10 hover:bg-white/20 border border-white/20 hover:border-[#52D9C9]/50 transition-all duration-200 cursor-pointer backdrop-blur-md active:scale-95"
          aria-label="Lewati intro dan langsung ke beranda"
        >
          <span>Lewati</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-[#A5F3FC]">
            Esc
          </kbd>
          <ArrowRight size={13} className="text-[#52D9C9] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Konten Utama Terpusat (Bebas Slop & Tanpa Fake Ticker) */}
      <div
        ref={cardRef}
        className="relative z-10 my-auto flex flex-col items-center text-center max-w-2xl px-4 py-8"
      >
        {/* Logo Emblem */}
        <div className="intro-brand-logo mb-6 relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-b from-[#0F4C59] to-[#083038] border border-[#52D9C9]/40 shadow-xl shadow-[#041D22]/80 flex items-center justify-center p-4">
            <img
              src={logo}
              alt="Logo Sadar Edu"
              className="w-full h-full object-contain filter drop-shadow(0 4px 12px rgba(82,217,201,0.35))"
            />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-[#52D9C9]/15 blur-lg -z-10 pointer-events-none" />
        </div>

        {/* Tag Pill */}
        <div className="intro-tag-pill inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#52D9C9]/15 border border-[#52D9C9]/30 text-[#A7F3D0] text-[11px] font-mono font-medium tracking-widest uppercase mb-4">
          <span>KABUPATEN BOGOR</span>
          <span className="w-1 h-1 rounded-full bg-[#52D9C9]" />
          <span>SDSS PENDIDIKAN</span>
        </div>

        {/* Judul Utama */}
        <h1 className="intro-brand-title text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-3 leading-[1.05]">
          SADAR <span className="text-[#52D9C9] font-light">EDU</span>
        </h1>

        {/* Deskripsi Bersih & Manusiawi */}
        <p className="intro-brand-desc text-sm sm:text-base text-slate-200/85 max-w-lg leading-relaxed font-normal">
          Platform pemetaan spasial dan pengambilan keputusan berbasis bukti untuk pemerataan akses sekolah menengah pertama di Kabupaten Bogor.
        </p>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-5xl flex items-center justify-between relative z-10 pt-4 border-t border-white/10 text-[11px] text-white/50 font-mono">
        <span className="hidden sm:inline">Dinas Pendidikan Kabupaten Bogor</span>
        <span className="ml-auto sm:ml-0 text-[#A5F3FC]/75">Klik layar atau tekan tombol untuk masuk</span>
      </div>
    </div>
  );
}
