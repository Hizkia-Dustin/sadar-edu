import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Database, Search } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import {
  BTN_PRIMARY,
  CARD,
  EMPTY,
  FOCUS,
  PageHeader,
  StatusPill,
  TD,
  TH,
} from '../../components/operator/ui';

const REQUIREMENTS = [
  { title: 'NPSN', text: 'String; nol di depan dipertahankan' },
  { title: 'Identitas', text: 'Nama sekolah wajib' },
  { title: 'Koordinat', text: 'Boleh kosong; invalid tanpa marker' },
  { title: 'Numerik', text: 'Null tidak diubah menjadi 0' },
  { title: 'Provenance', text: 'Sumber, periode, cakupan, lisensi' },
];

const TEMPLATE_ROW = {
  id: 'template',
  name: 'Template skema SADAR EDU',
  source: 'Internal',
  period: EMPTY,
  status: 'Siap digunakan',
};

const PLACEHOLDER_ROW = {
  id: 'placeholder',
  name: 'Belum ada dataset',
  source: EMPTY,
  period: EMPTY,
  status: 'Belum tersedia',
};

const STATUS_FILTERS = ['Draf', 'Perlu perbaikan', 'Siap ditinjau', 'Diajukan', 'Siap digunakan', 'Belum tersedia'];

const STATUS_TONE = {
  'Siap digunakan': 'text-[#126552]',
  'Siap ditinjau': 'text-[#126552]',
  Diajukan: 'text-[#2c6e8e]',
  'Perlu perbaikan': 'text-[#85520c]',
  'Belum tersedia': 'text-[#445665]',
};

export default function OperatorDataset() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const versions = useOperatorStore((state) => state.versions);

  const query = searchParams.get('q') ?? '';
  const [statusFilter, setStatusFilter] = useState('');

  const goToImport = () => navigate('/operator/dataset/impor');

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const fromStore = versions.map((version) => ({
      ...version,
      source: version.source ?? EMPTY,
      period: version.period ?? EMPTY,
    }));
    const all = [...fromStore, ...(versions.length === 0 ? [PLACEHOLDER_ROW] : []), TEMPLATE_ROW];
    return all.filter(
      (row) =>
        (statusFilter === '' || row.status === statusFilter) &&
        `${row.name} ${row.fileName ?? ''} ${row.source} ${row.period} ${row.status}`
          .toLowerCase()
          .includes(keyword)
    );
  }, [versions, query, statusFilter]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Dataset"
        title="Kelola dataset sekolah"
        description="Pilih versi sumber, periksa metadata, lalu mulai impor atau pembaruan."
        action={
          <button type="button" onClick={goToImport} className={`${BTN_PRIMARY} w-[172px]`}>
            Impor / perbarui
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-[620px] flex-1">
          <label htmlFor="cari-dataset" className="sr-only">Cari nama file atau versi dataset</label>
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#445665]"
          />
          <input
            id="cari-dataset"
            type="search"
            placeholder="Cari nama file atau versi dataset"
            value={query}
            onChange={(e) => {
              const nextParams = new URLSearchParams(searchParams);
              if (e.target.value) nextParams.set('q', e.target.value);
              else nextParams.delete('q');
              setSearchParams(nextParams, { replace: true });
            }}
            className={`h-11 w-full rounded-lg border border-[#d7e1e8] bg-white pl-[43px] pr-3 text-xs placeholder:text-[#445665] ${FOCUS}`}
          />
        </div>
        <div>
          <label htmlFor="filter-dataset" className="sr-only">Filter status</label>
          <select
            id="filter-dataset"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`h-[42px] cursor-pointer rounded-lg border border-[#d7e1e8] bg-white px-3 text-sm font-semibold text-[#173042] ${FOCUS}`}
          >
            <option value="">Filter: semua</option>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <StatusPill>Belum terhubung</StatusPill>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="judul-versi" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-versi" className="text-base font-semibold leading-6">Versi dataset</h2>
          <p className="text-xs leading-[18px] text-[#445665]">Riwayat sumber dan status pemrosesan.</p>

          <div
            role="region"
            aria-label="Tabel versi dataset"
            tabIndex={0}
            className={`mt-5 overflow-x-auto ${FOCUS}`}
          >
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} w-[34%]`}>Nama / versi</th>
                  <th scope="col" className={`${TH} w-[23%]`}>Sumber</th>
                  <th scope="col" className={`${TH} w-[18%]`}>Periode</th>
                  <th scope="col" className={`${TH} w-[25%]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={TD}>{row.name}</td>
                    <td className={TD}>{row.source}</td>
                    <td className={TD}>{row.period}</td>
                    <td className={`${TD} ${STATUS_TONE[row.status] ?? ''}`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#445665]">
                Tidak ada versi dataset yang cocok dengan pencarian atau filter ini.
              </p>
            )}
          </div>

          {versions.length === 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-[#d7e1e8] bg-[#edf3f6] p-6">
              <Database size={34} aria-hidden="true" className="shrink-0 text-[#2c6e8e]" />
              <div className="min-w-[200px] flex-1">
                <h3 className="text-base font-semibold leading-6">Hubungkan dataset pertama</h3>
                <p className="text-xs leading-[18px] text-[#445665]">
                  Impor CSV atau XLSX, lalu petakan kolom wajib.
                </p>
              </div>
              <button type="button" onClick={goToImport} className={`${BTN_PRIMARY} w-[170px]`}>
                Mulai impor
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="judul-syarat" className={`${CARD} p-[17px]`}>
          <h2 id="judul-syarat" className="text-base font-semibold leading-6">Persyaratan sumber</h2>
          <p className="text-xs leading-[18px] text-[#445665]">Selesaikan sebelum validasi.</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {REQUIREMENTS.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-3"
              >
                <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#126552]" />
                <span>
                  <span className="block text-sm font-semibold leading-5">{item.title}</span>
                  <span className="block text-[11px] font-medium leading-4 text-[#445665]">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}