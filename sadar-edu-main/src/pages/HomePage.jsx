import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDown, Menu, X, MapPin } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import logo from '../assets/figma/logo-sadar.svg';
import hero from '../assets/figma/school-hero.png';
import schoolA from '../assets/figma/school-a.png';
import schoolB from '../assets/figma/school-b.png';
import schoolC from '../assets/figma/school-c.png';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);
const perspectives = {
  masyarakat: { title: 'Kenali sebelum memilih.', text: 'Dari lokasi hingga fasilitas, lihat informasi yang membantu Anda mengenal sekolah. Mulai dari lingkungan terdekat, lalu jelajahi pilihan lainnya.', points: ['Temukan sekolah melalui peta', 'Kenali profil dan alamat sekolah', 'Pahami fasilitas dan kondisi yang tersedia'], action: 'Jelajahi sekolah', href: '/peta', image: schoolA },
  pemerintah: { title: 'Lihat kebutuhan wilayah.', text: 'Sebaran sekolah dan informasi kondisinya membantu pemerintah memahami kebutuhan tiap daerah sebagai bahan perencanaan akses pendidikan yang lebih merata.', points: ['Pahami sebaran sekolah antarwilayah', 'Tinjau informasi kondisi dan fasilitas', 'Gunakan data sebagai bahan perencanaan'], action: 'Masuk sebagai pengelola', href: '/login', image: schoolB },
};

export default function HomePage() {
  const root = useRef(null);
  const [audience, setAudience] = useState('masyarakat');
  const [menuOpen, setMenuOpen] = useState(false);
  const perspective = perspectives[audience];
  useEffect(() => {
    const previousTitle = document.title;
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'SADAR EDU — Kenali sekolah di sekitar kita';
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.landing-title span', { yPercent: 105, duration: 0.85, stagger: 0.1, ease: 'power3.out' });
      gsap.from('.landing-hero-photo img', { scale: 1.06, duration: 1.1, ease: 'power2.out' });
      gsap.utils.toArray('[data-reveal]').forEach((element) => gsap.from(element, { y: 24, opacity: 0, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true } }));
      gsap.to('.landing-hero-photo img', { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.landing-hero-photo', start: 'top bottom', end: 'bottom top', scrub: true } });
    }, root);
    media.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
      const lenis = new Lenis({ lerp: 0.12, anchors: true });
      const tick = (time) => lenis.raf(time * 1000);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      return () => { gsap.ticker.remove(tick); lenis.destroy(); };
    });
    return () => {
      media.revert();
      document.title = previousTitle;
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => { if (event.key === 'Escape') { setMenuOpen(false); root.current?.querySelector('.landing-menu-toggle')?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  return <div className="landing" ref={root} id="atas">
    <a className="landing-skip" href="#utama">Langsung ke konten</a>
    <header className="landing-nav">
      <Link to="/" className="landing-brand" aria-label="SADAR EDU beranda"><img src={logo} alt="" /> SADAR EDU</Link>
      <button className="landing-menu-toggle" aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav id="landing-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Navigasi utama" onClick={() => setMenuOpen(false)}><a href="#tentang">Tentang</a><a href="#cara-kerja">Cara kerja</a><a href="#manfaat">Manfaat</a><Link to="/login">Masuk pengelola <ArrowUpRight size={16} aria-hidden="true" /></Link></nav>
    </header>
    <main id="utama">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero-intro"><div className="landing-hero-note"><p>Sekolah yang dekat.<br />Informasi yang lebih jelas.</p><a href="#tentang" aria-label="Pelajari SADAR EDU"><ArrowDown size={22} /></a></div><div>
          <h1 className="landing-title" id="hero-title"><span>Kenali sekolah</span><span>di sekitar kita.</span></h1>
          <div className="landing-hero-actions"><p>SADAR EDU membantu Anda menemukan sekolah melalui peta dan mengenal informasi pentingnya, sebelum menentukan pilihan.</p><Link className="landing-button" to="/peta">Jelajahi sekolah <ArrowUpRight size={20} aria-hidden="true" /></Link></div>
        </div></div>
        <figure className="landing-hero-photo"><img src={hero} alt="Halaman sekolah dengan bangunan kelas dan pepohonan" fetchPriority="high" width="1774" height="887" /><figcaption><MapPin size={17} aria-hidden="true" /> Mengenal lingkungan belajar, mulai dari sekitar kita.</figcaption></figure>
      </section>
      <section className="landing-about landing-section" id="tentang" aria-labelledby="about-title"><div className="landing-side"><h2 id="about-title" data-reveal>Dekat dengan<br />pendidikan.</h2><p data-reveal>Satu platform untuk masyarakat dan perencanaan pendidikan.</p></div><div className="landing-about-content"><p className="landing-statement" data-reveal>Setiap sekolah punya cerita. Setiap wilayah punya kebutuhan. Informasi yang lebih terbuka membantu kita memahami keduanya.</p><p data-reveal>Melalui peta interaktif, SADAR EDU dirancang untuk memudahkan pencarian berdasarkan lokasi, jenjang, dan wilayah. Kenali profil, alamat, fasilitas, serta kondisi sekolah dalam satu tempat.</p><div className="landing-photo-pair"><figure data-reveal><img src={schoolB} alt="Ilustrasi gedung sekolah bertingkat" loading="lazy" width="640" height="480" /><figcaption>Kenali lingkungan sekolah.</figcaption></figure><figure data-reveal><img src={schoolC} alt="Ilustrasi bangunan sekolah dengan halaman hijau" loading="lazy" width="640" height="480" /><figcaption>Pahami kebutuhan di sekitarnya.</figcaption></figure></div></div></section>
      <section className="landing-how landing-section" id="cara-kerja" aria-labelledby="how-title"><div className="landing-side"><h2 id="how-title" data-reveal>Dari peta<br />ke pilihan.</h2><p data-reveal>Mulai dengan lokasi, lanjutkan dengan informasi yang Anda butuhkan.</p><Link className="landing-text-link" to="/peta">Buka peta interaktif</Link></div><ol className="landing-steps"><li data-reveal><h3>Temukan lokasinya.</h3><p>Jelajahi peta untuk melihat lingkungan dan sebaran sekolah di wilayah yang ingin Anda kenal.</p></li><li data-reveal><h3>Kenali sekolahnya.</h3><p>Buka daftar sekolah dan lihat profil, alamat, serta informasi fasilitas dan kondisi yang tersedia.</p></li><li data-reveal><h3>Tentukan langkahnya.</h3><p>Gunakan informasi sebagai bekal pertimbangan. Konfirmasikan detail terbaru langsung kepada sekolah.</p></li></ol></section>
      <section className="landing-benefits landing-section" id="manfaat" aria-labelledby="benefits-title"><div className="landing-benefits-heading"><h2 id="benefits-title" data-reveal>Dua sudut pandang.<br />Satu tujuan.</h2><p data-reveal>Masyarakat lebih mudah mengenal sekolah. Pemerintah lebih memahami kebutuhan pendidikan.</p></div><div className="landing-audience-controls" role="group" aria-label="Pilih sudut pandang"><button aria-pressed={audience === 'masyarakat'} onClick={() => setAudience('masyarakat')}>Untuk masyarakat</button><button aria-pressed={audience === 'pemerintah'} onClick={() => setAudience('pemerintah')}>Untuk pemerintah</button></div><div className="landing-audience"><figure><img src={perspective.image} alt={`Ilustrasi sekolah untuk perspektif ${audience}`} loading="lazy" width="640" height="480" /><figcaption>Foto ilustrasi sekolah</figcaption></figure><div className="landing-audience-copy" aria-live="polite"><h3>{perspective.title}</h3><p>{perspective.text}</p><ul>{perspective.points.map((point) => <li key={point}>{point}</li>)}</ul><Link className="landing-button" to={perspective.href}>{perspective.action}</Link></div></div></section>
      <section className="landing-faq landing-section" aria-labelledby="faq-title"><div className="landing-side"><h2 id="faq-title" data-reveal>Sebelum menjelajah.</h2></div><div className="landing-faq-copy"><div data-reveal><h3>Perlu masuk untuk melihat peta?</h3><p>Tidak. Masyarakat dapat membuka peta dan menjelajahi informasi sekolah tanpa masuk sebagai pengelola.</p></div><div data-reveal><h3>Apakah datanya sudah resmi?</h3><p>Saat ini SADAR EDU masih dalam tahap pratinjau dengan data dan foto ilustrasi. Dataset resmi belum terhubung; informasi contoh bukan dasar keputusan pendaftaran atau kebijakan.</p></div><div data-reveal><h3>Apakah bisa mendaftar sekolah?</h3><p>SADAR EDU membantu pencarian informasi, bukan layanan pendaftaran. Persyaratan dan proses penerimaan perlu dikonfirmasi kepada sekolah atau dinas terkait.</p></div><div data-reveal><h3>Bagaimana dengan pemerataan?</h3><p>Informasi sebaran, fasilitas, dan kondisi sekolah dapat menjadi bahan untuk memahami kebutuhan daerah. Perencanaan tetap memerlukan data tervalidasi dan kajian lebih lanjut.</p></div></div></section>
      <section className="landing-close" aria-labelledby="close-title"><h2 id="close-title" data-reveal>Mulai dari<br />sekitar kita.</h2><div><p data-reveal>Kenali sekolah hari ini.<br />Buka peluang pendidikan yang lebih baik.</p><Link className="landing-button landing-button-light" to="/peta">Jelajahi sekolah <ArrowUpRight size={20} aria-hidden="true" /></Link></div></section>
    </main>
    <footer className="landing-footer"><Link className="landing-brand" to="/"><img src={logo} alt="" />SADAR EDU</Link><p>Menemukan sekolah. Memahami kebutuhan pendidikan.</p><a href="#atas">Kembali ke atas ↑</a><small>Pratinjau produk · Foto ilustrasi dari aset desain SADAR EDU.</small></footer>
  </div>;
}
