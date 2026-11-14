import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { isProvenanceComplete, validateRows } from '../../lib/operatorImport';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  EMPTY,
  FOCUS,
  MetricCard,
  PageHeader,
  TD,
  TH,
  formatTimestamp,
} from '../../components/operator/ui';

// Aturan dan ketentuan tampil sejak awal; angka terdampak menyusul setelah validasi.
const DEFAULT_FINDINGS = [
  { rule: 'Format NPSN', provision: 'String dan panjang karakter', affected: null },
  { rule: 'Koordinat', provision: 'Invalid tetap di daftar', affected: null },
  { rule: 'Nilai numerik', provision: 'Null tidak menjadi 0', affected: null },
  { rule: 'Identitas', provision: 'Nama dan NPSN wajib', affected: null },
];

const DEFAULT_GATES = [
  { name: 'Identitas', status: 'Menunggu' },
  { name: 'Koordinat', status: 'Menunggu' },
  { name: 'Nilai numerik', status: 'Menunggu' },
  { name: 'Provenance', status: 'Menunggu' },
];

const GATE_TONE = {
  Lulus: 'text-[#126552]',
  'Perlu perbaikan': 'text-[#85520c]',
  Menunggu: 'text-[#445665]',
};

export default function OperatorValidation() {
  const navigate = useNavigate();
  const draft = useOperatorStore((state) => state.draft);
  const validation = useOperatorStore((state) => state.validation);
  const runValidation = useOperatorStore((state) => state.runValidation);
  const provenance = useOperatorStore((state) => state.provenance);

  const hasResult = Boolean(validation);
  const findings = validation?.findings ?? DEFAULT_FINDINGS;
  // Gerbang Provenance mengikuti isian di halaman Review pengajuan.
  const gates = (validation?.gates ?? DEFAULT_GATES).map((gate) =>
    gate.name === 'Provenance'
      ? { ...gate, status: isProvenanceComplete(provenance) ? 'Lulus' : 'Menunggu' }
      : gate
  );

  const handleRerun = () => {
    runValidation(draft, validateRows(draft.rows, draft.mapping));
  };

  const metrics = [
    {
      label: 'Baris diperiksa',
      value: hasResult ? validation.totalRows : EMPTY,
      note: hasResult ? 'Dari validasi terakhir' : 'Belum tersedia',
      accent: 'bg-[#1b4965]',
    },
    {
      label: 'Lolos aturan',
      value: hasResult ? validation.passedRows : EMPTY,
      note: hasResult ? 'Dari validasi terakhir' : 'Belum tersedia',
      accent: 'bg-[#126552]',
    },
    {
      label: 'Perlu perbaikan',
      value: hasResult ? validation.needsFixRows : EMPTY,
      note: hasResult ? 'Dari validasi terakhir' : 'Belum tersedia',
      accent: 'bg-[#85520c]',
    },
    {
      label: 'Tanpa marker',
      value: hasResult ? validation.noMarkerRows : EMPTY,
      note: 'Koordinat kosong atau invalid',
      accent: 'bg-[#2c6e8e]',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Langkah 3"
        title="Hasil validasi dataset"
        description="Tinjau aturan wajib dan pilih jalur perbaikan atau review."
        action={
          <button
            type="button"
            onClick={handleRerun}
            disabled={!draft}
            className={`${BTN_OUTLINE} w-[172px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Jalankan ulang
          </button>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_316px]">
        <section aria-labelledby="judul-temuan" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-temuan" className="text-base font-semibold leading-6">Temuan validasi</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            {hasResult
              ? `Hasil dari ${validation.fileName}, dijalankan ${formatTimestamp(validation.ranAt)}.`
              : 'Daftar aktual muncul setelah proses selesai.'}
          </p>

          <div
            role="region"
            aria-label="Tabel temuan validasi"
            tabIndex={0}
            className={`mt-5 overflow-x-auto ${FOCUS}`}
          >
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} w-[30%]`}>Aturan</th>
                  <th scope="col" className={`${TH} w-[45%]`}>Ketentuan</th>
                  <th scope="col" className={`${TH} w-[25%]`}>Terdampak</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.rule}>
                    <th scope="row" className={`${TD} text-sm font-semibold`}>{finding.rule}</th>
                    <td className={`${TD} text-[#445665]`}>{finding.provision}</td>
                    <td
                      className={`${TD} text-base font-semibold ${
                        finding.affected === 0 ? 'text-[#126552]' : 'text-[#85520c]'
                      }`}
                    >
                      {finding.affected ?? EMPTY}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasResult && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-[#edf3f6] p-4">
              <p className="min-w-[200px] flex-1 text-xs leading-[18px] text-[#445665]">
                Belum ada hasil. Impor dan petakan dataset terlebih dahulu, lalu jalankan validasi.
              </p>
              <button
                type="button"
                onClick={() => navigate('/operator/dataset/impor')}
                className={BTN_PRIMARY}
              >
                Ke halaman impor
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="judul-gerbang" className={`${CARD} p-[17px]`}>
          <h2 id="judul-gerbang" className="text-base font-semibold leading-6">Gerbang validasi</h2>
          <ul className="mt-5 flex flex-col gap-2.5">
            {gates.map((gate) => (
              <li
                key={gate.name}
                className="flex h-[62px] items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] px-[11px]"
              >
                <ShieldCheck
                  size={18}
                  aria-hidden="true"
                  className={`shrink-0 ${GATE_TONE[gate.status]}`}
                />
                <span>
                  <span className="block text-sm font-semibold leading-5">{gate.name}</span>
                  <span className={`block text-[11px] font-medium leading-4 ${GATE_TONE[gate.status]}`}>
                    {gate.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p id="catatan-review" className="mr-auto text-xs leading-[18px] text-[#445665]">
          {hasResult && validation.needsFixRows > 0
            ? 'Masih ada baris yang perlu perbaikan. Pengajuan terkunci sampai semuanya lolos.'
            : 'Lengkapi provenance dan atribusi di halaman review sebelum mengajukan.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/operator/validasi/perbaikan')}
          disabled={!hasResult || validation.errorsTotal === 0}
          className={`${BTN_OUTLINE} w-[198px] disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Tinjau daftar error
        </button>
        <button
          type="button"
          onClick={() => navigate('/operator/pengajuan')}
          disabled={!hasResult}
          aria-describedby="catatan-review"
          className={`${BTN_PRIMARY} w-[212px] disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Lanjut ke review
        </button>
      </div>
    </div>
  );
}