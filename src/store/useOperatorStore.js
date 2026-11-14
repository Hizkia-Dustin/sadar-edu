import { create } from 'zustand';
import { EMPTY_PROVENANCE } from '../lib/operatorImport';

// TODO: ganti dengan data dari API backend. Untuk sementara tersimpan di memori
// browser dan hilang saat halaman dimuat ulang.

const fileLabel = (fileName) => fileName.replace(/\.[^.]+$/, '');

function upsertVersion(versions, draft, status, at, provenance) {
  const id = `V-${draft.fileName}`;
  const next = {
    id,
    name: fileLabel(draft.fileName),
    fileName: draft.fileName,
    source: provenance.source.trim() || null,
    period: provenance.period.trim() || null,
    status,
    updatedAt: at,
  };
  return versions.some((version) => version.id === id)
    ? versions.map((version) => (version.id === id ? next : version))
    : [next, ...versions];
}

// Waktu draf dibuat tetap sama selama berkas yang dikerjakan tidak berganti.
const draftTime = (state, draft, at) =>
  state.draft && state.draft.fileName === draft.fileName && state.draftAt ? state.draftAt : at;

export const useOperatorStore = create((set, get) => ({
  versions: [],
  activity: [],
  draft: null,
  draftAt: null,
  validation: null,
  // Usulan perbaikan per temuan. Kunci: `${baris}:${kolom}`.
  corrections: {},
  // Isian provenance dan pengajuan aktif (null bila belum diajukan).
  provenance: EMPTY_PROVENANCE,
  submission: null,

  saveDraft: (draft) => {
    const at = new Date().toISOString();
    set((state) => ({
      draft,
      draftAt: draftTime(state, draft, at),
      submission: null,
      versions: upsertVersion(state.versions, draft, 'Draf', at, state.provenance),
      activity: [
        { id: `A-${Date.now()}`, stage: 'Dataset', text: `Menyimpan draf ${draft.fileName}`, at, status: 'Draf' },
        ...state.activity,
      ],
    }));
  },

  runValidation: (draft, result) => {
    const at = result.ranAt;
    const status = result.needsFixRows > 0 ? 'Perlu perbaikan' : 'Siap ditinjau';
    set((state) => ({
      draft,
      draftAt: draftTime(state, draft, at),
      corrections: {},
      submission: null,
      validation: { ...result, fileName: draft.fileName },
      versions: upsertVersion(state.versions, draft, status, at, state.provenance),
      activity: [
        {
          id: `A-${Date.now()}`,
          stage: 'Validasi',
          text: `Memvalidasi ${draft.fileName}: ${result.passedRows} dari ${result.totalRows} baris lolos`,
          at,
          status: result.needsFixRows > 0 ? 'Perlu perbaikan' : 'Selesai',
        },
        ...state.activity,
      ],
    }));
  },

  setCorrection: (key, correction) => {
    const at = new Date().toISOString();
    set((state) => ({
      corrections: { ...state.corrections, [key]: { ...correction, status: 'Diusulkan' } },
      activity: [
        {
          id: `A-${Date.now()}`,
          stage: 'Perbaikan',
          text: `Mengusulkan perubahan untuk baris ${correction.line}`,
          at,
          status: 'Diusulkan',
        },
        ...state.activity,
      ],
    }));
  },

  // Menulis semua usulan ke baris draf. Mengembalikan draf yang sudah diperbarui.
  applyCorrections: () => {
    const { draft, corrections } = get();
    const pending = Object.entries(corrections).filter(([, item]) => item.status === 'Diusulkan');
    if (!draft || pending.length === 0) return draft;

    const rows = draft.rows.map((row) => row.slice());
    pending.forEach(([, item]) => {
      item.patches.forEach(({ column, value }) => {
        rows[item.line - 2][column] = value;
      });
    });
    const nextDraft = { ...draft, rows };
    const at = new Date().toISOString();

    set((state) => ({
      draft: nextDraft,
      submission: null,
      corrections: Object.fromEntries(
        Object.entries(state.corrections).map(([key, item]) => [
          key,
          item.status === 'Diusulkan' ? { ...item, status: 'Diterapkan' } : item,
        ])
      ),
      activity: [
        {
          id: `A-${Date.now()}`,
          stage: 'Perbaikan',
          text: `Menerapkan ${pending.length} perbaikan pada ${draft.fileName}`,
          at,
          status: 'Diterapkan',
        },
        ...state.activity,
      ],
    }));
    return nextDraft;
  },

  saveProvenance: (values) => {
    const at = new Date().toISOString();
    set((state) => ({
      provenance: values,
      versions: state.draft
        ? state.versions.map((version) =>
            version.fileName === state.draft.fileName
              ? { ...version, source: values.source.trim() || null, period: values.period.trim() || null }
              : version
          )
        : state.versions,
      activity: [
        { id: `A-${Date.now()}`, stage: 'Pengajuan', text: 'Menyimpan draf pengajuan', at, status: 'Draf' },
        ...state.activity,
      ],
    }));
  },

  submitForReview: (values) => {
    const { draft } = get();
    if (!draft) return;
    const at = new Date().toISOString();
    set((state) => ({
      provenance: values,
      submission: { fileName: draft.fileName, submittedAt: at },
      versions: state.versions.map((version) =>
        version.fileName === draft.fileName
          ? {
              ...version,
              source: values.source.trim() || null,
              period: values.period.trim() || null,
              status: 'Diajukan',
              updatedAt: at,
            }
          : version
      ),
      activity: [
        { id: `A-${Date.now()}`, stage: 'Pengajuan', text: `Mengajukan ${draft.fileName} untuk ditinjau`, at, status: 'Diajukan' },
        ...state.activity,
      ],
    }));
  },
}));