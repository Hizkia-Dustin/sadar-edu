import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { gsap } from "gsap";
import logo from "../../assets/figma/logo-sadar.svg";

/**
 * PageTransition - Signature Editorial Transition (Akses Kota / Sadar Edu Style)
 *
 * Triggered on route changes between pages (e.g. Landing Page <-> Peta Interaktif):
 * - Left Accent Pillar: Vibrant Turquoise/Mint (#52D9C9) at ~15% viewport width.
 * - Main Architectural Stage: Deep Ocean Cyan/Teal (#083D49) with 1px hairline grid.
 * - Coordinates: 06°35'S / 106°48'E (Kota Bogor).
 * - Massive Split Typography:
 *     Row 1: "SADAR" (Solid Bold Pure White #EFFFFB)
 *     Row 2: "EDU" (Hollow Wireframe Stroke Text with transparent fill)
 * - Sweeps down and lifts away smoothly in ~0.85s without causing bad mood.
 */
export default function PageTransition() {
  const location = useLocation();
  const containerRef = useRef(null);
  const isFirstMount = useRef(true);
  const [destLabel, setDestLabel] = useState("");

  const getDestinationLabel = (pathname) => {
    if (pathname === "/peta") return "PETA INTERAKTIF";
    if (pathname === "/") return "BERANDA UTAMA";
    if (pathname.startsWith("/login")) return "PORTAL AUTENTIKASI";
    if (pathname.startsWith("/stakeholder")) return "DASHBOARD STAKEHOLDER";
    if (pathname.startsWith("/operator")) return "DASHBOARD OPERATOR";
    return "MEMUAT HALAMAN";
  };

  useEffect(() => {
    // Skip initial mount: AwwwardsLoader handles the initial entrance & refresh
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const label = getDestinationLabel(location.pathname);
    setDestLabel(label);

    const container = containerRef.current;
    if (!container) return;

    // Lock scroll during transition
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Set initial layout
    gsap.set(container, { display: "flex", yPercent: -100 });
    gsap.set(".trans-pillar", { xPercent: -100 });
    gsap.set(".trans-content", { opacity: 0, y: 15 });

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = originalOverflow;
        gsap.set(container, { display: "none" });
      },
    });

    // 1. Entire canvas drops down swiftly and smoothly
    tl.to(container, {
      yPercent: 0,
      duration: 0.45,
      ease: "power4.inOut",
    }, 0);

    // 2. Left pillar slides in
    tl.to(".trans-pillar", {
      xPercent: 0,
      duration: 0.4,
      ease: "expo.out",
    }, 0.2);

    // 3. Central hero content reveals
    tl.to(".trans-content", {
      opacity: 1,
      y: 0,
      duration: 0.35,
      ease: "power3.out",
    }, 0.25);

    // 4. Content lifts out
    tl.to(".trans-content", {
      opacity: 0,
      y: -20,
      duration: 0.28,
      ease: "power3.in",
    }, 0.65);

    // 5. Entire transition lifts upward cleanly to uncover the new page
    tl.to(container, {
      yPercent: -100,
      duration: 0.55,
      ease: "power4.inOut",
    }, 0.78);

    return () => {
      document.body.style.overflow = originalOverflow;
      tl.kill();
    };
  }, [location.pathname]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9990] pointer-events-none select-none overflow-hidden font-sans bg-[#083D49] text-[#EFFFFB] hidden flex-row"
      style={{ willChange: "transform" }}
    >
      {/* ================= LEFT ACCENT PILLAR (TURQUOISE/MINT) ================= */}
      <aside className="trans-pillar relative w-[18%] sm:w-[15%] h-full bg-[#52D9C9] flex flex-col justify-between p-4 sm:p-6 z-20 shrink-0">
        {/* Brand Tag Box with double border styling */}
        <div className="relative">
          <div className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-lg border-2 border-[#083D49]/40 bg-[#52D9C9]">
            <div className="w-5 h-5 rounded-full bg-[#083D49] flex items-center justify-center p-1 shrink-0">
              <img
                src={logo}
                alt="SADAR EDU"
                className="w-full h-full object-contain filter brightness-200"
              />
            </div>
            <span className="hidden md:inline-block font-extrabold text-[11px] tracking-tight uppercase text-[#083D49]">
              SADAR EDU
            </span>
          </div>
        </div>

        {/* Pillar Bottom ID */}
        <div className="text-[10px] font-mono font-bold text-[#083D49] tracking-widest uppercase">
          [ 01 // ID ]
        </div>
      </aside>

      {/* ================= MAIN ARCHITECTURAL CANVAS ================= */}
      <main className="relative flex-1 h-full flex flex-col justify-between p-6 sm:p-12 md:p-14 overflow-hidden">
        {/* 1px Hairline Grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 bottom-0 left-[28%] w-[1px] bg-white/[0.08]" />
          <div className="absolute top-0 bottom-0 left-[68%] w-[1px] bg-white/[0.08]" />
          <div className="absolute left-0 right-0 top-[50%] h-[1px] bg-white/[0.08]" />
        </div>

        {/* Top Header */}
        <header className="relative z-10 flex items-center justify-between">
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono tracking-widest text-white/70 uppercase">
            <span>NAVIGASI</span>
            <span className="w-10 h-[1px] bg-white/40 inline-block" />
            <span className="text-[#52D9C9] font-bold">{destLabel}</span>
          </div>

          {/* Coordinates */}
          <div className="ml-auto font-mono text-xs sm:text-sm font-semibold tracking-widest text-[#52D9C9]">
            06°35'S / 106°48'E
          </div>
        </header>

        {/* Center Hero Typography */}
        <div className="trans-content relative z-10 my-auto py-2 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2 text-xs font-mono tracking-[0.25em] text-white/60 uppercase">
            <span>EXPLORING</span>
            <span className="w-12 h-[1px] bg-white/30 inline-block" />
            <span className="text-[#52D9C9] font-bold">BOGOR EDUCATION</span>
          </div>

          {/* Row 1: SOLID BOLD WHITE TEXT "SADAR" */}
          <div className="overflow-hidden">
            <div className="text-6xl sm:text-8xl md:text-9xl lg:text-[120px] font-black uppercase tracking-tighter leading-[0.88] text-[#EFFFFB]">
              SADAR
            </div>
          </div>

          {/* Row 2: HOLLOW OUTLINE / WIREFRAME TEXT "EDU" */}
          <div className="overflow-hidden mt-1">
            <div
              className="text-6xl sm:text-8xl md:text-9xl lg:text-[120px] font-black uppercase tracking-tighter leading-[0.88] text-transparent"
              style={{
                WebkitTextStroke: "2px #EFFFFB",
                textStroke: "2px #EFFFFB",
              }}
            >
              EDU
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <footer className="relative z-10 pt-2">
          <div className="w-full h-[1px] bg-white/20 mb-3" />
          <div className="flex items-center justify-between font-mono text-[10px] text-white/60 tracking-wider">
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
