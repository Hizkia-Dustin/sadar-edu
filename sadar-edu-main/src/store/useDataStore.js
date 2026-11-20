import { create } from 'zustand';
import { api } from '../lib/api';
import { initialWeights, mapSchoolFeature } from '../lib/analysis';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const msg = (e) => (e && e.message) || 'Terjadi kesalahan.';

/**
 * Data dari backend yang dipakai peta publik & dashboard.
 * Bobot MCDA (persen) disimpan di sini agar slider memperbarui peta secara langsung.
 */
export const useDataStore = create((set, get) => ({
  kecamatan: [], // [{ id, name, lng, lat, bbox }]
  sekolah: EMPTY_FC,
  prioritas: EMPTY_FC,
  meta: null, // { tahun, sudah_dihitung, radius_km, indikator[], parameter, kategori[] }
  ringkasan: null,
  blankSpots: EMPTY_FC,
  coverage: EMPTY_FC,
  candidates: EMPTY_FC,
  weights: {},
  savedWeights: {},

  loading: false,
  loaded: false,
  error: null,

  /** Data publik: kecamatan, sekolah, prioritas, blank spot, ringkasan */
  loadPublic: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [wil, sek, pri, blank, cov, ring] = await Promise.all([
        api.get('/wilayah/list', { level: 'Kecamatan' }),
        api.get('/sekolah/geojson'),
        api.get('/analisis/prioritas'),
        api.get('/analisis/blank-spots').catch(() => ({ data: EMPTY_FC })),
        api.get('/analisis/coverage').catch(() => ({ data: EMPTY_FC })),
        api.get('/analisis/ringkasan').catch(() => ({ data: null })),
      ]);
      const prevWeights = get().weights;
      const defaultWeights = initialWeights(pri.data.meta.indikator);
      const hasPrevWeights = prevWeights && Object.keys(prevWeights).length > 0;
      set({
        kecamatan: wil.data.map((w) => ({ id: String(w.id_wilayah), name: w.nama_wilayah, lng: w.lng, lat: w.lat, bbox: w.bbox })),
        sekolah: { type: 'FeatureCollection', features: sek.data.features.map(mapSchoolFeature) },
        prioritas: pri.data,
        meta: pri.data.meta,
        blankSpots: blank.data,
        coverage: cov.data || EMPTY_FC,
        ringkasan: ring.data,
        weights: hasPrevWeights ? prevWeights : defaultWeights,
        savedWeights: defaultWeights,
        loading: false,
        loaded: true,
      });
    } catch (e) {
      set({ loading: false, error: msg(e) });
    }
  },

  /** Muat ulang prioritas setelah analisis/bobot berubah */
  reloadAnalysis: async () => {
    const [pri, blank, cov, ring] = await Promise.all([
      api.get('/analisis/prioritas'),
      api.get('/analisis/blank-spots'),
      api.get('/analisis/coverage').catch(() => ({ data: EMPTY_FC })),
      api.get('/analisis/ringkasan'),
    ]);
    const weights = initialWeights(pri.data.meta.indikator);
    set({ prioritas: pri.data, meta: pri.data.meta, blankSpots: blank.data, coverage: cov.data || EMPTY_FC, ringkasan: ring.data, weights, savedWeights: weights });
  },

  loadCandidates: async () => {
    const res = await api.get('/candidate-areas/geojson');
    set({ candidates: res.data });
  },

  setWeight: (kode, value) => set((s) => ({ weights: { ...s.weights, [kode]: Number(value) } })),
  resetWeights: () => set((s) => ({ weights: { ...s.savedWeights } })),

  /** Simpan bobot ke server (Stakeholder/Operator) lalu muat ulang skor tersimpan */
  saveWeights: async () => {
    const { weights } = get();
    const bobot = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number(v) / 100]));
    await api.put('/indikator/bobot', { bobot });
    await get().reloadAnalysis();
  },

  recalculate: async (params = {}) => {
    const res = await api.post('/analisis/hitung', params);
    await get().reloadAnalysis();
    return res.data;
  },
}));
