import { memo, useEffect, useMemo, useState } from 'react';
import FilterSidebar from '../../components/ui/FilterSidebar';
import SchoolList from '../../components/ui/SchoolList';
import SlidePanel from '../../components/ui/SlidePanel';
import logo from '../../assets/figma/logo-sadar.svg';
import MapCanvas from '../../components/map/MapCanvas';
import searchIcon from '../../assets/figma/icon-search.svg';
import emptySearchIcon from '../../assets/figma/icon-search-empty.svg';
import mapIcon from '../../assets/figma/icon-map.svg';
import errorIcon from '../../assets/figma/icon-error.svg';
import infoIcon from '../../assets/figma/icon-info.svg';
import shieldIcon from '../../assets/figma/icon-shield.svg';
import warningIcon from '../../assets/figma/icon-warning.svg';
import schoolHero from '../../assets/figma/school-hero.png';

const forcedState = new URLSearchParams(window.location.search).get('state');
const supportedStates = new Set(['loading', 'data-error', 'map-error']);

function Header() {
  return (
    <header className="explorer-header">
      <img src={logo} alt="" />
      <strong>SADAR EDU</strong>
      <nav aria-label="Navigasi utama">
        <a href="/peta" className="active">Jelajahi sekolah</a>
        <a href="#tentang-data">Tentang data</a>
        <span>Pratinjau desain</span>
      </nav>
    </header>
  );
}

function SearchField({ value, onChange, resultText }) {
  return (
    <div className="explorer-search-wrap">
      <img src={searchIcon} alt="" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cari nama sekolah atau NPSN"
        aria-label="Cari nama sekolah atau NPSN"
      />
      <span className="sr-only" aria-live="polite">{resultText}</span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="explorer-footer">
      <strong>PRATINJAU • Dataset belum terhubung</strong>
      <span>Sumber / periode belum tersedia</span>
    </footer>
  );
}

const MapPreview = memo(function MapPreview() {
  return (
    <div className="explorer-map">
      <MapCanvas />
      <div className="map-context"><img src={mapIcon} alt="" />Peta Bogor • Data sekolah contoh</div>
      <div className="map-legend">
        <strong>Legenda peta</strong>
        <p style={{ color: '#1f6f5f' }}>●&nbsp;&nbsp;Sekolah negeri</p>
        <p style={{ color: '#b45309' }}>●&nbsp;&nbsp;Sekolah swasta</p>
        <p>Titik dan wilayah memakai data contoh.</p>
      </div>
    </div>
  );
});

function EmptyResults({ onReset }) {
  return (
    <section className="empty-results" aria-live="polite">
      <img src={emptySearchIcon} alt="" />
      <h2>Tidak ada sekolah yang cocok</h2>
      <p>Coba kata pencarian lain atau kurangi filter yang aktif.</p>
      <p>0 hasil • 0 terpetakan • 0 tanpa titik</p>
      <button onClick={onReset}>Hapus semua filter</button>
    </section>
  );
}

function LoadingWorkspace() {
  return (
    <>
      <main className="loading-map">
        <div className="loading-notice"><h2>Menyiapkan data sekolah…</h2><p>Daftar dan peta akan muncul setelah data siap.</p></div>
      </main>
      <aside className="skeleton-list" aria-label="Daftar sekolah sedang dimuat">
        {[0, 1, 2, 3].map((item) => <div className="skeleton-row" key={item}><i /><i /><i /></div>)}
      </aside>
    </>
  );
}

function DataError({ onRetry }) {
  return (
    <main className="data-error-area">
      <section className="data-error-card" role="alert">
        <img src={errorIcon} alt="" />
        <h2>Data sekolah gagal dimuat</h2>
        <p>Koneksi ke dataset belum berhasil. Periksa koneksi internet, lalu coba lagi.</p>
        <button onClick={onRetry}>Coba lagi</button>
        <p>Angka hasil belum dapat dihitung.</p>
      </section>
    </main>
  );
}

function MapError({ onRetry, onDetail }) {
  return (
    <>
      <main className="map-error-area">
        <section className="map-error-card" role="alert">
          <img src={mapIcon} alt="" />
          <h2>Peta dasar belum tersedia</h2>
          <p>Daftar sekolah tetap dapat digunakan. Kamu masih bisa mencari dan membuka detail sekolah.</p>
          <button onClick={onRetry}>Muat ulang peta</button>
        </section>
      </main>
      <aside className="map-error-list"><SchoolList onDetail={onDetail} /></aside>
    </>
  );
}

function DetailPage({ onBack }) {
  const metrics = ['Peserta didik', 'Guru', 'Ruang kelas', 'Akreditasi'];
  const facts = ['NPSN', 'Jenjang', 'Status', 'Sumber / periode'];
  return (
    <div className="school-detail-page">
      <Header />
      <main className="detail-main">
        <div className="detail-breadcrumb"><button onClick={onBack}>Jelajahi sekolah</button><span>/</span><span>Detail sekolah</span><b><i />PERLU VERIFIKASI</b></div>
        <div className="detail-gallery"><img src={schoolHero} alt="Ilustrasi gedung sekolah" /><div><img src={schoolHero} alt="" /><img src={schoolHero} alt="" /></div></div>
        <p className="detail-disclosure"><img src={infoIcon} alt="" />Ilustrasi pratinjau desain • bukan foto sekolah</p>
        <div className="detail-content">
          <section className="school-story">
            <div className="school-title"><div><h1>Contoh sekolah A</h1><p>Wilayah belum tersedia</p></div><b><i />DATA BELUM LENGKAP</b></div>
            <hr />
            <h2>Tentang sekolah</h2>
            <p>Informasi profil belum terhubung ke dataset terverifikasi. Identitas, lokasi, dan statistik akan tampil setelah sumber serta periodenya dikonfirmasi.</p>
            <div className="detail-metrics">{metrics.map((metric) => <div key={metric}><strong>—</strong><small>{metric}</small></div>)}</div>
            <div className="interpretation-note"><img src={shieldIcon} alt="" /><span>Data kosong ditampilkan sebagai — dan tidak dianggap bernilai nol.</span></div>
          </section>
          <aside className="school-info">
            <h2>Informasi sekolah</h2>
            <div className="verification-alert"><img src={warningIcon} alt="" />Sebagian data perlu diverifikasi</div>
            {facts.map((fact) => <div className="school-fact" key={fact}><span>{fact}</span><strong>Belum tersedia</strong></div>)}
            <div className="school-info-actions"><button className="secondary">Tentang data</button><button onClick={onBack}>Kembali ke daftar</button></div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function FigmaExplorer() {
  const [showFilter, setShowFilter] = useState(false);
  const [showList, setShowList] = useState(false);
  const [mode, setMode] = useState(supportedStates.has(forcedState) ? forcedState : 'loading');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (supportedStates.has(forcedState)) return undefined;
    const timer = window.setTimeout(() => setMode('loaded'), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const queryHasNoMatch = debouncedQuery && !['Contoh sekolah A', 'Contoh sekolah B', 'Contoh sekolah C'].some(name => name.toLowerCase().includes(debouncedQuery.toLowerCase()));
  const effectiveMode = mode === 'loaded' && queryHasNoMatch ? 'empty' : mode;
  const resultText = useMemo(() => effectiveMode === 'empty' ? '0 hasil ditemukan' : '3 hasil ditemukan', [effectiveMode]);
  const reset = () => { setQuery(''); setDebouncedQuery(''); setMode('loaded'); };
  const retry = () => { setMode('loading'); window.setTimeout(() => setMode('loaded'), 700); };

  if (mode === 'detail') return <DetailPage onBack={() => setMode('loaded')} />;

  return (
    <div className="figma-explorer">
      <Header />
      <section className="explorer-heading">
        <div><h1>Jelajahi data sekolah</h1><p>Temukan sekolah dan pahami kelengkapan datanya.</p></div>
        <SearchField value={query} onChange={setQuery} resultText={resultText} />
      </section>
      <div className={`explorer-workspace state-${effectiveMode}`}>
        <button className="explorer-toggle filter-open" aria-expanded={showFilter} aria-controls="filters" onClick={() => { setShowFilter(true); setShowList(false); }}>☰ Filter</button>
        <button className="explorer-toggle list-open" aria-expanded={showList} aria-controls="results" onClick={() => { setShowList(true); setShowFilter(false); }}>☷ Daftar sekolah</button>
        <SlidePanel id="filters" side="left" open={showFilter} title="Filter" onClose={() => setShowFilter(false)}><FilterSidebar onReset={reset} /></SlidePanel>
        <SlidePanel id="results" side="right" open={showList} title="Hasil pencarian" width={560} onClose={() => setShowList(false)}>{queryHasNoMatch ? <EmptyResults onReset={reset} /> : <SchoolList query={debouncedQuery} onDetail={() => setMode('detail')} />}</SlidePanel>
        {effectiveMode === 'loading' && <LoadingWorkspace />}
        {effectiveMode === 'data-error' && <DataError onRetry={retry} />}
        {effectiveMode === 'map-error' && <MapError onRetry={() => setMode('loaded')} onDetail={() => setMode('detail')} />}
        {(effectiveMode === 'loaded' || effectiveMode === 'empty') && <><MapPreview />{effectiveMode === 'empty' && !showList && <EmptyResults onReset={reset} />}</>}
      </div>
      <Footer />
    </div>
  );
}
