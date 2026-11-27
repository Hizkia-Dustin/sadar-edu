import { GeoMark } from '../../components/ui/GeoLoader';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import logo from '../../assets/figma/logo-sadar.svg';
import schoolScene from '../../assets/login-school-street.webp';
import { roleHome, useAuthStore } from '../../store/useAuthStore';
import './login.css';

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

      <aside className="login-visual" aria-labelledby="login-visual-title">
        <img className="login-scene" src={schoolScene} alt="" />
        <div className="login-headline">
          <p>Atlas pendidikan Bogor</p>
          <h2 id="login-visual-title">Sekolah di Bogor,<br /><em>dalam satu peta.</em></h2>
        </div>
      </aside>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-content">
          <Link className="login-brand" to="/" aria-label="SADAR EDU, kembali ke beranda">
            <img src={logo} alt="" /> SADAR EDU
          </Link>
          <h1 id="login-title">Masuk ke SADAR EDU</h1>
          <p className="login-intro">Gunakan akun operator atau Dinas Pendidikan Anda.</p>

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
                  placeholder="Masukkan kata sandi Anda"
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
              {isLoading ? <GeoMark /> : <ArrowRight size={19} aria-hidden="true" />}
            </button>
          </form>
          <div className="login-public">
            <Link to="/peta">Jelajahi peta tanpa masuk <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
