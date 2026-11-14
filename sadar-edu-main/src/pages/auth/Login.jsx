import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import logo from '../../assets/figma/logo-sadar.svg';
import schoolIllustration from '../../assets/school-isometric.png';
import { roleHome, useAuthStore } from '../../store/useAuthStore';
import './login.css';

function IsometricEducationAtlas() {
  return (
    <svg
      className="login-atlas"
      viewBox="0 0 780 620"
      role="img"
      aria-label="Ilustrasi isometrik atlas pendidikan Bogor"
    >
      <defs>
        <pattern id="login-atlas-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#173e50" strokeOpacity=".05" strokeWidth="1" />
        </pattern>
        <clipPath id="login-atlas-plane">
          <path d="M76 308 387 126 706 309 393 500Z" />
        </clipPath>
      </defs>

      <g className="login-atlas-shadow" fill="#173e50" opacity=".08">
        <path d="m87 342 304-178 305 174-304 184Z" />
      </g>

      <path d="m76 308 311-182 319 183-313 191Z" fill="#ffffff" stroke="#173e50" strokeWidth="2" />
      <path d="m76 308 317 192v30L76 339Z" fill="#a9c8ba" stroke="#173e50" strokeWidth="2" />
      <path d="m393 500 313-191v30L393 530Z" fill="#769f8c" stroke="#173e50" strokeWidth="2" />

      <g clipPath="url(#login-atlas-plane)">
        <rect x="40" y="90" width="700" height="450" fill="url(#login-atlas-grid)" />
      </g>

      {/* Bangunan sekolah diganti dengan ilustrasi isometrik edukasi Sadar Edu */}
      <g className="login-atlas-school">
        <image
          href={schoolIllustration}
          x="145"
          y="150"
          width="490"
          height="326"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>

      <g className="login-atlas-marker login-atlas-marker-a" transform="translate(195 430)">
        <circle r="16" fill="#ffffff" stroke="#173e50" strokeWidth="2" />
        <circle r="6" fill="#1f6f5f" />
        <circle className="login-atlas-pulse" r="14" fill="none" stroke="#1f6f5f" strokeWidth="2" />
      </g>
      <g className="login-atlas-marker login-atlas-marker-b" transform="translate(630 250)">
        <circle r="16" fill="#ffffff" stroke="#173e50" strokeWidth="2" />
        <circle r="6" fill="#e6a03c" />
      </g>

      <g className="login-atlas-label" transform="translate(90 145)">
        <path d="M0 0h174v68H0Z" fill="#fff" stroke="#173e50" strokeWidth="2" />
        <path d="M18 20h42v8H18Zm0 17h108v7H18Zm0 15h78v7H18Z" fill="#173e50" />
        <path d="m147 68 22 20-7-20Z" fill="#fff" stroke="#173e50" strokeWidth="2" />
      </g>
      <g className="login-atlas-compass" transform="translate(649 454)">
        <circle r="47" fill="#173e50" />
        <path d="m0-25 9 19-9 31-9-31Z" fill="#ffffff" />
        <path d="m0-25 9 19-9 6Z" fill="#e6a03c" />
        <text y="-57" textAnchor="middle" fill="#173e50" fontSize="15" fontWeight="700">UTARA</text>
      </g>
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Masuk Pengelola — SADAR EDU';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role) navigate(roleHome(user.role), { replace: true });
  }, [isAuthenticated, navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');
    try {
      // Peran tidak dipilih di UI; backend menjadi satu-satunya sumber hak akses pengguna.
      const authenticatedUser = await login(email.trim(), password);
      navigate(roleHome(authenticatedUser.role), { replace: true });
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error?.status === 0
          ? 'Server belum dapat dijangkau. Periksa koneksi lalu coba lagi.'
          : 'Email atau kata sandi tidak sesuai. Periksa kembali akun Anda.',
      );
    }
  };

  const isLoading = status === 'loading';

  return (
    <main className="login-page" data-lenis-prevent>
      <a className="login-skip" href="#login-form">Langsung ke formulir masuk</a>

      <section className="login-panel" aria-labelledby="login-title">
        <header className="login-header">
          <Link className="login-brand" to="/" aria-label="SADAR EDU, kembali ke beranda">
            <img src={logo} alt="" />
            <span>SADAR EDU</span>
          </Link>
          <Link className="login-back" to="/peta">
            <ArrowLeft size={17} aria-hidden="true" />
            Kembali ke peta
          </Link>
        </header>

        <div className="login-content">
          <p className="login-context">Ruang kerja pengelola</p>
          <h1 id="login-title">Masuk dan lanjutkan pekerjaan Anda.</h1>
          <p className="login-intro">
            Satu akses untuk operator data dan Dinas Pendidikan. Ruang kerja akan disesuaikan otomatis berdasarkan akun Anda.
          </p>

          <form id="login-form" className="login-form" onSubmit={handleSubmit} aria-busy={isLoading}>
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <div className="login-input-wrap">
                <Mail size={19} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="nama@instansi.go.id"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="login-password">Kata sandi</label>
                <span>Minimal 8 karakter</span>
              </div>
              <div className="login-input-wrap">
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  aria-invalid={status === 'error'}
                  aria-describedby={status === 'error' ? 'login-error' : 'login-help'}
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <p id="login-help" className="login-help">Lupa kata sandi? Hubungi administrator Dinas Pendidikan.</p>
            {errorMessage && <p id="login-error" className="login-error" role="alert">{errorMessage}</p>}

            <button className="login-submit" type="submit" disabled={isLoading}>
              <span>{isLoading ? 'Memeriksa akun…' : 'Masuk ke ruang kerja'}</span>
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          </form>
        </div>

        <footer className="login-footer">
          <span>Akses internal SADAR EDU</span>
          <span>Aktivitas akun tercatat untuk audit data.</span>
        </footer>
      </section>

      <aside className="login-visual" aria-label="Gambaran sistem SADAR EDU">
        <div className="login-visual-copy">
          <p>Atlas pendidikan Bogor</p>
          <h2>Data yang rapi, keputusan yang lebih tepat.</h2>
        </div>

        <div className="login-atlas-stage">
          <IsometricEducationAtlas />
          <div className="login-atlas-note login-atlas-note-left">
            <span>Lapisan aktif</span>
            Sekolah dan jangkauan
          </div>
          <div className="login-atlas-note login-atlas-note-right">
            <span>Wilayah kajian</span>
            Bogor
          </div>
        </div>

        <ul className="login-legend" aria-label="Informasi yang tersedia di ruang kerja">
          <li><span />Data sekolah</li>
          <li><span />Jangkauan layanan</li>
          <li><span />Kebutuhan wilayah</li>
        </ul>
      </aside>
    </main>
  );
}
