import { Check, ShieldCheck } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { summarizePreview } from '../../lib/operatorImport';
import SchematicMap from '../../components/operator/SchematicMap';
import { BTN_OUTLINE, CARD, EMPTY, PageHeader, TD, TH } from '../../components/operator/ui';

const DEFINITION = [
  { label: 'Nama field', value: 'latitude / longitude' },
  { label: 'Tipe', value: 'Koordinat desimal atau null' },
  { label: 'Aturan publik', value: 'Marker hanya untuk koordinat valid' },
];

const QUALITY_RULES = [
  { title: 'Rentang koordinat', text: 'Harus berada pada rentang yang valid' },
  { title: 'Nilai kosong', text: 'Sekolah tetap tampil di daftar' },
  { title: 'Koordinat invalid', text: 'Tidak membuat marker peta' },
];

const LIST_LIMIT = 5;

export default function OperatorIndicator() {
  const draft = useOperatorStore((state) => state.draft);
  const summary = draft ? summarizePreview(draft, LIST_LIMIT) : null;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Indikator"
        title="Lokasi sekolah"
        description="Definisi, aturan validasi, serta tampilan peta dan daftar."
        action={
          // Daftar indikator belum punya halaman, jadi tombol ini nonaktif.
          <button
            type="button"
            disabled
            title="Segera hadir"
            className={`${BTN_OUTLINE} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Kembali ke indikator
            <span className="sr-only">, segera hadir</span>
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[5fr_6fr]">
        <section aria-labelledby="judul-definisi" className={`${CARD} p-[17px]`}>
          <h2 id="judul-definisi" className="text-base font-semibold leading-6">Definisi indikator</h2>
          <dl className="mt-5 flex flex-col gap-3">
            {DEFINITION.map((item) => (
              <div key={item.label} className="flex flex-col-reverse gap-1.5">
                <dd className="flex min-h-[42px] items-center rounded-md border border-[#d7e1e8] bg-[#edf3f6] px-[11px] text-xs">
                  {item.value}
                </dd>
                <dt className="text-[11px] font-medium leading-4 text-[#445665]">{item.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="judul-kualitas" className={`${CARD} p-[17px]`}>
          <h2 id="judul-kualitas" className="text-base font-semibold leading-6">Aturan kualitas</h2>
          <ul className="mt-5 flex flex-col gap-2.5">
            {QUALITY_RULES.map((rule) => (
              <li
                key={rule.title}
                className="flex min-h-[58px] items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] px-[11px] py-2"
              >
                <ShieldCheck size={18} aria-hidden="true" className="shrink-0 text-[#126552]" />
                <span>
                  <span className="block text-sm font-semibold leading-5">{rule.title}</span>
                  <span className="block text-[11px] font-medium leading-4 text-[#445665]">{rule.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_366px]">
        <section aria-labelledby="judul-peta" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-peta" className="text-base font-semibold leading-6">Preview peta</h2>
          <p className="text-[11px] font-medium leading-4 text-[#445665]">
            Peta skematis &bull; tanpa data nyata
          </p>
          <div className="mt-5 overflow-hidden rounded-lg">
            <SchematicMap />
          </div>
        </section>

        <section aria-labelledby="judul-daftar" className={`${CARD} p-[17px]`}>
          <h2 id="judul-daftar" className="text-base font-semibold leading-6">Tampilan daftar setara</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            Lokasi tidak boleh menjadi satu-satunya cara menemukan sekolah.
          </p>

          <table className="mt-5 w-full text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-[58%]`}>Sekolah</th>
                <th scope="col" className={TH}>Lokasi</th>
              </tr>
            </thead>
            <tbody>
              {summary ? (
                summary.rows.map((row, index) => (
                  <tr key={`${row.npsn}-${index}`}>
                    <td className={`${TD} break-words`}>{row.name || row.npsn || EMPTY}</td>
                    <td className={`${TD} ${row.hasMarker ? 'text-[#126552]' : 'text-[#445665]'}`}>
                      {row.hasMarker ? 'Ada marker' : 'Tanpa marker'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={TD}>Belum ada data</td>
                  <td className={TD}>{EMPTY}</td>
                </tr>
              )}
            </tbody>
          </table>
          {summary && summary.total > summary.rows.length && (
            <p className="mt-2 text-[11px] font-medium leading-4 text-[#445665]">
              Menampilkan {summary.rows.length} dari {summary.total} sekolah.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#e8f3f0] p-4">
            <Check size={18} aria-hidden="true" className="shrink-0 text-[#126552]" />
            <p className="text-xs leading-[18px] text-[#1b4965]">
              Tanpa koordinat tetap tersedia di daftar.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}