import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, TriangleAlert } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { summarizePreview } from '../../lib/operatorImport';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  Dialog,
  EMPTY,
  FOCUS,
  PageHeader,
  StatusPill,
  TD,
  TH,
  formatTimestamp,
} from '../../components/operator/ui';

const STEPS = ['Draf', 'Dikirim', 'Review Dinas', 'Selesai'];

const STEP_STYLE = {
  done: { card: 'bg-white', circle: 'bg-[#2d8272] text-white', label: 'text-[#173042]' },
  current: { card: 'bg-[#e8f3f0]', circle: 'bg-[#1b4965] text-white', label: 'text-[#1b4965]' },
  todo: { card: 'bg-[#f9fafb]', circle: 'bg-[#edf3f6] text-[#445665]', label: 'text-[#445665]' },
};

const fileLabel = (fileName) => fileName.replace(/\.[^.]+$/, '');

export default function OperatorStatus() {
  const navigate = useNavigate();
  const draft = useOperatorStore((state) => state.draft);
  const draftAt = useOperatorStore((state) => state.draftAt);
  const provenance = useOperatorStore((state) => state.provenance);
  const submission = useOperatorStore((state) => state.submission);
  const [showPreview, setShowPreview] = useState(false);

  const submitted = Boolean(submission && draft && submission.fileName === draft.fileName);
  const currentStep = submitted ? 1 : 0;
  const summary = draft ? summarizePreview(draft) : null;

  const hasProvenance = provenance.source.trim() !== '' && provenance.period.trim() !== '';
  const previewTitle = draft ? fileLabel(draft.fileName) : 'Belum ada dataset';
  const previewNote = hasProvenance
    ? `Sumber: ${provenance.source.trim()}. Periode: ${provenance.period.trim()}.`
    : 'Sumber dan periode belum tersedia';

  const history = [
    {
      label: 'Draf dibuat',
      reached: Boolean(draftAt),
      time: draftAt ? formatTimestamp(draftAt) : 'Belum ada waktu',
    },
    {
      label: 'Dikirim ke Dinas',
      reached: submitted,
      time: submitted ? formatTimestamp(submission.submittedAt) : 'Belum',
    },
    { label: 'Keputusan Dinas', reached: false, time: 'Belum' },
  ];

  const metrics = [
    { label: 'Sekolah', value: summary ? summary.total : EMPTY },
    { label: 'Dengan marker', value: summary ? summary.withMarker : EMPTY },
    { label: 'Tanpa marker', value: summary ? summary.withoutMarker : EMPTY },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Pengajuan"
        title="Preview dan status pembaruan"
        description="Lacak perjalanan draf sampai keputusan Dinas."
        action={
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={!draft}
            className={`${BTN_OUTLINE} w-[172px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Buka preview
          </button>
        }
      />

      <section aria-labelledby="judul-status" className={`${CARD} p-[17px]`}>
        <h2 id="judul-status" className="text-base font-semibold leading-6">Status pengajuan</h2>
        <ol aria-label="Tahap pengajuan" className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0 lg:px-4">
          {STEPS.map((label, index) => {
            const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
            const style = STEP_STYLE[state];
            return (
              <li
                key={label}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex items-center lg:flex-1"
              >
                <div
                  className={`flex h-[58px] flex-1 items-center gap-3 rounded-lg border border-[#d7e1e8] px-[11px] ${style.card}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.circle}`}
                  >
                    {state === 'done' ? <Check size={18} /> : index + 1}
                  </span>
                  <span className={`text-sm font-semibold leading-5 ${style.label}`}>{label}</span>
                  {state === 'done' && <span className="sr-only">, selesai</span>}
                </div>
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`hidden h-0.5 w-10 shrink-0 lg:block ${
                      index <= currentStep ? 'bg-[#3fa796]' : 'bg-[#d7e1e8]'
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="judul-preview" className={`${CARD} min-w-0 p-[17px]`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="judul-preview" className="text-base font-semibold leading-6">Pratinjau publik</h2>
            <StatusPill tone={submitted ? 'success' : 'neutral'}>{submitted ? 'Dikirim' : 'Draf'}</StatusPill>
          </div>

          <div className="mt-5 rounded-lg border border-[#d7e1e8] bg-[#e8f3f0] p-[17px]">
            <p className="break-words text-xl font-semibold leading-7">{previewTitle}</p>
            <p className="mt-1 text-xs leading-[18px] text-[#445665]">{previewNote}</p>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex flex-col-reverse rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-[15px]"
              >
                <dt className="text-[11px] font-medium leading-4 text-[#445665]">{metric.label}</dt>
                <dd className="text-[28px] font-bold leading-9">{metric.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#fff5e3] p-4">
            <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#85520c]" />
            <p className="text-xs leading-[18px] text-[#85520c]">
              Preview belum mewakili data publik sampai pengajuan disetujui.
            </p>
          </div>
        </section>

        <section aria-labelledby="judul-riwayat" className={`${CARD} p-[17px]`}>
          <h2 id="judul-riwayat" className="text-base font-semibold leading-6">Riwayat status</h2>
          <ol className="mt-5">
            {history.map((item, index) => (
              <li key={item.label} className="relative pb-8 pl-[27px] last:pb-0">
                {index < history.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-0.5 bg-[#d7e1e8]" />
                )}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1 h-3 w-3 rounded-full ${
                    item.reached ? 'bg-[#1b4965]' : 'bg-[#c3d0d8]'
                  }`}
                />
                <p className="text-sm font-semibold leading-5">{item.label}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#445665]">{item.time}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[11px] font-medium leading-4 text-[#445665]">
            Belum terhubung ke server. Keputusan Dinas belum dapat diterima.
          </p>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/operator/dashboard')}
          className={`${BTN_PRIMARY} w-[220px]`}
        >
          Kembali ke dashboard
        </button>
      </div>

      {showPreview && summary && (
        <Dialog title="Pratinjau publik" wide onClose={() => setShowPreview(false)}>
          <p className="mt-1 text-xs leading-[18px] text-[#445665]">
            {previewTitle}. Ini draf dan belum mewakili data publik sampai pengajuan disetujui.
          </p>
          <div
            role="region"
            aria-label="Daftar sekolah pratinjau"
            tabIndex={0}
            className={`mt-4 max-h-[50vh] overflow-auto rounded-lg border border-[#d7e1e8] ${FOCUS}`}
          >
            <table className="w-full min-w-[420px] text-left">
              <thead className="sticky top-0">
                <tr>
                  <th scope="col" className={`${TH} w-[120px]`}>NPSN</th>
                  <th scope="col" className={TH}>Nama sekolah</th>
                  <th scope="col" className={`${TH} w-[110px]`}>Marker</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row, index) => (
                  <tr key={`${row.npsn}-${index}`}>
                    <td className={TD}>{row.npsn || EMPTY}</td>
                    <td className={TD}>{row.name || EMPTY}</td>
                    <td className={`${TD} ${row.hasMarker ? 'text-[#126552]' : 'text-[#85520c]'}`}>
                      {row.hasMarker ? 'Ada' : 'Tidak ada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.total > summary.rows.length && (
            <p className="mt-2 text-xs text-[#445665]">
              Menampilkan {summary.rows.length} dari {summary.total} sekolah.
            </p>
          )}
          <div className="mt-5 flex justify-end border-t border-[#d7e1e8] pt-4">
            <button type="button" onClick={() => setShowPreview(false)} className={BTN_OUTLINE}>
              Tutup
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}