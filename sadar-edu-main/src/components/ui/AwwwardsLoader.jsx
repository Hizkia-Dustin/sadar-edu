import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import logo from "../../assets/figma/logo-sadar.svg";
import logoMotionVideo from "../../assets/gemini_generated_video_c4757b19.mp4";

/**
 * AwwwardsLoader - Single Unified Transition & Preloader Component for SADAR EDU
 *
 * Used repeatedly across initial load, page refreshes, and route navigation.
 *
 * FEATURES:
 * 1. Curtain Drop Entrance: Teal curtain smoothly drops down (-100% -> 0%) covering the screen first.
 * 2. Floating 3D Masked Text: Elegant, non-overlapping narrative floating lines in Sadar Mint & White.
 * 3. Transparent Video Logo Motion: Real-time Canvas Chromakey (zero white box), 2.4x accelerated speed.
 * 4. Solid Calibration Bar: Pinned in absolute center, zero left-right shifting.
 * 5. Buttery Smooth Curtain Lift: Seamlessly lifts away (-100%) to reveal the destination page.
 */
export default function AwwwardsLoader({ onComplete, isRouteTransition = false }) {
  const containerRef = useRef(null);
  const percentRef = useRef(null);
  const progressBarRef = useRef(null);
  const statusRef = useRef(null);
  const coordsRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const isVideoRenderingRef = useRef(false);

  // Real-time Canvas Chromakey for Logo Motion Video (Removes white background frame-by-frame)
  useEffect(() => {
    let animId;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const renderFrame = () => {
      if (isVideoRenderingRef.current && video.readyState >= 2 && !video.paused) {
        const sw = 860;
        const sh = 620;
        const sx = 210;
        const sy = 80;

        const cw = canvas.width;
        const ch = canvas.height;

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

        const frameData = ctx.getImageData(0, 0, cw, ch);
        const data = frameData.data;
        const len = data.length;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (lum >= 225) {
            data[i + 3] = 0; // Transparent
          } else if (lum > 190) {
            data[i + 3] = Math.round(((225 - lum) / 35) * 255);
          }
        }

        ctx.putImageData(frameData, 0, 0);
      }
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  useEffect(() => {
    // 1. Lock scroll cleanly while active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Direct DOM mutation for telemetry (Zero React re-render overhead)
    const coordsList = [
      "LAT -6.5971° S, LON 106.8060° E",
      "LAT -6.5892° S, LON 106.7912° E",
      "LAT -6.6044° S, LON 106.8125° E",
      "LAT -6.5780° S, LON 106.7788° E",
      "LAT -6.5944° S, LON 106.7996° E",
    ];
    const tagsList = [
      "[SINKRONISASI PETA SPASIAL...]",
      "[MEMUAT JARINGAN SEKOLAH BOGOR...]",
      "[KALIBRASI KEBUTUHAN PENDIDIKAN...]",
      "[OPTIMASI JALUR AKSESIBILITAS...]",
      "[SISTEM SIAP DITAMPILKAN...]",
    ];

    let step = 0;
    const telemetryInterval = setInterval(() => {
      step = (step + 1) % coordsList.length;
      if (coordsRef.current) coordsRef.current.textContent = coordsList[step];
      if (statusRef.current) statusRef.current.textContent = tagsList[step];
    }, 420);

    // 3. GSAP Master Timeline
    const container = containerRef.current;
    const ctx = gsap.context(() => {
      const counterObj = { val: 0 };

      // Initial States: Curtain begins above (-100%) to smoothly drop and cover the screen
      gsap.set(".seamless-canvas", { yPercent: -100 });
      gsap.set(".frame-hud-top", { opacity: 0, y: -15 });
      gsap.set(".frame-hud-bottom", { opacity: 0, y: 15 });

      gsap.set(".beat-container", { perspective: 800 });
      gsap.set(".beat-1", { display: "flex", opacity: 0 });
      gsap.set(".beat-2", { display: "none", opacity: 0 });
      gsap.set(".beat-3", { display: "none", opacity: 0 });
      gsap.set(".brand-stage", { display: "none", opacity: 0 });

      // Float lines: masked down with slight tilt
      gsap.set(".beat-1 .float-line", { yPercent: 120, rotateX: -15, opacity: 0 });
      gsap.set(".beat-2 .float-line", { yPercent: 120, rotateX: -15, opacity: 0 });
      gsap.set(".beat-3 .float-line", { yPercent: 120, rotateX: -15, opacity: 0 });
      gsap.set(".brand-char", { yPercent: 110, rotateX: -20, opacity: 0 });
      gsap.set(".transparent-logo-canvas", { scale: 0.8, opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () => {
          clearInterval(telemetryInterval);
          isVideoRenderingRef.current = false;
          document.body.style.overflow = originalOverflow;
          if (container) container.style.display = "none";
          if (onComplete) onComplete();
        },
      });
      timelineRef.current = tl;

      // ========================================================
      // ENTRANCE: TIRAI MENUTUP LAYAR TERLEBIH DAHULU (SMOOTH & LOGICAL)
      // ========================================================
      tl.to(".seamless-canvas", {
        yPercent: 0,
        duration: 0.65,
        ease: "expo.out",
      }, 0);

      tl.to([".frame-hud-top", ".frame-hud-bottom"], {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power2.out",
      }, 0.35);

      const startFloat = (target) => {
        return gsap.to(target, {
          y: "-=6",
          duration: 1.5,
          repeat: 1,
          yoyo: true,
          ease: "sine.inOut",
        });
      };

      // ========================================================
      // FASE 1: UNTUK MASYARAKAT (0% -> 35%)
      // ========================================================
      const t1 = 0.55;

      tl.to(counterObj, {
        val: 35,
        duration: 1.25,
        ease: "power2.out",
        onUpdate: () => {
          const val = Math.floor(counterObj.val);
          if (percentRef.current) percentRef.current.textContent = String(val).padStart(3, "0");
          if (progressBarRef.current) progressBarRef.current.style.width = `${val}%`;
        },
      }, t1);

      tl.to(".beat-1", { opacity: 1, duration: 0.1 }, t1);

      tl.to(".beat-1 .float-line", {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.09,
        ease: "power4.out",
      }, t1 + 0.1);

      tl.add(() => startFloat(".beat-1 .stage-card"), t1 + 0.4);

      tl.to(".beat-1 .float-line", {
        yPercent: -120,
        rotateX: 15,
        opacity: 0,
        duration: 0.48,
        stagger: 0.04,
        ease: "power3.in",
      }, t1 + 1.35);

      tl.set(".beat-1", { display: "none" }, t1 + 1.8);

      // ========================================================
      // FASE 2: UNTUK PEMERINTAH (35% -> 75%)
      // ========================================================
      const t2 = t1 + 1.8;
      tl.set(".beat-2", { display: "flex" }, t2);

      tl.to(counterObj, {
        val: 75,
        duration: 1.25,
        ease: "power2.inOut",
        onUpdate: () => {
          const val = Math.floor(counterObj.val);
          if (percentRef.current) percentRef.current.textContent = String(val).padStart(3, "0");
          if (progressBarRef.current) progressBarRef.current.style.width = `${val}%`;
        },
      }, t2);

      tl.to(".beat-2", { opacity: 1, duration: 0.1 }, t2);

      tl.to(".beat-2 .float-line", {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.09,
        ease: "power4.out",
      }, t2 + 0.05);

      tl.add(() => startFloat(".beat-2 .stage-card"), t2 + 0.35);

      tl.to(".beat-2 .float-line", {
        yPercent: -120,
        rotateX: 15,
        opacity: 0,
        duration: 0.48,
        stagger: 0.04,
        ease: "power3.in",
      }, t2 + 1.35);

      tl.set(".beat-2", { display: "none" }, t2 + 1.8);

      // ========================================================
      // FASE 3: SATU TUJUAN & BRAND LOCKUP (75% -> 100%)
      // ========================================================
      const t3 = t2 + 1.8;
      tl.set(".beat-3", { display: "flex" }, t3);

      tl.to(counterObj, {
        val: 100,
        duration: 1.05,
        ease: "power3.out",
        onUpdate: () => {
          const val = Math.floor(counterObj.val);
          if (percentRef.current) percentRef.current.textContent = String(val).padStart(3, "0");
          if (progressBarRef.current) progressBarRef.current.style.width = `${val}%`;
        },
      }, t3);

      tl.to(".beat-3", { opacity: 1, duration: 0.1 }, t3);

      tl.to(".beat-3 .float-line", {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.08,
        ease: "power4.out",
      }, t3 + 0.05);

      tl.to(".beat-3 .float-line", {
        yPercent: -120,
        opacity: 0,
        duration: 0.4,
        stagger: 0.03,
        ease: "power3.in",
      }, t3 + 1.05);

      tl.set(".beat-3", { display: "none" }, t3 + 1.35);

      // Trigger video play right before reveal with accelerated speed (2.4x)
      const tBrand = t3 + 1.35;
      tl.add(() => {
        isVideoRenderingRef.current = true;
        if (videoRef.current) {
          videoRef.current.currentTime = 0.2;
          videoRef.current.playbackRate = 2.4;
          videoRef.current.play().catch(() => {});
        }
      }, tBrand - 0.1);

      // Brand Stage Mounts
      tl.set(".brand-stage", { display: "flex" }, tBrand);
      tl.to(".brand-stage", { opacity: 1, duration: 0.1 }, tBrand);

      // Transparent Canvas Scales in smoothly
      tl.to(".transparent-logo-canvas", {
        scale: 1,
        opacity: 1,
        duration: 0.55,
        ease: "back.out(1.1)",
      }, tBrand + 0.05);

      // Brand Typography rises up alongside video
      tl.to(".brand-char", {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 0.65,
        stagger: 0.06,
        ease: "power4.out",
      }, tBrand + 0.2);

      // ========================================================
      // EXIT TRANSITION: SEAMLESS BUTTERY CURTAIN LIFT
      // ========================================================
      const tExit = tBrand + 1.45;

      tl.to([".frame-hud-top", ".frame-hud-bottom"], {
        opacity: 0,
        duration: 0.35,
        ease: "power2.out",
      }, tExit);

      tl.to(".transparent-logo-canvas", {
        scale: 1.1,
        opacity: 0,
        duration: 0.7,
        ease: "power3.inOut",
      }, tExit + 0.1);

      tl.to(".brand-char-sadar", {
        x: -45,
        opacity: 0,
        duration: 0.75,
        ease: "power3.inOut",
      }, tExit + 0.1);

      tl.to(".brand-char-edu", {
        x: 45,
        opacity: 0,
        duration: 0.75,
        ease: "power3.inOut",
      }, tExit + 0.1);

      // Canvas lifts away smoothly to uncover destination page
      tl.to(".seamless-canvas", {
        yPercent: -100,
        duration: 0.95,
        ease: "expo.inOut",
      }, tExit + 0.1);

    }, container);

    return () => {
      clearInterval(telemetryInterval);
      isVideoRenderingRef.current = false;
      document.body.style.overflow = originalOverflow;
      ctx.revert();
    };
  }, [onComplete]);

  // Skip Intro
  const handleSkip = () => {
    if (timelineRef.current) {
      timelineRef.current.seek(5.5);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] pointer-events-auto select-none overflow-hidden font-sans bg-transparent"
    >
      {/* Hidden Source Video for Frame Extraction */}
      <video
        ref={videoRef}
        src={logoMotionVideo}
        muted
        playsInline
        preload="auto"
        className="hidden"
      />

      {/* ================= SEAMLESS UNIFIED FULL CANVAS ================= */}
      <div className="seamless-canvas absolute inset-0 w-full h-full bg-[#1F6F5F] flex flex-col justify-between p-6 sm:p-12 text-[#F8FAFC]">

        {/* ================= TOP HUD ================= */}
        <header className="frame-hud-top relative z-30 flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#144238] border border-[#2FA084] flex items-center justify-center p-1.5">
              <img
                src={logo}
                alt="SADAR EDU"
                className="w-full h-full object-contain filter brightness-200"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-widest text-white uppercase">
                  SADAR EDU
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#144238] text-[#6FCF97] border border-[#2FA084]">
                  KOTA BOGOR
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#6FCF97] tracking-wider block mt-0.5">
                SISTEM INFORMASI GEOGRAFIS PENDIDIKAN
              </span>
            </div>
          </div>

          {/* Clean Skip Button */}
          <button
            onClick={handleSkip}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-white/20 bg-[#144238] hover:bg-[#1A5447] text-xs font-mono text-white transition-colors cursor-pointer"
            title="Lewati Intro"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#6FCF97]" />
            <span className="font-semibold tracking-wider">LEWATI INTRO</span>
          </button>
        </header>

        {/* ================= CENTER NARRATIVE CONTAINER ================= */}
        <main className="beat-container relative z-30 flex-1 flex items-center justify-center px-4">
          <div className="relative w-full max-w-4xl min-h-[220px] sm:min-h-[260px] flex items-center justify-center text-center">

            {/* BEAT 1: PERSPEKTIF MASYARAKAT */}
            <div className="beat-1 stage-card absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xl sm:text-3xl md:text-4xl font-medium leading-[1.35] sm:leading-[1.4] text-white max-w-3xl space-y-1">
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom">
                    Membantu masyarakat menemukan
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom text-[#6FCF97]">
                    dan mengenal sekolah di sekitarnya,
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom text-white/80">
                    dari lokasi, profil, hingga kondisi fasilitas.
                  </span>
                </div>
              </div>
            </div>

            {/* BEAT 2: PERSPEKTIF PEMERINTAH */}
            <div className="beat-2 stage-card absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xl sm:text-3xl md:text-4xl font-medium leading-[1.35] sm:leading-[1.4] text-white max-w-3xl space-y-1">
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom">
                    Membantu pemerintah memahami
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom text-[#6FCF97]">
                    kebutuhan pendidikan setiap daerah,
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom text-white/80">
                    untuk perencanaan akses yang lebih merata.
                  </span>
                </div>
              </div>
            </div>

            {/* BEAT 3: SATU TUJUAN */}
            <div className="beat-3 stage-card absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white space-y-2">
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom">
                    Menemukan sekolah lebih mudah.
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="float-line inline-block origin-bottom text-[#6FCF97]">
                    Merencanakan pendidikan lebih merata.
                  </span>
                </div>
              </div>
            </div>

            {/* BRAND HERO SPOTLIGHT + 100% TRANSPARENT LOGO CANVAS */}
            <div className="brand-stage absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* Dynamic Chromakey Canvas: 100% Alpha Transparan, ZERO White Box */}
              <canvas
                ref={canvasRef}
                width={280}
                height={202}
                className="transparent-logo-canvas w-28 h-20 sm:w-40 sm:h-28 mb-3 sm:mb-4 object-contain pointer-events-none"
              />

              {/* Typography */}
              <div className="flex items-center gap-4 sm:gap-7 overflow-hidden">
                <div className="overflow-hidden">
                  <span className="brand-char brand-char-sadar inline-block text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-white uppercase origin-bottom">
                    SADAR
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="brand-char brand-char-edu inline-block text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-[#6FCF97] uppercase origin-bottom">
                    EDU
                  </span>
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* ================= BOTTOM HUD ================= */}
        <footer className="frame-hud-bottom relative z-30 flex items-end justify-between pt-6 border-t border-white/10 font-mono">
          {/* Left: Telemetry Data (Fixed Width) */}
          <div className="w-[300px] flex flex-col gap-1 text-[11px] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6FCF97] inline-block shrink-0" />
              <span ref={statusRef} className="text-white font-medium truncate">
                [SINKRONISASI PETA SPASIAL...]
              </span>
            </div>
            <span ref={coordsRef} className="text-[10px] text-white/60 tracking-wider font-mono">
              LAT -6.5971° S, LON 106.8060° E
            </span>
          </div>

          {/* Center: Absolute Fixed Centered Progress Line */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 hidden md:flex flex-col items-center gap-1.5 pointer-events-none">
            <span className="text-[9px] uppercase tracking-widest text-[#6FCF97] font-bold">
              KALIBRASI DATA
            </span>
            <div className="w-48 h-1 bg-[#144238] rounded-full overflow-hidden border border-white/10">
              <div
                ref={progressBarRef}
                className="h-full bg-[#6FCF97]"
                style={{ width: "0%" }}
              />
            </div>
          </div>

          {/* Right: Architectural Monospace Percent (Fixed Width) */}
          <div className="w-[140px] flex items-baseline justify-end gap-1 text-right shrink-0">
            <span
              ref={percentRef}
              className="text-4xl sm:text-6xl font-bold tracking-tight text-white tabular-nums font-mono"
            >
              000
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#6FCF97] font-mono">
              %
            </span>
          </div>
        </footer>

      </div>
    </div>
  );
}
