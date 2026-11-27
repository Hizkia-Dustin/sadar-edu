import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChartColumn,
  Clock,
  Database,
  House,
  LogOut,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useOperatorStore } from '../../store/useOperatorStore';
import { Dialog, FOCUS, formatTimestamp } from './Ui';
import logoSadar from '../../assets/figma/logo-sadar.svg';
import './operator-shell.css';

// Item tanpa `to` belum punya halaman, jadi tampil nonaktif.
const NAV_ITEMS = [
  { label: 'Ringkasan', title: 'Dashboard', to: '/operator/dashboard', icon: House },
  { label: 'Dataset sekolah', title: 'Dataset sekolah', to: '/operator/dataset', icon: Database },
  { label: 'Validasi data', title: 'Validasi data', to: '/operator/validasi', icon: ShieldCheck },
  { label: 'Indikator & metadata', title: 'Indikator & metadata', to: '/operator/indikator', icon: ChartColumn },
  { label: 'Status pengajuan', title: 'Review pengajuan', to: '/operator/pengajuan', icon: Clock },
];

// Judul bar atas untuk halaman yang tidak punya item menu sendiri.
const EXTRA_TITLES = {
  '/operator/dataset/impor': 'Impor & pemetaan',
  '/operator/validasi/perbaikan': 'Perbaiki data',
  '/operator/pengajuan/status': 'Preview & status',
};

const SEARCH_PAGES = [
  ...NAV_ITEMS,
  { label: 'Impor & pemetaan', title: 'Impor & pemetaan', to: '/operator/dataset/impor', keywords: 'unggah file csv xlsx' },
  { label: 'Perbaiki data', title: 'Perbaiki data', to: '/operator/validasi/perbaikan', keywords: 'edit koreksi error' },
  { label: 'Preview & status', title: 'Preview & status', to: '/operator/pengajuan/status', keywords: 'pengajuan' },
];

const SEARCH_TEXT = (value) => String(value ?? '').toLocaleLowerCase('id-ID');
const matchesSearch = (value, query) => {
  const words = SEARCH_TEXT(query).split(/\s+/);
  const text = SEARCH_TEXT(value);
  return words.every((word) => text.includes(word));
};

function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('id-ID'))
    .join('');
}

function BrandMark() {
  const [failed, setFailed] = useState(false);

  return (
    <span className="op-brand__mark">
      {failed ? (
        <span className="flex h-full w-full items-center justify-center bg-[#145646] text-white">
          <House size={18} aria-hidden="true" />
        </span>
      ) : (
        <img
          src={logoSadar}
          alt=""
          width="34"
          height="34"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export default function OperatorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const versions = useOperatorStore((state) => state.versions);
  const activity = useOperatorStore((state) => state.activity);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lastReadActivityId, setLastReadActivityId] = useState(null);
  const searchRef = useRef(null);
  const notificationsRef = useRef(null);
  const guideCloseRef = useRef(null);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return { pages: [], datasets: [], activities: [] };
    return {
      pages: SEARCH_PAGES.filter((item) =>
        matchesSearch(`${item.label} ${item.title} ${item.to} ${item.keywords ?? ''}`, query)
      ).slice(0, 4),
      datasets: versions
        .filter((item) =>
          matchesSearch(`${item.name} ${item.fileName} ${item.source} ${item.period} ${item.status}`, query)
        )
        .slice(0, 4),
      activities: activity
        .filter((item) => matchesSearch(`${item.stage} ${item.text} ${item.status}`, query))
        .slice(0, 3),
    };
  }, [activity, searchQuery, versions]);

  const unreadCount = useMemo(() => {
    if (activity.length === 0) return 0;
    if (lastReadActivityId === null) return activity.length;
    const lastReadIndex = activity.findIndex((item) => item.id === lastReadActivityId);
    return lastReadIndex === -1 ? activity.length : lastReadIndex;
  }, [activity, lastReadActivityId]);

  // Pindah halaman: tutup panel melayang dan gulir pil aktif ke tampilan (navigasi mobile bergulir).
  const navRef = useRef(null);
  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  // Di layar kecil input baru tampil saat dibuka, jadi fokuskan secara eksplisit.
  useEffect(() => {
    if (searchOpen) searchRef.current?.querySelector('input')?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const handleOutsidePointer = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const handleOutsidePointer = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [notificationsOpen]);

  const pageTitle =
    EXTRA_TITLES[pathname] ??
    NAV_ITEMS.find((item) => item.to === pathname)?.title ??
    'Ruang kerja operator';

  const handleLogout = () => {
    logout();
    navigate('/operator/login');
  };

  const openSearchResult = (to) => {
    const target = to === '/operator/dataset'
      ? `${to}?q=${encodeURIComponent(searchQuery.trim())}`
      : to;
    navigate(target);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
      return;
    }
    if (event.key === 'Enter') {
      const firstPage = searchResults.pages[0];
      if (firstPage) openSearchResult(firstPage.to);
      else if (searchResults.datasets.length > 0) openSearchResult('/operator/dataset');
      else if (searchResults.activities.length > 0) openSearchResult('/operator/dashboard');
    }
  };

  const toggleNotifications = () => {
    if (!notificationsOpen && activity.length > 0) {
      setLastReadActivityId(activity[0].id);
    }
    setNotificationsOpen((open) => !open);
    setSearchOpen(false);
  };

  const openActivity = (item) => {
    const targetByStage = {
      Dataset: '/operator/dataset',
      Validasi: '/operator/validasi',
      Perbaikan: '/operator/validasi/perbaikan',
      Pengajuan: '/operator/pengajuan',
    };
    navigate(targetByStage[item.stage] ?? '/operator/dashboard');
    setNotificationsOpen(false);
  };

  return (
    <div className="operator-shell">
      <div className="op-frame">
        <header className="op-topbar">
          <div className="op-topbar__row">
            <NavLink to="/operator/dashboard" className={`op-brand ${FOCUS}`} aria-label="SADAR EDU, ke ringkasan operator">
              <BrandMark />
              <span className="op-brand__text">
                <span className="op-brand__name">SADAR EDU</span>
                <span className="op-brand__role">Operator data</span>
              </span>
            </NavLink>

            <nav ref={navRef} aria-label="Menu operator" className="op-nav">
              {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) => `op-nav__item ${isActive ? 'is-active' : ''} ${FOCUS}`}
                >
                  <Icon size={16} aria-hidden="true" className="shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="op-topbar__tools">
            <p className="sr-only" aria-live="polite">{pageTitle}</p>

            <div
              ref={searchRef}
              className={`relative ${
                searchOpen
                  ? 'op-search is-open'
                  : 'op-search'
              }`}
            >
              <label htmlFor="cari-menu" className="sr-only">Cari menu atau data</label>
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#52605a]"
              />
              <input
                id="cari-menu"
                type="search"
                autoComplete="off"
                autoFocus={searchOpen}
                placeholder="Cari menu, dataset, aktivitas"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  setSearchOpen(true);
                  setNotificationsOpen(false);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-expanded={searchOpen}
                aria-controls="hasil-pencarian-operator"
                className={`op-search__input ${FOCUS}`}
              />
              {searchOpen && (
                <div
                  id="hasil-pencarian-operator"
                  className="op-popover op-popover--search"
                >
                  {!searchQuery.trim() ? (
                    <p className="px-3 py-4 text-xs text-[#52605a]">
                      Ketik untuk mencari menu, dataset, atau aktivitas.
                    </p>
                  ) : (
                    <>
                      {searchResults.pages.length > 0 && (
                        <SearchResultGroup title="Menu">
                          {searchResults.pages.map((item) => (
                            <SearchResult
                              key={item.to}
                              label={item.label}
                              detail={item.to}
                              onClick={() => openSearchResult(item.to)}
                            />
                          ))}
                        </SearchResultGroup>
                      )}
                      {searchResults.datasets.length > 0 && (
                        <SearchResultGroup title="Dataset">
                          {searchResults.datasets.map((item) => (
                            <SearchResult
                              key={item.id}
                              label={item.name}
                              detail={`${item.status}${item.source ? ` · ${item.source}` : ''}`}
                              onClick={() => openSearchResult('/operator/dataset')}
                            />
                          ))}
                        </SearchResultGroup>
                      )}
                      {searchResults.activities.length > 0 && (
                        <SearchResultGroup title="Aktivitas">
                          {searchResults.activities.map((item) => (
                            <SearchResult
                              key={item.id}
                              label={item.text}
                              detail={`${item.stage} · ${formatTimestamp(item.at)}`}
                              onClick={() => openSearchResult('/operator/dashboard')}
                            />
                          ))}
                        </SearchResultGroup>
                      )}
                      {searchResults.pages.length === 0 &&
                        searchResults.datasets.length === 0 &&
                        searchResults.activities.length === 0 && (
                          <p className="px-3 py-4 text-xs text-[#52605a]">
                            Tidak ada menu, dataset, atau aktivitas yang cocok.
                          </p>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (searchOpen) {
                  setSearchOpen(false);
                  setSearchQuery('');
                } else {
                  setSearchOpen(true);
                }
                setNotificationsOpen(false);
              }}
              aria-label={searchOpen ? 'Tutup pencarian' : 'Cari menu atau data'}
              aria-expanded={searchOpen}
              className={`op-icon-btn op-search-toggle ${FOCUS}`}
            >
              {searchOpen ? <X size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
            </button>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={toggleNotifications}
                aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
                aria-expanded={notificationsOpen}
                aria-controls="notifikasi-operator"
                title="Notifikasi aktivitas operator"
                className={`op-icon-btn ${FOCUS}`}
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="op-badge"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  id="notifikasi-operator"
                  className="op-popover op-popover--notif"
                >
                  <div className="flex items-center justify-between gap-3 px-1 pb-2">
                    <h2 className="text-sm font-semibold">Notifikasi aktivitas</h2>
                    <span className="text-[11px] text-[#52605a]">
                      {unreadCount > 0 ? `${unreadCount} baru` : 'Sudah dibaca'}
                    </span>
                  </div>
                  {activity.length === 0 ? (
                    <p className="px-2 py-5 text-center text-xs text-[#52605a]">
                      Belum ada aktivitas. Simpan draf, jalankan validasi, atau ajukan dataset untuk membuat notifikasi.
                    </p>
                  ) : (
                    <ul className="max-h-[min(60vh,360px)] space-y-1 overflow-y-auto">
                      {activity.slice(0, 8).map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openActivity(item)}
                            className={`w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef4f0] ${FOCUS}`}
                          >
                            <span className="block text-xs font-semibold leading-5 text-[#132a25]">{item.text}</span>
                            <span className="mt-0.5 block text-[11px] text-[#52605a]">
                              {item.stage} · {formatTimestamp(item.at)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/operator/dashboard');
                      setNotificationsOpen(false);
                    }}
                    className={`mt-2 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#145646] hover:bg-[#eef4f0] ${FOCUS}`}
                  >
                    Lihat semua aktivitas
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="Buka panduan operator"
              title="Panduan operator"
              className={`op-icon-btn ${FOCUS}`}
            >
              <BookOpen size={18} aria-hidden="true" />
            </button>

            <div className="op-user">
              <span aria-hidden="true" className="op-user__avatar">
                {initials(user?.nama ?? user?.name) || <User size={16} />}
              </span>
              <span className="op-user__text">
                <span className="op-user__name">{user?.nama ?? user?.name ?? 'Operator data'}</span>
                <span className="op-user__role">Ruang kerja internal</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Keluar dari akun"
                title="Keluar dari akun"
                className={`op-user__logout ${FOCUS}`}
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
            </div>
          </div>
        </header>

        <main data-lenis-prevent className="op-main">
          <Outlet />
        </main>
      </div>
      {guideOpen && (
        <Dialog
          title="Panduan operator"
          onClose={() => setGuideOpen(false)}
          focusRef={guideCloseRef}
          wide
        >
          <p className="mt-2 text-xs leading-5 text-[#52605a]">
            Ikuti alur ini untuk memperbarui dataset sekolah. Perubahan aktivitas akan muncul di lonceng notifikasi.
          </p>
          <ol className="mt-5 space-y-3">
            {[
              ['Pilih dataset', 'Buka Dataset sekolah lalu pilih Impor / perbarui. Unggah berkas CSV atau XLSX.'],
              ['Petakan kolom', 'Cocokkan kolom sumber dengan skema SADAR EDU. Simpan draf atau lanjutkan dengan Jalankan validasi.'],
              ['Tinjau dan perbaiki', 'Periksa hasil validasi. Jika ada temuan, buka Perbaiki data, simpan usulan, lalu terapkan dan validasi ulang.'],
              ['Lengkapi metadata', 'Di Status pengajuan, isi sumber, periode, cakupan, dan lisensi dataset.'],
              ['Ajukan pembaruan', 'Setelah semua gerbang terpenuhi, kirim untuk ditinjau dan pantau statusnya di halaman pengajuan.'],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3 rounded-lg border border-[#dde6e0] bg-[#f7faf8] p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f3f0] text-xs font-bold text-[#126552]">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#52605a]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              ref={guideCloseRef}
              type="button"
              onClick={() => setGuideOpen(false)}
              className={`h-10 rounded-lg border border-[#dde6e0] px-4 text-xs font-semibold hover:bg-[#eef4f0] ${FOCUS}`}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/operator/dataset');
                setGuideOpen(false);
              }}
              className={`h-10 rounded-lg bg-[#145646] px-4 text-xs font-semibold text-white hover:bg-[#0f4337] ${FOCUS}`}
            >
              Mulai dari dataset
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function SearchResultGroup({ title, children }) {
  return (
    <section className="mb-1 last:mb-0">
      <h2 className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#52605a]">{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

function SearchResult({ label, detail, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef4f0] ${FOCUS}`}
      >
        <span className="block truncate text-xs font-semibold text-[#132a25]">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#52605a]">{detail}</span>
      </button>
    </li>
  );
}
