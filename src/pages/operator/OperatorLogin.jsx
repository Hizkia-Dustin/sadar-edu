import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Database, House, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const PRINCIPLES = [
  { icon: Database, text: 'NPSN tetap sebagai teks' },
  { icon: ShieldCheck, text: 'Null berbeda dari nilai nol' },
  { icon: Clock, text: 'Semua perubahan tercatat' },
];

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c6e8e]';

const inputClass = (invalid) =>
  `h-11 w-full rounded-lg border px-[13px] text-sm text-[#173042] placeholder:text-[#445665] ${FOCUS} ${
    invalid ? 'border-[#a12b31] bg-[#fff0f0]' : 'border-[#d7e1e8] bg-white'
  }`;

// TODO: ganti dengan permintaan ke API login backend setelah endpoint dan
// bentuk responsnya dikonfirmasi. Sementara ini hanya simulasi, sama seperti useAuthStore.
async function authenticate(email, password) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!email.endsWith('.go.id') || password.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }
}

export default function OperatorLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const passwordRef = useRef(null);

  const hasError = status === 'error';
  const isLoading = status === 'loading';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setStatus('loading');
    try {
      await authenticate(email.trim(), password);
      login('operator');
      navigate('/operator/dashboard');
    } catch {
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setPassword('');
    passwordRef.current?.focus();
  };

  return (
    <div
      data-lenis-prevent
      className="h-screen overflow-y-auto bg-[#edf3f6] [font-family:'Public_Sans',system-ui,sans-serif]"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-10">
        <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-[#d7e1e8] bg-white shadow-[0_12px_30px_rgba(10,36,51,0.1)] lg:min-h-[736px] lg:grid-cols-[430px_1fr]">
          <section
            aria-label="Tentang ruang kerja operator"
            className="flex flex-col bg-[#1b4965] p-8 text-white sm:p-[42px]"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-[#1b4965]"
              >
                <House size={22} />
              </span>
              <p className="text-xl font-semibold leading-7">SADAR EDU</p>
            </div>

            <h2 className="mt-12 max-w-[330px] text-[28px] font-bold leading-9 lg:mt-[78px]">
              Ruang kerja Operator Data
            </h2>
            <p className="mt-3 max-w-[330px] text-sm leading-[22px]">
              Impor, validasi, dan ajukan pembaruan data sekolah dengan jejak audit yang jelas.
            </p>

            <ul className="mt-10 flex max-w-[330px] flex-col gap-3 lg:mt-[54px]">
              {PRINCIPLES.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex h-[54px] items-center gap-3 rounded-[10px] bg-white/10 px-3.5 text-xs leading-[18px]"
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <p className="mt-10 pt-6 text-[11px] font-medium leading-4 lg:mt-auto">
              Desktop internal &middot; akses terbatas
            </p>
          </section>

          <main className="flex items-center px-6 py-10 sm:px-12 lg:px-20 lg:py-[110px]">
            <div className="w-full max-w-[490px]">
              <h1 className="text-[28px] font-bold leading-9 text-[#173042]">Masuk ke ruang kerja</h1>
              <p className="mt-1 text-sm leading-[22px] text-[#445665]">
                Gunakan akun Operator Data yang diberikan Dinas.
              </p>

              <div className={hasError ? 'mt-[26px]' : 'mt-[50px]'}>
                {hasError && (
                  <div
                    id="login-error"
                    role="alert"
                    className="mb-7 flex min-h-[58px] items-center gap-3 rounded-lg border border-[#a12b31] bg-[#fff0f0] px-[13px] py-3 text-xs leading-[18px] text-[#a12b31]"
                  >
                    <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
                    Email atau kata sandi tidak sesuai. Coba lagi.
                  </div>
                )}

                <form onSubmit={handleSubmit} aria-busy={isLoading}>
                  <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-medium leading-4 text-[#445665]">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="operator@contoh.go.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className={inputClass(false)}
                  />

                  <label
                    htmlFor="login-password"
                    className={`mb-1.5 mt-[22px] block text-[11px] font-medium leading-4 ${
                      hasError ? 'text-[#a12b31]' : 'text-[#445665]'
                    }`}
                  >
                    Kata sandi
                  </label>
                  <input
                    id="login-password"
                    ref={passwordRef}
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? 'login-error' : undefined}
                    className={inputClass(hasError)}
                  />

                  <p className="mt-1.5 text-right text-xs leading-[18px] text-[#445665]">
                    Lupa kata sandi? Hubungi admin Dinas.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`mt-6 h-[42px] w-full cursor-pointer rounded-lg bg-[#1b4965] text-sm font-semibold text-white transition-colors hover:bg-[#153a52] disabled:cursor-wait disabled:opacity-70 ${FOCUS}`}
                  >
                    {isLoading ? 'Memproses...' : 'Masuk'}
                  </button>
                </form>

                <p className="mt-4 text-center text-[11px] font-medium leading-4 text-[#445665]">
                  Dengan masuk, aktivitas Anda akan tercatat dalam log audit.
                </p>

                {hasError && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className={`mt-9 h-[42px] w-full cursor-pointer rounded-lg border border-[#d7e1e8] bg-white text-sm font-semibold text-[#173042] transition-colors hover:bg-[#edf3f6] ${FOCUS}`}
                  >
                    Coba ulang
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}