import { useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { isProvenanceComplete } from '../../lib/operatorImport';
import './operator-dashboard.css';
const OperatorMapPreview = lazy(() => import('../../components/operator/OperatorMapPreview'));
import {
  BTN_PRIMARY,
  CARD,
  EMPTY,
  FOCUS,
  MetricCard,
  PageHeader,
  StatusPill,
  TD,
  TH,
  formatTimestamp,
} from '../../components/operator/ui';

const ALERTS = [
  {
    icon: TriangleAlert,
    tone: 'bg-[#85520c]',
    title: 'Validasi belum dijalankan',
    text: 'Unggah dataset untuk melihat temuan.',
  },
  {
    icon: Database,
    tone: 'bg-[#2c6e8e]',
    title: 'Provenance belum lengkap',
    text: 'Sumber dan periode wajib sebelum pengajuan.',
  },
  {
    icon: ShieldCheck,
    tone: 'bg-[#1b4965]',
    title: 'Tidak ada pengajuan aktif',
    text: 'Status muncul setelah dikirim ke Dinas.',
  },
];


export default function OperatorDashboard() {
  const navigate = useNavigate();
  const versions = useOperatorStore((state) => state.versions);
  const activity = useOperatorStore((state) => state.activity);
  const fetchDatasets = useOperatorStore((state) => state.fetchDatasets);

  const validation = useOperatorStore((state) => state.validation);
  const provenance = useOperatorStore((state) => state.provenance);
  const submission = useOperatorStore((state) => state.submission);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const countByStatus = (status) => versions.filter((version) => version.status === status).length;
  const activeDatasets = versions.filter((v) => v.aktif !== false).length;

  const metrics = [
    {
      label: 'Dataset aktif',
      value: activeDatasets > 0 ? activeDatasets : (versions.length > 0 ? versions.length : EMPTY),
      note: activeDatasets > 0 ? `${activeDatasets} dataset aktif di server` : 'Versi belum tersedia',
      accent: 'bg-[#1b4965]',
    },
    {
      label: 'Siap ditinjau',
      value: validation ? countByStatus('Siap ditinjau') : countByStatus('Siap digunakan'),
      note: validation ? 'Lolos validasi draf' : (versions.length > 0 ? `${countByStatus('Siap digunakan')} dataset valid` : 'Menunggu validasi'),
      accent: 'bg-[#3fa796]',
    },
    {
      label: 'Perlu perbaikan',
      value: validation ? countByStatus('Perlu perbaikan') : 0,
      note: validation ? 'Dari validasi terakhir' : 'Belum divalidasi',
      accent: 'bg-[#85520c]',
    },
  ];

  const alerts = [
    validation
      ? {
          icon: TriangleAlert,
          tone: 'bg-[#85520c]',
          title: 'Validasi terakhir',
          text:
            validation.needsFixRows > 0
              ? `${validation.needsFixRows} dari ${validation.totalRows} baris perlu perbaikan.`
              : `Semua ${validation.totalRows} baris lolos aturan.`,
        }
      : ALERTS[0],
    isProvenanceComplete(provenance)
      ? {
          icon: Database,
          tone: 'bg-[#2c6e8e]',
          title: 'Provenance lengkap',
          text: 'Sumber, periode, cakupan, dan lisensi sudah diisi.',
        }
      : ALERTS[1],
    submission
      ? {
          icon: ShieldCheck,
          tone: 'bg-[#1b4965]',
          title: 'Pengajuan aktif',
          text: `${submission.fileName} menunggu peninjauan Dinas.`,
        }
      : ALERTS[2],
  ];

  return (
    <div className="operator-overview flex flex-col gap-5 p-4 sm:p-7">
      <PageHeader
        eyebrow="Ringkasan"
        title="Ringkasan data sekolah"
        description="Periksa sebaran sekolah dan selesaikan pembaruan data Anda."
        action={
          <button
            type="button"
            onClick={() => navigate('/operator/dataset/impor')}
            className={`${BTN_PRIMARY} w-[172px]`}
          >
            Impor dataset
          </button>
        }
      />

      <div className="operator-bento grid gap-5 lg:grid-cols-[minmax(0,1fr)_344px]">
        <div className="operator-bento-main flex min-w-0 flex-col gap-4">
          <div className="operator-metrics grid gap-3.5 sm:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#c2d7e5] bg-[#edf5f8] p-3 text-xs text-[#1b4965]">
            <p className="min-w-[200px] flex-1 leading-relaxed">
              Tinjau versi dataset atau perbarui informasi sekolah dari halaman pengelolaan data.
            </p>
            <button
              type="button"
              onClick={() => navigate('/operator/dataset')}
              className="font-bold underline hover:text-[#0f2c3d]"
            >
              Kelola data sekolah
            </button>
          </div>

          <section aria-labelledby="judul-cakupan" className={`operator-coverage ${CARD} p-[17px]`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="judul-cakupan" className="text-base font-semibold leading-6">
                  Cakupan lokasi sekolah
                </h2>
                <p className="text-[11px] font-medium leading-4 text-[#445665]">
                  Data server dan lokasi draf yang sedang dikelola
                </p>
              </div>
              <StatusPill>Pratinjau interaktif</StatusPill>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg">
              <Suspense fallback={<p>Memuat peta…</p>}><OperatorMapPreview /></Suspense>
            </div>
          </section>
        </div>

        <section aria-labelledby="judul-perhatian" className={`operator-attention ${CARD} p-[17px]`}>
          <h2 id="judul-perhatian" className="text-base font-semibold leading-6">Perhatian data</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            Aturan yang memerlukan tindakan operator.
          </p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {alerts.map(({ icon: Icon, tone, title, text }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#edf3f6] p-3"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-white ${tone}`}
                >
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-5">{title}</span>
                  <span className="block text-[11px] font-medium leading-4 text-[#445665]">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="judul-aktivitas" className={`operator-activity ${CARD} p-[17px]`}>
        <h2 id="judul-aktivitas" className="text-base font-semibold leading-6">Aktivitas terbaru</h2>
        <p className="text-xs leading-[18px] text-[#445665]">
          Perubahan dataset dan keputusan akan muncul di sini.
        </p>
        <div
          role="region"
          aria-label="Tabel aktivitas terbaru"
          tabIndex={0}
          className={`mt-4 overflow-x-auto ${FOCUS}`}
        >
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-[16%]`}>Tahap</th>
                <th scope="col" className={`${TH} w-[46%]`}>Aktivitas</th>
                <th scope="col" className={`${TH} w-[18%]`}>Waktu</th>
                <th scope="col" className={`${TH} w-[20%]`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td className={TD}>Dataset</td>
                  <td className={TD}>Belum ada aktivitas</td>
                  <td className={TD}>{EMPTY}</td>
                  <td className={TD}>Menunggu</td>
                </tr>
              ) : (
                activity.map((item) => (
                  <tr key={item.id}>
                    <td className={TD}>{item.stage}</td>
                    <td className={TD}>{item.text}</td>
                    <td className={TD}>{formatTimestamp(item.at)}</td>
                    <td className={TD}>{item.status}</td>
                  </tr>
                ))
              )}
              {!activity.some((item) => item.stage === 'Pengajuan') && (
                <tr>
                  <td className={TD}>Pengajuan</td>
                  <td className={TD}>Belum ada pengajuan</td>
                  <td className={TD}>{EMPTY}</td>
                  <td className={TD}>Belum dimulai</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
