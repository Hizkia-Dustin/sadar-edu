import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
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
import { Dialog, FOCUS, formatTimestamp } from './ui';
import logoSadar from '../../assets/figma/logo-sadar.svg';

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

function BrandMark() {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
      {failed ? (
        <span className="flex h-full w-full items-center justify-center bg-[#1b4965] text-white">
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
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
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

  // Di layar kecil, sidebar menutup sendiri setelah pindah halaman.
  useEffect(() => {
    if (window.innerWidth < 1024) setCollapsed(true);
  }, [pathname]);

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
  const hide = collapsed ? 'sr-only' : '';
  const itemShape = `relative flex h-[42px] items-center rounded-lg text-xs ${
    collapsed ? 'justify-center' : 'gap-[13px] px-[14px]'
  }`;

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
    <div className="h-screen bg-[#edf3f6] p-3 text-[#173042] [font-family:'Public_Sans',system-ui,sans-serif] sm:p-6">
      <div className="flex h-full min-h-0 overflow-hidden rounded-[20px] border border-[#d7e1e8] bg-white shadow-[0_12px_30px_rgba(10,36,51,0.1)] sm:rounded-[28px]">
        <aside
          className={`flex shrink-0 flex-col overflow-y-auto border-r border-[#d7e1e8] bg-white transition-[width] duration-200 motion-reduce:transition-none ${
            collapsed ? 'w-[76px]' : 'w-[230px]'
          }`}
        >
          <div
            className={`flex pt-[22px] ${
              collapsed ? 'flex-col items-center gap-3' : 'items-start justify-between px-[22px]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className={`text-base font-semibold leading-6 text-[#1b4965] ${hide}`}>
                SADAR EDU
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
              className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#d7e1e8] bg-[#edf3f6] text-[#445665] transition-colors hover:bg-[#e1eaee] ${FOCUS}`}
            >
              {collapsed ? (
                <ChevronRight size={18} aria-hidden="true" />
              ) : (
                <ChevronLeft size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <p className={`mt-[26px] px-[22px] text-[11px] font-medium leading-4 text-[#445665] ${hide}`}>
            MENU
          </p>
          <nav
            aria-label="Menu operator"
            className={`mt-3 flex flex-col gap-2 ${collapsed ? 'px-3' : 'px-5'}`}
          >
            {NAV_ITEMS.map(({ label, to, icon: Icon }) =>
              to ? (
                <NavLink
                  key={label}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `${itemShape} ${FOCUS} ${
                      isActive
                        ? 'bg-[#e8f3f0] text-[#1b4965] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-sm before:bg-[#3fa796]'
                        : 'text-[#445665] hover:bg-[#edf3f6]'
                    }`
                  }
                >
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  <span className={hide}>{label}</span>
                </NavLink>
              ) : (
                <button
                  key={label}
                  type="button"
                  disabled
                  title="Segera hadir"
                  className={`${itemShape} w-full cursor-not-allowed text-left text-[#445665] opacity-70`}
                >
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  <span className={hide}>{label}</span>
                  <span className="sr-only">, segera hadir</span>
                </button>
              )
            )}
          </nav>

          <div className={`mt-auto pb-4 pt-8 ${collapsed ? 'px-3' : 'px-5'}`}>
            <p className={`px-0.5 text-[11px] font-medium leading-4 text-[#445665] ${hide}`}>AKUN</p>
            <div className="my-3 h-px bg-[#d7e1e8]" />
            <button
              type="button"
              onClick={handleLogout}
              aria-label={collapsed ? 'Keluar dari akun' : undefined}
              className={`flex h-[46px] w-full cursor-pointer items-center rounded-lg border border-[#a12b31] bg-[#fff0f0] text-sm font-semibold text-[#a12b31] transition-colors hover:bg-[#ffe3e3] active:bg-[#ffd6d6] ${
                collapsed ? 'justify-center' : 'gap-3.5 px-[13px]'
              } ${FOCUS}`}
            >
              <LogOut size={20} aria-hidden="true" className="shrink-0" />
              <span className={hide}>Keluar dari akun</span>
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              title="Buka panduan operator"
              className={`mt-3 flex h-10 w-full cursor-pointer items-center text-xs text-[#445665] hover:text-[#173042] ${
                collapsed ? 'justify-center' : 'gap-2.5 px-3'
              } ${FOCUS}`}
            >
              <BookOpen size={16} aria-hidden="true" className="shrink-0" />
              <span className={hide}>Panduan operator</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] shrink-0 items-center gap-3 border-b border-[#d7e1e8] bg-white px-4 sm:px-7">
            <p
              className={`truncate text-xl font-semibold leading-7 ${
                searchOpen ? 'hidden md:mr-auto md:block' : 'mr-auto'
              }`}
            >
              {pageTitle}
            </p>

            <div
              ref={searchRef}
              className={`relative ${
                searchOpen
                  ? 'min-w-0 flex-1 md:w-[300px] md:flex-none'
                  : 'hidden md:block'
              }`}
            >
              <label htmlFor="cari-menu" className="sr-only">Cari menu atau data</label>
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#445665]"
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
                className={`h-[42px] w-full rounded-lg border border-[#d7e1e8] bg-[#f9fafb] pl-[43px] pr-3 text-xs placeholder:text-[#445665] md:w-[300px] ${FOCUS}`}
              />
              {searchOpen && (
                <div
                  id="hasil-pencarian-operator"
                  className="absolute left-0 right-auto top-[48px] z-40 max-h-[min(70vh,460px)] w-full overflow-y-auto rounded-xl border border-[#d7e1e8] bg-white p-2 shadow-[0_12px_30px_rgba(10,36,51,0.16)] md:left-auto md:right-0 md:w-[min(380px,calc(100vw-32px))]"
                >
                  {!searchQuery.trim() ? (
                    <p className="px-3 py-4 text-xs text-[#445665]">
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
                          <p className="px-3 py-4 text-xs text-[#445665]">
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
              className={`flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#d7e1e8] bg-white text-[#445665] hover:bg-[#edf3f6] md:hidden ${FOCUS}`}
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
                className={`relative flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-lg border border-[#d7e1e8] bg-white text-[#445665] hover:bg-[#edf3f6] ${FOCUS}`}
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#a12b31] px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  id="notifikasi-operator"
                  className="absolute right-0 top-[50px] z-40 w-[min(360px,calc(100vw-32px))] rounded-xl border border-[#d7e1e8] bg-white p-3 shadow-[0_12px_30px_rgba(10,36,51,0.16)]"
                >
                  <div className="flex items-center justify-between gap-3 px-1 pb-2">
                    <h2 className="text-sm font-semibold">Notifikasi aktivitas</h2>
                    <span className="text-[11px] text-[#445665]">
                      {unreadCount > 0 ? `${unreadCount} baru` : 'Sudah dibaca'}
                    </span>
                  </div>
                  {activity.length === 0 ? (
                    <p className="px-2 py-5 text-center text-xs text-[#445665]">
                      Belum ada aktivitas. Simpan draf, jalankan validasi, atau ajukan dataset untuk membuat notifikasi.
                    </p>
                  ) : (
                    <ul className="max-h-[min(60vh,360px)] space-y-1 overflow-y-auto">
                      {activity.slice(0, 8).map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openActivity(item)}
                            className={`w-full rounded-lg px-3 py-2 text-left hover:bg-[#edf3f6] ${FOCUS}`}
                          >
                            <span className="block text-xs font-semibold leading-5 text-[#173042]">{item.text}</span>
                            <span className="mt-0.5 block text-[11px] text-[#445665]">
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
                    className={`mt-2 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#1b4965] hover:bg-[#edf3f6] ${FOCUS}`}
                  >
                    Lihat semua aktivitas
                  </button>
                </div>
              )}
            </div>

            <div className="flex h-[50px] items-center gap-3 rounded-[10px] bg-[#edf3f6] pl-2 pr-4">
              <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#1b4965] text-white"
              >
                <User size={18} />
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs leading-[18px]">{user?.name ?? 'Operator data'}</span>
                <span className="block text-[11px] font-medium leading-4 text-[#445665]">
                  Ruang kerja internal
                </span>
              </span>
            </div>
          </header>

          <main data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto bg-[#f9fafb]">
            <Outlet />
          </main>
        </div>
      </div>
      {guideOpen && (
        <Dialog
          title="Panduan operator"
          onClose={() => setGuideOpen(false)}
          focusRef={guideCloseRef}
          wide
        >
          <p className="mt-2 text-xs leading-5 text-[#445665]">
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
              <li key={title} className="flex gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f3f0] text-xs font-bold text-[#126552]">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#445665]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              ref={guideCloseRef}
              type="button"
              onClick={() => setGuideOpen(false)}
              className={`h-10 rounded-lg border border-[#d7e1e8] px-4 text-xs font-semibold hover:bg-[#edf3f6] ${FOCUS}`}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/operator/dataset');
                setGuideOpen(false);
              }}
              className={`h-10 rounded-lg bg-[#1b4965] px-4 text-xs font-semibold text-white hover:bg-[#153a52] ${FOCUS}`}
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
      <h2 className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#445665]">{title}</h2>
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
        className={`w-full rounded-lg px-3 py-2 text-left hover:bg-[#edf3f6] ${FOCUS}`}
      >
        <span className="block truncate text-xs font-semibold text-[#173042]">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#445665]">{detail}</span>
      </button>
    </li>
  );
}