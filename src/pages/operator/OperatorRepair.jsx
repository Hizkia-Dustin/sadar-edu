import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, TriangleAlert } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { FIELD_LABELS, validateProposal, validateRows } from '../../lib/operatorImport';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  EMPTY,
  FOCUS,
  PageHeader,
  StatusPill,
  TD,
  TH,
} from '../../components/operator/ui';

const SHOWN_ROWS = 100;

const ERROR_LABEL = {
  'Format NPSN': 'Format NPSN',
  Koordinat: 'Koordinat invalid',
  'Nilai numerik': 'Nilai numerik',
  Identitas: 'Identitas sekolah',
};

const STATUS_TONE = {
  'Belum ditinjau': 'text-[#85520c]',
  Diusulkan: 'text-[#2c6e8e]',
  Diterapkan: 'text-[#126552]',
};

// Baris contoh saat belum ada hasil validasi (mengikuti desain).
const PLACEHOLDER_ROWS = Object.values(ERROR_LABEL);

const editorField = `h-[42px] w-full rounded-md border border-[#d7e1e8] bg-[#edf3f6] px-[11px] text-xs text-[#173042] placeholder:text-[#445665] enabled:bg-white disabled:cursor-not-allowed read-only:cursor-default ${FOCUS}`;

export default function OperatorRepair() {
  const navigate = useNavigate();
  const draft = useOperatorStore((state) => state.draft);
  const validation = useOperatorStore((state) => state.validation);
  const corrections = useOperatorStore((state) => state.corrections);
  const setCorrection = useOperatorStore((state) => state.setCorrection);
  const applyCorrections = useOperatorStore((state) => state.applyCorrections);
  const runValidation = useOperatorStore((state) => state.runValidation);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [proposal, setProposal] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState(null);

  const errors = useMemo(
    () => (validation?.errors ?? []).map((item) => ({ ...item, key: `${item.line}:${item.field}` })),
    [validation]
  );

  const npsnOf = (line) =>
    draft && draft.mapping.npsn !== '' ? (draft.rows[line - 2]?.[Number(draft.mapping.npsn)] ?? '') : '';

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return errors.filter((item) => {
      if (typeFilter !== '' && ERROR_LABEL[item.rule] !== typeFilter) return false;
      if (keyword === '') return true;
      return String(item.line).includes(keyword) || npsnOf(item.line).toLowerCase().includes(keyword);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, query, typeFilter, draft]);

  const selected = errors.find((item) => item.key === selectedKey) ?? null;
  const fieldLabel = selected ? FIELD_LABELS[selected.field] : 'Nilai';
  const pendingCount = Object.values(corrections).filter((item) => item.status === 'Diusulkan').length;

  const handleSelect = (item) => {
    const existing = corrections[item.key];
    setSelectedKey(item.key);
    setProposal(existing?.proposed ?? '');
    setReason(existing?.reason ?? '');
    setMessage(null);
  };

  const handleSaveChange = () => {
    if (!selected) return;
    if (reason.trim() === '') {
      setMessage({ type: 'error', text: 'Isi alasan perubahan sebelum menyimpan.' });
      return;
    }
    const check = validateProposal(selected.field, proposal, draft.mapping);
    if (!check.ok) {
      setMessage({ type: 'error', text: check.message });
      return;
    }
    setCorrection(selected.key, {
      line: selected.line,
      field: selected.field,
      original: selected.value,
      proposed: proposal.trim(),
      reason: reason.trim(),
      patches: check.patches,
    });
    setMessage({ type: 'ok', text: 'Perubahan tersimpan sebagai usulan. Terapkan lewat Simpan perbaikan.' });
  };

  const handleApply = () => {
    applyCorrections();
    setMessage({
      type: 'ok',
      text: `${pendingCount} perbaikan diterapkan ke draf. Jalankan Validasi ulang untuk memeriksa hasilnya.`,
    });
  };

  const handleRevalidate = () => {
    const nextDraft = applyCorrections();
    const result = validateRows(nextDraft.rows, nextDraft.mapping);
    runValidation(nextDraft, result);
    setSelectedKey('');
    setProposal('');
    setReason('');
    setMessage({
      type: 'ok',
      text: `Validasi ulang selesai: ${result.passedRows} dari ${result.totalRows} baris lolos.`,
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow="Perbaikan"
        title="Daftar error dan perbaikan"
        description="Perbaiki nilai sumber tanpa menghapus rekaman sekolah."
        action={
          <button
            type="button"
            onClick={handleApply}
            disabled={pendingCount === 0}
            className={`${BTN_OUTLINE} w-[172px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Simpan perbaikan
          </button>
        }
      />

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-xs leading-[18px] ${
            message.type === 'error' ? 'bg-[#fff0f0] text-[#a12b31]' : 'bg-[#e8f3f0] text-[#126552]'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_386px]">
        <section aria-labelledby="judul-antrean" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-antrean" className="text-base font-semibold leading-6">Antrean error</h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <label htmlFor="cari-error" className="sr-only">Cari baris atau NPSN</label>
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[#445665]"
              />
              <input
                id="cari-error"
                type="search"
                placeholder="Cari baris atau NPSN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!validation}
                className={`h-10 w-full rounded-lg border border-[#d7e1e8] bg-[#f9fafb] pl-[39px] pr-3 text-xs placeholder:text-[#445665] disabled:cursor-not-allowed ${FOCUS}`}
              />
            </div>
            <div>
              <label htmlFor="filter-error" className="sr-only">Filter jenis error</label>
              <select
                id="filter-error"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={!validation}
                className={`h-[42px] cursor-pointer rounded-lg border border-[#d7e1e8] bg-white px-3 text-sm font-semibold text-[#173042] disabled:cursor-not-allowed ${FOCUS}`}
              >
                <option value="">Filter: semua</option>
                {PLACEHOLDER_ROWS.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
            <StatusPill>Hasil {validation ? filtered.length : EMPTY}</StatusPill>
          </div>

          <div
            role="region"
            aria-label="Tabel antrean error"
            tabIndex={0}
            className={`mt-4 overflow-x-auto ${FOCUS}`}
          >
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} w-[13%]`}>Baris</th>
                  <th scope="col" className={`${TH} w-[26%]`}>Jenis error</th>
                  <th scope="col" className={`${TH} w-[31%]`}>Nilai sumber</th>
                  <th scope="col" className={`${TH} w-[30%]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {!validation &&
                  PLACEHOLDER_ROWS.map((label) => (
                    <tr key={label}>
                      <td className={TD}>{EMPTY}</td>
                      <td className={`${TD} text-sm font-semibold`}>{label}</td>
                      <td className={`${TD} text-[#445665]`}>Belum tersedia</td>
                      <td className={`${TD} text-[#85520c]`}>Belum ditinjau</td>
                    </tr>
                  ))}
                {validation &&
                  filtered.slice(0, SHOWN_ROWS).map((item) => {
                    const status = corrections[item.key]?.status ?? 'Belum ditinjau';
                    const isSelected = item.key === selectedKey;
                    return (
                      <tr key={item.key} className={isSelected ? 'bg-[#e8f3f0]' : undefined}>
                        <td className={TD}>{item.line}</td>
                        <td className={TD}>
                          <button
                            type="button"
                            onClick={() => handleSelect(item)}
                            aria-pressed={isSelected}
                            aria-label={`Pilih temuan baris ${item.line}: ${ERROR_LABEL[item.rule]}`}
                            className={`cursor-pointer rounded text-left text-sm font-semibold text-[#173042] underline-offset-2 hover:underline ${FOCUS}`}
                          >
                            {ERROR_LABEL[item.rule]}
                          </button>
                        </td>
                        <td className={`${TD} break-all text-[#445665]`}>
                          {item.value === '' ? '(kosong)' : item.value}
                        </td>
                        <td className={`${TD} ${STATUS_TONE[status]}`}>{status}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {validation && errors.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#445665]">
                Tidak ada error pada validasi terakhir.
              </p>
            )}
            {validation && errors.length > 0 && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#445665]">
                Tidak ada temuan yang cocok dengan pencarian atau filter ini.
              </p>
            )}
          </div>

          {validation && filtered.length > SHOWN_ROWS && (
            <p className="mt-2 text-xs text-[#445665]">
              Menampilkan {SHOWN_ROWS} dari {filtered.length} temuan. Persempit dengan pencarian atau filter.
            </p>
          )}

          {!validation && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-[#edf3f6] p-4">
              <p className="min-w-[200px] flex-1 text-xs leading-[18px] text-[#445665]">
                Belum ada hasil validasi. Jalankan validasi dulu, lalu temuannya muncul di sini.
              </p>
              <button type="button" onClick={() => navigate('/operator/validasi')} className={BTN_PRIMARY}>
                Ke halaman validasi
              </button>
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#fff5e3] p-4">
            <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[#85520c]" />
            <div>
              <p className="text-sm font-semibold leading-5 text-[#85520c]">
                Koordinat invalid tidak menghapus sekolah
              </p>
              <p className="mt-1 text-[11px] font-medium leading-4 text-[#445665]">
                Rekaman tetap tersedia di daftar; hanya marker yang tidak ditampilkan.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="judul-editor" className={`${CARD} p-[17px]`}>
          <h2 id="judul-editor" className="text-base font-semibold leading-6">Editor nilai</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            Pilih satu temuan untuk melihat nilai saat ini dan usulan.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <div>
              <label htmlFor="nilai-saat-ini" className="mb-1.5 block text-[11px] font-medium text-[#445665]">
                {fieldLabel} saat ini
              </label>
              <input
                id="nilai-saat-ini"
                type="text"
                readOnly
                value={selected ? (selected.value === '' ? '(kosong)' : selected.value) : EMPTY}
                className={editorField}
              />
            </div>
            <div>
              <label htmlFor="usulan-nilai" className="mb-1.5 block text-[11px] font-medium text-[#445665]">
                Usulan {fieldLabel === 'Nilai' ? 'nilai' : fieldLabel}
              </label>
              <input
                id="usulan-nilai"
                type="text"
                disabled={!selected}
                placeholder="Belum diisi"
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                className={editorField}
              />
            </div>
            <div>
              <label htmlFor="alasan-perubahan" className="mb-1.5 block text-[11px] font-medium text-[#445665]">
                Alasan perubahan
              </label>
              <input
                id="alasan-perubahan"
                type="text"
                disabled={!selected}
                placeholder="Belum diisi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={editorField}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#edf3f6] p-4">
              <FileText size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#445665]" />
              <div>
                <p className="text-sm font-semibold leading-5">Bukti pendukung</p>
                <p className="mt-1 text-xs leading-[18px] text-[#445665]">Lampiran belum tersedia</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSaveChange}
                disabled={!selected}
                className={`${BTN_OUTLINE} w-full whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Simpan perubahan
              </button>
              <button
                type="button"
                onClick={handleRevalidate}
                disabled={!draft}
                className={`${BTN_PRIMARY} w-full whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Validasi ulang
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}