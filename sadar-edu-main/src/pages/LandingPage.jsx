import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

// --- CUSTOM SVG ICONS (MINIMALIS EDITORIAL) ---
const MapPinIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const CompassIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

// --- DATA LOKASI BOGOR ---
const BOGOR_PINS = [
  { id: 'smpn1', name: 'SMPN 1 Kota Bogor', sector: 'Bogor Tengah', lat: '6.5932° S', long: '106.7932° E', top: '28%', left: '42%', elevation: '260m', desc: 'Konsentrasi fokal zonasi pendidikan SMP pusat kota.' },
  { id: 'smpn2', name: 'SMPN 2 Kota Bogor', sector: 'Bogor Utara', lat: '6.5710° S', long: '106.8120° E', top: '38%', left: '58%', elevation: '280m', desc: 'Analisis jangkauan angkutan & aksesibilitas SMP Bantarjati.' },
  { id: 'blankspot', name: 'Rekomendasi Tapak SMP Baru', sector: 'Bogor Selatan', lat: '6.6210° S', long: '106.8120° E', top: '62%', left: '50%', elevation: '340m', desc: 'Kawasan prioritas penambahan fasilitas SMP negeri/swasta.' },
  { id: 'bogorbarat', name: 'Koridor SMP Bogor Barat', sector: 'Bogor Barat', lat: '6.5780° S', long: '106.7510° E', top: '42%', left: '26%', elevation: '210m', desc: 'Evaluasi aksesibilitas jenjang SMP wilayah perbatasan.' }
];

export default function LandingPage() {
  const containerRef = useRef(null);
  const [activePin, setActivePin] = useState(BOGOR_PINS[0]);
  const [bufferRadius, setBufferRadius] = useState(2.0);

  // MOUSE TILT INTERACTIVE CAMERA EFFECT
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e) => {
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 15;
    const y = (e.clientY / innerHeight - 0.5) * 15;
    setMousePos({ x, y });
  };

  // PARALLAX SCROLL SETUP
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const mapY = useTransform(smoothProgress, [0, 1], ["0%", "25%"]);
  const heroTextY = useTransform(smoothProgress, [0, 0.4], ["0%", "30%"]);

  return (
    <div 
      ref={containerRef} 
      onMouseMove={handleMouseMove}
      className="relative min-h-screen bg-[#F3EFE6] text-[#111A16] font-sans selection:bg-[#2C4234] selection:text-[#F3EFE6] overflow-x-hidden"
    >
      
      {/* SCROLL PROGRESS BAR */}
      <motion.div 
        style={{ scaleX: smoothProgress }}
        className="fixed top-0 left-0 right-0 h-1 bg-[#2C4234] z-50 origin-left"
      />

      {/* =========================================================
          BACKGROUND ARTISTIK KONTUR TOPOGRAFI
          ========================================================= */}
      <motion.div 
        style={{ 
          y: mapY,
          x: mousePos.x * 0.4,
        }}
        className="fixed inset-0 z-0 opacity-25 pointer-events-auto transition-transform duration-100 ease-out"
      >
        <div className="w-full h-[180vh] relative flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full text-[#2C4234]" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1000 1000">
            <path d="M0,100 C250,50 500,150 1000,80 L1000,0 L0,0 Z" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
            <path d="M0,250 C300,200 700,300 1000,220" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M0,400 C200,350 600,450 1000,380" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M0,550 C400,500 650,600 1000,520" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M0,700 C300,650 800,750 1000,680" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M0,850 C200,800 600,900 1000,820" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="500" cy="500" rx="400" ry="250" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            <ellipse cx="500" cy="500" rx="300" ry="180" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="500" cy="500" rx="200" ry="110" fill="none" stroke="currentColor" strokeWidth="1" />
            <ellipse cx="500" cy="500" rx="100" ry="50" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-b from-[#F3EFE6]/50 via-[#F3EFE6]/90 to-[#F3EFE6]" />
        </div>
      </motion.div>


      {/* =========================================================
          1. HERO SECTION (MAGAZINE EDITORIAL STYLE)
          ========================================================= */}
      <section className="relative w-full h-screen flex flex-col justify-between z-10">
        
        {/* Giant Background Title */}
        <motion.div 
          style={{ y: heroTextY }}
          className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-0 pointer-events-none"
        >
          <h1 className="text-[18vw] md:text-[22vw] font-serif text-[#111A16]/5 leading-none tracking-tighter">
            BOGOR
          </h1>
        </motion.div>

        {/* Top Navbar & Actions */}
        <div className="relative z-30 w-full flex items-center justify-between px-6 md:px-12 pt-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-full bg-[#111A16] flex items-center justify-center text-[#F3EFE6] font-serif font-bold text-sm shadow">
              S
            </Link>
            <span className="text-[9px] tracking-[0.2em] text-[#2C4234] uppercase font-bold hidden sm:inline">
              ABOUT SADAR EDU ........
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 border border-[#2C4234]/20 rounded-full px-6 py-2 bg-[#F3EFE6]/80 backdrop-blur-md text-xs text-[#2C4234] font-medium">
            <a href="#laporan" className="hover:text-[#111A16] transition-colors">Laporan</a>
            <a href="#simulasi" className="hover:text-[#111A16] transition-colors">Simulasi MCDA</a>
            <a href="#sektor" className="hover:text-[#111A16] transition-colors">Sektor</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-xs font-bold text-[#2C4234] hover:text-[#111A16] px-3 py-1.5">
              Masuk
            </Link>
            <Link 
              to="/peta" 
              className="px-5 py-2 bg-[#111A16] text-[#F3EFE6] rounded-full font-bold text-xs tracking-wide hover:bg-[#2C4234] transition-all shadow-md"
            >
              Buka Peta Live
            </Link>
          </div>
        </div>

        {/* Interactive Tilt Visual Container (Menggunakan Pola Grid GIS Vektor Bersih Tanpa API Key) */}
        <motion.div 
          style={{
            rotateX: mousePos.y * -0.2,
            rotateY: mousePos.x * 0.2,
          }}
          className="relative z-20 flex-1 flex items-center justify-center pointer-events-none px-6"
        >
          <div className="relative max-w-2xl w-full aspect-[16/9] rounded-2xl overflow-hidden  shadow-2xl bg-[#ebe5d815] pointer-events-auto">
            
            {/* Latar Belakang Pola Garis Grid Geospasial Minimalis */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#2C4234_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Garis-garis Koridor Tiruan Peta Vektor */}
            <svg className="absolute inset-0 w-full h-full text-[#2C4234]/20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 100 Q 200 50, 400 200 T 800 100" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M100 0 Q 300 200, 200 400 T 500 300" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>

            {/* Dynamic Buffer Circle Sesuai Pin Aktif */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#2C4234] bg-[#2C4234]/10 pointer-events-none transition-all duration-500 z-10"
              style={{
                top: activePin.top,
                left: activePin.left,
                width: `${bufferRadius * 70}px`,
                height: `${bufferRadius * 70}px`,
              }}
            />

            {/* Render Pins dari BOGOR_PINS */}
            {BOGOR_PINS.map((pin) => {
              const isSelected = activePin.id === pin.id;
              return (
                <div
                  key={pin.id}
                  style={{ top: pin.top, left: pin.left }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  onClick={() => setActivePin(pin)}
                >
                  <div className={`w-7 h-7 rounded-full transition-all flex items-center justify-center shadow-lg ${
                    isSelected ? 'bg-[#111A16] text-[#F3EFE6] scale-125 ring-2 ring-white' : 'bg-[#2C4234] text-[#F3EFE6] hover:scale-110'
                  }`}>
                    <MapPinIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-[#111A16] text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap shadow z-30">
                    {pin.name}
                  </div>
                </div>
              );
            })}

            <div className="absolute inset-0 bg-gradient-to-t from-[#111A16]/80 via-transparent to-transparent pointer-events-none" />
            
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end text-white z-20 pointer-events-none">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#A3B899]">Kawasan Aktif:</span>
                <h3 className="text-2xl font-serif text-[#F3EFE6]">{activePin.name}</h3>
                <p className="text-[10px] text-[#F3EFE6]/80 mt-0.5">{activePin.desc}</p>
              </div>
              <div className="bg-[#111A16]/90 border border-[#A3B899]/30 px-3 py-1.5 rounded-lg text-xs text-[#F3EFE6] shrink-0">
                {activePin.elevation} dpl
              </div>
            </div>

          </div>
        </motion.div>

        {/* Bottom Menu Navigation */}
        <div className="relative z-20 w-full flex justify-between px-8 md:px-24 pb-6 text-[#2C4234] text-xs tracking-[0.4em] font-bold uppercase">
          <span>M E N U</span>
          <span>P E T A</span>
          <span>L I S T</span>
        </div>

      </section>


      {/* =========================================================
          2. MAIN CONTENT SECTION
          ========================================================= */}
      <section id="laporan" className="relative z-20 bg-[#f3efe666] text-[#111A16] py-24 px-6 md:px-16 border-t border-[#2C4234]/20 shadow-inner">
        
        <div className="max-w-6xl mx-auto">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#2C4234]/20 pb-6 mb-12 gap-4">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight uppercase">
              Akses Pendidikan Bogor
            </h2>
            
            <div className="flex items-center gap-3">
              <div className="text-[9px] uppercase tracking-widest text-[#2C4234] border border-[#2C4234] px-3 py-1 text-right font-bold">
                Zonasi<br/>Wilayah
              </div>
              <div className="flex gap-1">
                <div className="bg-[#2C4234] text-[#F3EFE6] text-2xl font-bold px-4 py-2 rounded">04</div>
                <div className="bg-[#2C4234] text-[#F3EFE6] text-2xl font-bold px-4 py-2 rounded">3D</div>
              </div>
            </div>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <p className="text-sm md:text-base font-medium leading-relaxed">
                Analisis geospasial mendalam untuk memetakan kesenjangan fasilitas sekolah negeri di berbagai kecamatan di Bogor.
              </p>
              
              <ul className="text-xs md:text-sm font-bold space-y-2 list-disc pl-4 text-[#2C4234]">
                <li>Validasi Batas Vektor GeoJSON</li>
                <li>Simulasi Radius Buffer 2.0 KM</li>
                <li>Analisis Kelerengan dan Topografi</li>
              </ul>

              <div className="pt-4 flex gap-4">
                <Link 
                  to="/peta" 
                  className="px-6 py-3 bg-[#111A16] text-[#F3EFE6] rounded-full font-bold text-xs hover:bg-[#2C4234] transition-all shadow-md"
                >
                  Buka Peta Interaktif
                </Link>
                <a 
                  href="#simulasi" 
                  className="px-6 py-3 border border-[#111A16]/30 text-[#111A16] rounded-full font-bold text-xs hover:bg-[#111A16]/5 transition-colors"
                >
                  Pelajari MCDA
                </a>
              </div>
            </div>

            {/* BUFFER CONTROL CARD */}
            <div id="simulasi" className="bg-white text-[#111A16] p-8 rounded-3xl shadow-xl border border-[#2C4234]/20 space-y-6">
              <div className="flex justify-between items-center border-b border-[#2C4234]/10 pb-4">
                <span className="text-xs uppercase tracking-widest text-[#2C4234] font-bold flex items-center gap-2">
                  <CompassIcon className="w-4 h-4 text-[#2C4234]" />
                  Kontrol Simulasi Buffer
                </span>
                <span className="text-[#2C4234] text-xs font-bold px-3 py-1 bg-[#F3EFE6] rounded-full">{bufferRadius.toFixed(1)} KM</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#111A16]">Atur Radius Jangkauan Sekolah:</label>
                <input 
                  type="range" 
                  min="1.0" 
                  max="3.0" 
                  step="0.1" 
                  value={bufferRadius}
                  onChange={(e) => setBufferRadius(parseFloat(e.target.value))}
                  className="w-full accent-[#2C4234] bg-[#F3EFE6] h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#2C4234]/10 text-xs">
                <div>
                  <span className="text-[#2C4234]/70 block font-medium">Kecamatan Aktif</span>
                  <span className="font-bold text-sm text-[#111A16]">{activePin.sector}</span>
                </div>
                <div>
                  <span className="text-[#2C4234]/70 block font-medium">Elevasi Tapak</span>
                  <span className="font-bold text-sm text-[#111A16]">{activePin.elevation}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Sektor Cards */}
          <div id="sektor" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {BOGOR_PINS.slice(0, 3).map((item, idx) => (
              <div 
                key={idx}
                onClick={() => setActivePin(item)}
                className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                  activePin.id === item.id ? 'bg-[#2C4234] text-[#F3EFE6] border-[#2C4234]' : 'bg-white text-[#111A16] border-[#2C4234]/20 hover:border-[#2C4234]'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest opacity-70 mb-2">SEKTOR 0{idx + 1}</div>
                <h4 className="text-lg font-serif font-bold mb-1">{item.name}</h4>
                <p className="text-xs opacity-80 font-light">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Footer Ornaments */}
          <div className="mt-20 pt-8 border-t border-[#2C4234]/20 flex justify-center items-center gap-4 text-[#2C4234]">
            <div className="w-16 h-[1px] bg-[#2C4234]"></div>
            <div className="w-3 h-3 rotate-45 bg-[#2C4234]"></div>
            <span className="text-xs font-bold tracking-widest uppercase">SadarEdu Bogor</span>
            <div className="w-3 h-3 rotate-45 bg-[#2C4234]"></div>
            <div className="w-16 h-[1px] bg-[#2C4234]"></div>
          </div>

        </div>

      </section>

    </div>
  );
}   