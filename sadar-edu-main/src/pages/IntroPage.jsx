import React, { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Compass, MapPin } from "lucide-react";
import { gsap } from "gsap";
import logo from "../assets/figma/logo-sadar.svg";

/**
 * IntroPage - Signature Editorial Intro Inspired by User Design Reference
 *
 * Visual System:
 * - Left Accent Pillar: Vibrant Turquoise/Mint (#52D9C9) at ~15% viewport width.
 * - Main Architectural Stage: Deep Ocean Cyan/Teal (#083D49) with subtle 1px hairline grid.
 * - Coordinates: 06°35'S / 106°48'E (Kota Bogor).
 * - Massive Split Typography:
 *     Row 1: "SADAR" (Solid Bold Pure White #EFFFFB)
 *     Row 2: "EDU" (Hollow Wireframe Stroke Text with transparent fill)
 * - Clean Navigation Links to Peta Interaktif & Beranda.
 */
export default function IntroPage() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance Animation
      gsap.set(".intro-pillar", { xPercent: -100 });
      gsap.set(".intro-grid-line", { opacity: 0 });
      gsap.set(".intro-coord", { opacity: 0, y: -10 });
      gsap.set(".intro-tagline", { opacity: 0, x: -20 });
      gsap.set(".intro-title-solid", { yPercent: 110, opacity: 0 });
      gsap.set(".intro-title-outline", { yPercent: 110, opacity: 0 });
      gsap.set(".intro-footer-line", { scaleX: 0, transformOrigin: "left center" });
      gsap.set(".intro-footer-text", { opacity: 0, y: 10 });
      gsap.set(".intro-cta", { opacity: 0, scale: 0.95 });

      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      // 1. Pillar slides in from left
      tl.to(".intro-pillar", {
        xPercent: 0,
        duration: 0.9,
        ease: "expo.out",
      }, 0.1);

      // 2. Grid lines emerge
      tl.to(".intro-grid-line", {
        opacity: 1,
        duration: 0.8,
        stagger: 0.08,
      }, 0.3);

      // 3. Top coordinates and subtitle tag
      tl.to([".intro-coord", ".intro-tagline"], {
        opacity: 1,
        y: 0,
        x: 0,
        duration: 0.6,
      }, 0.45);

      // 4. Massive Typography Float-Up
      tl.to(".intro-title-solid", {
        yPercent: 0,
        opacity: 1,
        duration: 0.85,
        ease: "power4.out",
      }, 0.5);

      tl.to(".intro-title-outline", {
        yPercent: 0,
        opacity: 1,
        duration: 0.85,
        ease: "power4.out",
      }, 0.6);

      // 5. Footer Line & Bottom Badges
      tl.to(".intro-footer-line", {
        scaleX: 1,
        duration: 0.8,
        ease: "expo.out",
      }, 0.7);

      tl.to([".intro-footer-text", ".intro-cta"], {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
      }, 0.85);

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden select-none bg-[#083D49] text-[#EFFFFB] font-sans flex"
    >
      {/* ================= LEFT ACCENT PILLAR (TURQUOISE/MINT) ================= */}
      <aside className="intro-pillar relative w-[18%] sm:w-[15%] h-full bg-[#52D9C9] flex flex-col justify-between p-4 sm:p-6 z-20 shrink-0">
        {/* Brand Tag Box in Left Pillar (Double Border Pill from Reference) */}
        <div className="relative">
          <div className="group flex items-center gap-2 p-2 sm:px-3 sm:py-2.5 rounded-lg border-2 border-[#083D49]/40 bg-[#52D9C9] shadow-sm">
            <div className="w-6 h-6 rounded-full bg-[#083D49] flex items-center justify-center p-1 shrink-0">
              <img
                src={logo}
                alt="SADAR EDU"
                className="w-full h-full object-contain filter brightness-200"
              />
            </div>
            <span className="hidden md:inline-block font-extrabold text-[12px] tracking-tight uppercase text-[#083D49]">
              SADAR EDU
            </span>
          </div>
        </div>

        {/* Pillar Footer Indicator */}
        <div className="text-[10px] sm:text-xs font-mono font-bold text-[#083D49] tracking-widest uppercase">
          [ 01 // ID ]
        </div>
      </aside>

      {/* ================= MAIN ARCHITECTURAL CANVAS ================= */}
      <main className="relative flex-1 h-full flex flex-col justify-between p-6 sm:p-12 md:p-16 overflow-hidden">

        {/* Subtle Architectural Grid Lines (1px Hairlines) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Vertical Grid Line 1 */}
          <div className="intro-grid-line absolute top-0 bottom-0 left-[28%] w-[1px] bg-white/[0.08]" />
          {/* Vertical Grid Line 2 */}
          <div className="intro-grid-line absolute top-0 bottom-0 left-[68%] w-[1px] bg-white/[0.08]" />
          {/* Horizontal Center Grid Line */}
          <div className="intro-grid-line absolute left-0 right-0 top-[50%] h-[1px] bg-white/[0.08]" />
        </div>

        {/* ================= TOP BAR ================= */}
        <header className="relative z-10 flex items-center justify-between">
          <div className="intro-tagline hidden sm:flex items-center gap-4 text-xs font-mono tracking-widest text-white/70 uppercase">
            <span>PLATFORM SPASIAL</span>
            <span className="w-12 h-[1px] bg-white/40 inline-block" />
            <span>KOTA BOGOR, INDONESIA</span>
          </div>

          {/* Coordinates (06°35'S / 106°48'E from reference) */}
          <div className="intro-coord ml-auto font-mono text-xs sm:text-sm font-semibold tracking-widest text-[#52D9C9]">
            06°35'S / 106°48'E
          </div>
        </header>

        {/* ================= CENTER HERO TYPOGRAPHY (SADAR / EDU) ================= */}
        <div className="relative z-10 my-auto py-4 flex flex-col justify-center">
          {/* Subtitle Line with connector */}
          <div className="intro-tagline flex items-center gap-4 mb-2 sm:mb-4 text-xs sm:text-sm font-mono tracking-[0.25em] text-white/60 uppercase">
            <span>EXPLORING</span>
            <span className="w-14 sm:w-20 h-[1px] bg-white/30 inline-block" />
            <span className="text-[#52D9C9] font-bold">BOGOR EDUCATION</span>
          </div>

          {/* Row 1: SOLID BOLD WHITE TEXT "SADAR" */}
          <div className="overflow-hidden">
            <h1 className="intro-title-solid text-7xl sm:text-9xl md:text-[130px] lg:text-[160px] font-black uppercase tracking-tighter leading-[0.88] text-[#EFFFFB]">
              SADAR
            </h1>
          </div>

          {/* Row 2: HOLLOW OUTLINE / WIREFRAME TEXT "EDU" */}
          <div className="overflow-hidden mt-1 sm:mt-2">
            <h2
              className="intro-title-outline text-7xl sm:text-9xl md:text-[130px] lg:text-[160px] font-black uppercase tracking-tighter leading-[0.88] text-transparent"
              style={{
                WebkitTextStroke: "2px #EFFFFB",
                textStroke: "2px #EFFFFB",
              }}
            >
              EDU
            </h2>
          </div>

          {/* Narrative Summary & Action Button */}
          <div className="intro-cta mt-6 sm:mt-10 flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              to="/peta"
              className="group inline-flex items-center gap-3 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-[#52D9C9] hover:bg-white text-[#083D49] font-bold text-sm tracking-wider uppercase transition-all shadow-lg active:scale-95"
            >
              <span>Buka Peta Interaktif</span>
              <Compass size={18} className="group-hover:rotate-45 transition-transform" />
            </Link>

            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-3.5 sm:px-6 sm:py-4 rounded-xl border border-white/20 hover:border-white/50 hover:bg-white/5 text-white/90 font-mono text-xs sm:text-sm tracking-wider uppercase transition-all"
            >
              <span>Lihat Beranda</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        {/* ================= BOTTOM BAR ================= */}
        <footer className="relative z-10 pt-4">
          {/* Thin Horizontal Dividing Line */}
          <div className="intro-footer-line w-full h-[1px] bg-white/20 mb-4" />

          <div className="intro-footer-text flex items-center justify-between font-mono text-[10px] sm:text-xs text-white/60 tracking-wider">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52D9C9] inline-block animate-ping" />
              <span className="uppercase text-white/80">
                INCLUSIVE URBAN EDUCATION GEODATA
              </span>
            </div>

            <div className="text-right tracking-widest text-[#52D9C9] font-bold">
              PORTAL / 01
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
