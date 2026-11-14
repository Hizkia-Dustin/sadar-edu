/**
 * ============================================================================
 * STORE: useOperatorStore (Zustand)
 * ============================================================================
 * State management pusat untuk modul Operator data SADAR-EDU:
 * 1. Mengelola riwayat multi-versi dataset di database PostgreSQL (Port 5000).
 * 2. Mengelola proses impor berkas CSV/XLSX, auto-mapping, dan validasi data.
 * 3. Menyediakan fungsi edit cepat satuan sekolah (PUT /sekolah/:id).
 * 4. Menyediakan fungsi ekspor data aktif ke CSV dan GeoJSON.
 * 5. Mengatur aktivasi/nonaktifkan dataset dan penghapusan dataset usang.
 * ============================================================================
 */

import { create } from 'zustand';
import { api } from '../lib/api';
import { EMPTY_PROVENANCE } from '../lib/operatorImport';
import { useDataStore } from './useDataStore';

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

  // Memuat riwayat dataset aktual dari database backend PostgreSQL
  fetchDatasets: async () => {
    try {
      const res = await api.get('/dataset');
      const list = res?.data || [];
      const mapped = list.map((item) => ({
        id: `DB-${item.id_dataset}`,
        id_dataset: item.id_dataset,
        name: item.nama_dataset,
        fileName: `${item.nama_dataset}.${(item.format || 'geojson').toLowerCase()}`,
        source: item.sumber || 'Database PostgreSQL Server',
        period: String(item.tahun || '2026'),
        status: item.status_validasi === 'Valid' ? 'Siap digunakan' : (item.status_validasi || 'Siap ditinjau'),
        updatedAt: item.created_at,
        format: item.format,
        kategori: item.kategori,
        aktif: item.aktif,
        jumlah_fitur: item.jumlah_fitur,
      }));

      set((state) => {
        // Gabungkan versi dari backend dengan draf lokal yang belum disimpan ke DB
        const localOnly = state.versions.filter((v) => !v.id?.startsWith('DB-'));
        return { versions: [...localOnly, ...mapped] };
      });
      return mapped;
    } catch {
      return [];
    }
  },

  // Memuat 617 data sekolah server dari PostGIS sebagai dataset aktif untuk divalidasi/dikelola
  loadServerSchoolsAsDraft: async () => {
    try {
      const res = await api.get('/sekolah/geojson');
      const features = res?.data?.features || res?.features || [];
      if (features.length === 0) return null;

      // Konversi format GeoJSON FeatureCollection ke baris draf tabular
      const headers = ['NPSN', 'Nama Sekolah', 'Jenjang', 'Status', 'Kecamatan', 'Latitude', 'Longitude', 'Jumlah Siswa'];
      const rows = features.map((f) => {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        return [
          p.npsn || '',
          p.nama_sekolah || p.nama || '',
          p.jenjang || 'SMP',
          p.status_sekolah || 'Negeri',
          p.nama_wilayah || '',
          String(coords[1] || ''),
          String(coords[0] || ''),
          String(p.jumlah_siswa || ''),
        ];
      });

      const draft = {
        fileName: 'Sekolah_Aktif_PostgreSQL_Kabupaten_Bogor.csv',
        fileSize: features.length * 128,
        headers,
        rows,
        mapping: {
          npsn: 0,
          name: 1,
          stage: 2,
          status: 3,
          district: 4,
          lat: 5,
          lng: 6,
          students: 7,
        },
      };

      const at = new Date().toISOString();
      set((state) => ({
        draft,
        draftAt: at,
        submission: null,
        provenance: {
          source: 'Database Spasial PostGIS SadarEdu Kabupaten Bogor',
          period: '2026',
          coverage: 'Kabupaten Bogor (40 Kecamatan)',
          license: 'Data Resmi Dinas Pendidikan / Terbuka',
          attribution: 'Dinas Pendidikan & BPS Kab. Bogor',
          note: 'Sinkronisasi langsung dari tabel sekolah PostgreSQL',
        },
      }));

      return draft;
    } catch {
      return null;
    }
  },

  syncDraftToBackend: async () => {
    const { draft, provenance } = get();
    if (!draft) return { success: false, message: 'Belum ada draf dataset untuk disinkronkan.' };

    const isWilayah = draft.kategori === 'wilayah';
    let importPayload;
    let itemCount = 0;

    if (draft.rawGeoJson) {
      itemCount = draft.rawGeoJson.features?.length || draft.rows?.length || 0;
      importPayload = {
        kategori: draft.kategori || 'sekolah',
        nama_dataset: draft.fileName,
        sumber: provenance?.source?.trim() || (isWilayah ? 'BPS / Pemkab Bogor' : 'Dinas Pendidikan Kab. Bogor'),
        tahun: parseInt(provenance?.period, 10) || (isWilayah ? 2024 : new Date().getFullYear()),
        format: 'geojson',
        data: draft.rawGeoJson,
        hitung_ulang: true,
      };
    } else {
      const read = (row, key) =>
        draft.mapping?.[key] == null || draft.mapping[key] === ''
          ? ''
          : String(row[Number(draft.mapping[key])] ?? '').trim();

      const payloadRows = (draft.rows || []).map((row, index) => {
        const lat = Number(read(row, 'lat').replace(',', '.'));
        const lng = Number(read(row, 'lng').replace(',', '.'));
        return {
          npsn: read(row, 'npsn') || null,
          nama_sekolah: read(row, 'name') || `Sekolah ${index + 1}`,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          jenjang: read(row, 'stage') || 'SMP',
          status_sekolah: read(row, 'status') || 'Negeri',
          jumlah_siswa: Number(read(row, 'students')) || 0,
        };
      });
      itemCount = payloadRows.length;
      importPayload = {
        kategori: 'sekolah',
        nama_dataset: draft.fileName,
        sumber: provenance?.source?.trim() || 'Draf Operator SADAR EDU',
        tahun: parseInt(provenance?.period, 10) || new Date().getFullYear(),
        format: 'tabel',
        data: payloadRows,
        hitung_ulang: true,
      };
    }

    try {
      const res = await api.post('/dataset/import', importPayload);

      const at = new Date().toISOString();
      const entityName = isWilayah ? 'wilayah kecamatan' : 'sekolah';
      set((state) => ({
        versions: state.versions.map((version) =>
          version.fileName === draft.fileName
            ? { ...version, status: 'Tersimpan ke Server', updatedAt: at }
            : version
        ),
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Database',
            text: `Sinkronisasi ${draft.fileName} ke database PostgreSQL/PostGIS berhasil (${itemCount} ${entityName}).`,
            at,
            status: 'Tersimpan',
          },
          ...state.activity,
        ],
      }));

      // Segarkan daftar dataset dari backend
      get().fetchDatasets();

      // Segarkan data peta publik langsung di memori Zustand
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}

      return {
        success: true,
        message: `Berhasil menyimpan ${itemCount} data ${entityName} ke database PostgreSQL/PostGIS.`,
        data: res,
      };
    } catch (err) {
      return {
        success: false,
        message: err?.message || 'Gagal menyimpan ke server backend. Pastikan server PostgreSQL aktif.',
      };
    }
  },

  syncToDatabase: async () => {
    return get().syncDraftToBackend();
  },

  toggleDatasetActive: async (id_dataset, nextAktif) => {
    try {
      const res = await api.patch(`/dataset/${id_dataset}`, { aktif: nextAktif });
      set((state) => ({
        versions: state.versions.map((v) =>
          v.id_dataset === id_dataset
            ? { ...v, aktif: nextAktif, status: nextAktif ? 'Siap digunakan' : 'Nonaktif' }
            : v
        ),
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Dataset',
            text: `Status dataset #${id_dataset} diubah menjadi ${nextAktif ? 'Aktif' : 'Nonaktif'}.`,
            at: new Date().toISOString(),
            status: nextAktif ? 'Aktif' : 'Nonaktif',
          },
          ...state.activity,
        ],
      }));
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}
      return { success: true, data: res?.data };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal mengubah status aktif dataset.' };
    }
  },

  searchSchools: async (query) => {
    try {
      const res = await api.get('/sekolah/geojson', { q: query });
      const features = res?.data?.features || res?.features || [];
      return features.map((f) => ({
        id_sekolah: f.properties?.id_sekolah || f.id,
        npsn: f.properties?.npsn || '',
        nama_sekolah: f.properties?.nama_sekolah || '',
        status_sekolah: f.properties?.status_sekolah || 'Negeri',
        jenjang: f.properties?.jenjang || 'SMP',
        alamat: f.properties?.alamat || '',
        nama_wilayah: f.properties?.nama_wilayah || '',
        latitude: f.geometry?.coordinates?.[1] ?? null,
        longitude: f.geometry?.coordinates?.[0] ?? null,
        jumlah_siswa: f.properties?.jumlah_siswa ?? 0,
        foto_url: f.properties?.foto_url || '',
      }));
    } catch {
      return [];
    }
  },

  createSingleSchool: async (payload) => {
    try {
      const res = await api.post('/sekolah', payload);
      const at = new Date().toISOString();
      set((state) => ({
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Data Baru',
            text: `Sekolah "${payload.nama_sekolah}" (NPSN: ${payload.npsn}) berhasil ditambahkan ke database.`,
            at,
            status: 'Ditambahkan',
          },
          ...state.activity,
        ],
      }));
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}
      return { success: true, message: `Sekolah "${payload.nama_sekolah}" berhasil ditambahkan.`, data: res?.data };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal menambahkan sekolah baru.' };
    }
  },

  deleteSingleSchool: async (id_sekolah, schoolName = '') => {
    try {
      const res = await api.del(`/sekolah/${id_sekolah}`);
      const at = new Date().toISOString();
      set((state) => ({
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Hapus Data',
            text: `Sekolah "${schoolName || id_sekolah}" berhasil dihapus dari database.`,
            at,
            status: 'Dihapus',
          },
          ...state.activity,
        ],
      }));
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}
      return { success: true, message: `Sekolah ${schoolName || ''} berhasil dihapus dari database.`, data: res?.data };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal menghapus sekolah dari database.' };
    }
  },

  updateSingleSchool: async (id_sekolah, payload) => {
    try {
      const res = await api.put(`/sekolah/${id_sekolah}`, payload);
      const at = new Date().toISOString();
      set((state) => ({
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Perubahan Data',
            text: `Sekolah "${payload.nama_sekolah || id_sekolah}" berhasil diperbarui langsung di database.`,
            at,
            status: 'Tersimpan',
          },
          ...state.activity,
        ],
      }));
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}
      return { success: true, message: `Data sekolah "${payload.nama_sekolah}" berhasil disimpan ke database.`, data: res?.data };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal memperbarui sekolah di database.' };
    }
  },

  deleteDatasetById: async (id_dataset) => {
    try {
      const res = await api.del(`/dataset/${id_dataset}`);
      set((state) => ({
        versions: state.versions.filter((v) => v.id_dataset !== id_dataset),
        activity: [
          {
            id: `A-${Date.now()}`,
            stage: 'Dataset',
            text: `Dataset #${id_dataset} berhasil dihapus dari database.`,
            at: new Date().toISOString(),
            status: 'Dihapus',
          },
          ...state.activity,
        ],
      }));
      try {
        useDataStore.setState({ loaded: false });
        useDataStore.getState().loadPublic();
      } catch {}
      return { success: true, message: 'Dataset berhasil dihapus dari database.', data: res?.data };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal menghapus dataset dari database.' };
    }
  },

  exportDataAsCsv: async () => {
    try {
      const res = await api.get('/sekolah/geojson');
      const features = res?.data?.features || res?.features || [];
      if (features.length === 0) return { success: false, message: 'Tidak ada data sekolah untuk diekspor.' };

      const headers = ['NPSN', 'Nama Sekolah', 'Jenjang', 'Status', 'Kecamatan', 'Latitude', 'Longitude', 'Jumlah Siswa'];
      const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

      const rows = features.map((f) => {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        return [
          escape(p.npsn || ''),
          escape(p.nama_sekolah || ''),
          escape(p.jenjang || 'SMP'),
          escape(p.status_sekolah || 'Negeri'),
          escape(p.nama_wilayah || ''),
          coords[1] || '',
          coords[0] || '',
          p.jumlah_siswa || 0,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SADAR_EDU_Sekolah_Kabupaten_Bogor_${now}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, count: features.length };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal mengekspor data CSV.' };
    }
  },

  exportDataAsGeoJson: async () => {
    try {
      const res = await api.get('/sekolah/geojson');
      const geojson = res?.data || res;
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
      const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SADAR_EDU_Sekolah_Kabupaten_Bogor_${now}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || 'Gagal mengekspor GeoJSON.' };
    }
  },
}));
