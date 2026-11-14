import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { PROVENANCE_FIELDS, getSubmissionGates } from '../../lib/operatorImport';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  FOCUS,
  PageHeader,
  StatusPill,
  formatTimestamp,
} from '../../components/operator/ui';

const FULL_WIDTH = ['attribution', 'note'];

const fieldClass = `w-full rounded-md border border-[#d7e1e8] bg-[#edf3f6] px-[11px] text-xs text-[#173042] placeholder:text-[#445665] disabled:cursor-not-allowed disabled:text-[#445665] ${FOCUS}`;

export default function OperatorReview() {
  const navigate = useNavigate();
  const draft = useOperatorStore((state) => state.draft);
  const validation = useOperatorStore((state) => state.validation);
  const savedProvenance = useOperatorStore((state) => state.provenance);
  const submission = useOperatorStore((state) => state.submission);
  const saveProvenance = useOperatorStore((state) => state.saveProvenance);
  const submitForReview = useOperatorStore((state) => state.submitForReview);

  const [values, setValues] = useState(savedProvenance);
  const [message, setMessage] = useState('');

  const submitted = Boolean(submission && draft && submission.fileName === draft.fileName);
  const gates = getSubmissionGates({ draft, validation, provenance: values });
  const locked = gates.some((gate) => !gate.passed);

  const pill = submitted
    ? { tone: 'success', text: 'Diajukan' }
    : locked
      ? { tone: 'error', text: 'Terkunci' }
      : { tone: 'success', text: 'Terbuka' };

  const handleSaveDraft = () => {
    saveProvenance(values);
    setMessage('Draf pengajuan tersimpan di sesi ini.');
  };

  const handleSubmit = () => {
    submitForReview(values);
    setMessage('');
    navigate('/operator/pengajuan/status');
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Langkah 4"
        title="Review dan ajukan pembaruan"
        description="Pastikan metadata, validasi, bukti, dan atribusi lengkap."
        action={
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitted}
            className={`${BTN_OUTLINE} w-[172px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Simpan draf
          </button>
        }
      />

      {submitted && (
        <p role="status" className="rounded-lg bg-[#e8f3f0] px-4 py-3 text-xs leading-[18px] text-[#126552]">
          Pengajuan {submission.fileName} terkirim pada {formatTimestamp(submission.submittedAt)}. Menunggu
          peninjauan Dinas. Mengubah data atau memvalidasi ulang membatalkan pengajuan ini.
        </p>
      )}
      {message && !submitted && (
        <p role="status" className="rounded-lg bg-[#e8f3f0] px-4 py-3 text-xs leading-[18px] text-[#126552]">
          {message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_386px]">
        <section aria-labelledby="judul-provenance" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-provenance" className="text-base font-semibold leading-6">Provenance dataset</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            Informasi ini akan ditampilkan pada halaman publik.
          </p>

          <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {PROVENANCE_FIELDS.map((field) => (
              <div key={field.key} className={FULL_WIDTH.includes(field.key) ? 'sm:col-span-2' : undefined}>
                <label
                  htmlFor={`prov-${field.key}`}
                  className="mb-1.5 block text-[11px] font-medium text-[#445665]"
                >
                  {field.label}
                </label>
                {field.key === 'note' ? (
                  <textarea
                    id="prov-note"
                    rows={2}
                    disabled={submitted}
                    placeholder="Jelaskan perubahan utama"
                    value={values.note}
                    onChange={(e) => setValues({ ...values, note: e.target.value })}
                    className={`${fieldClass} min-h-[42px] resize-y py-[11px]`}
                  />
                ) : (
                  <input
                    id={`prov-${field.key}`}
                    type="text"
                    disabled={submitted}
                    aria-required={field.required}
                    placeholder="Belum diisi"
                    value={values[field.key]}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    className={`${fieldClass} h-[42px]`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#e8f3f0] p-4">
            <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#126552]" />
            <div>
              <p className="text-sm font-semibold leading-5 text-[#126552]">Review privasi dan izin publik</p>
              <p className="mt-1 text-xs leading-[18px] text-[#445665]">
                Pastikan hanya field yang diizinkan masuk ke rilis publik.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="judul-gerbang-ajuan" className={`${CARD} p-[17px]`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="judul-gerbang-ajuan" className="text-base font-semibold leading-6">Gerbang pengajuan</h2>
            <StatusPill tone={pill.tone}>{pill.text}</StatusPill>
          </div>

          <ul className="mt-5 flex flex-col gap-2.5">
            {gates.map((gate) => {
              const Icon = gate.passed ? LockOpen : Lock;
              return (
                <li
                  key={gate.name}
                  className="flex min-h-[64px] items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] px-[11px] py-2"
                >
                  <Icon
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 ${gate.passed ? 'text-[#126552]' : 'text-[#a12b31]'}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5">{gate.name}</span>
                    <span
                      className={`block break-words text-[11px] font-medium leading-4 ${
                        gate.passed ? 'text-[#126552]' : 'text-[#a12b31]'
                      }`}
                    >
                      {gate.passed ? 'Sudah' : 'Belum'}
                      {gate.detail ? `: ${gate.detail}` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={locked || submitted}
            aria-describedby="catatan-kirim"
            className={`${BTN_PRIMARY} mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {submitted ? 'Sudah diajukan' : 'Kirim untuk ditinjau'}
          </button>
          <p id="catatan-kirim" className="mt-3 text-[11px] font-medium leading-4 text-[#445665]">
            Belum terhubung ke server. Pengajuan hanya tercatat di sesi ini.
          </p>
          <button
            type="button"
            onClick={() => navigate('/operator/pengajuan/status')}
            className={`${BTN_OUTLINE} mt-4 w-full`}
          >
            Lihat preview dan status
          </button>
        </section>
      </div>
    </div>
  );
}