import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const ACCESS_OPTIONS = [
  {
    role: 'stakeholder',
    title: 'Stakeholder / Dinas',
    description: 'Lihat analisis dan hasil perencanaan.',
  },
  {
    role: 'operator',
    title: 'Operator Data',
    description: 'Kelola dan perbarui dataset spasial.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSelect = (role) => {
    if (role === 'operator') {
      navigate('/operator/login');
      return;
    }

    // TODO: arahkan ke halaman login stakeholder setelah halamannya dibuat.
    login(role);
    navigate('/stakeholder/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1F6F5F]">SADAR EDU</h1>
          <p className="text-xs text-slate-500 mt-1">
            Sistem Analisis Distribusi &amp; Aksebilitas Ruang Edukasi
          </p>
        </div>

        <h2 className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
          Pilih akses masuk
        </h2>

        <div className="flex flex-col gap-3">
          {ACCESS_OPTIONS.map((option) => (
            <button
              key={option.role}
              type="button"
              onClick={() => handleSelect(option.role)}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-[#1F6F5F] hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6F5F]"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">{option.title}</span>
                <span className="block text-xs text-slate-600">{option.description}</span>
              </span>
              <ArrowRight
                size={18}
                aria-hidden="true"
                className="shrink-0 text-slate-500 transition-colors group-hover:text-[#1F6F5F]"
              />
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <a href="/peta" className="text-xs text-[#1F6F5F] hover:underline">
            &larr; Kembali ke Eksplorasi Warga
          </a>
        </div>
      </div>
    </div>
  );
}