import { create } from 'zustand';

// Pusat tampilan Kabupaten Bogor
const KABUPATEN_VIEW = { longitude: 106.82, latitude: -6.55, zoom: 9.8, pitch: 0, bearing: 0 };

export const useMapStore = create((set) => ({
  viewState: { ...KABUPATEN_VIEW },
  setViewState: (viewState) => set({ viewState }),

  flyToRegion: (lng, lat, zoom = 14) =>
    set((state) => ({ viewState: { ...state.viewState, longitude: lng, latitude: lat, zoom, pitch: 0, transitionDuration: 1000 } })),

  // Permintaan fitBounds ([minLng, minLat, maxLng, maxLat]); dieksekusi oleh MapCanvas
  pendingBounds: null,
  flyToBounds: (bbox) => set({ pendingBounds: bbox ? { bbox, nonce: Date.now() } : null }),

  flyToSchool: (feature) => {
    if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) return;
    const [lng, lat] = feature.geometry.coordinates;
    set((state) => ({
      viewState: { ...state.viewState, longitude: lng, latitude: lat, zoom: 15, pitch: 0, transitionDuration: 900 },
      pendingBounds: { bbox: [lng - 0.003, lat - 0.003, lng + 0.003, lat + 0.003], nonce: Date.now() },
      selectedFeature: { longitude: lng, latitude: lat, properties: feature.properties || {} },
    }));
  },

  activeLayers: {
    showSchools: true,
    show3DBuildings: false,
    mcdaLayer: true, // choropleth kategori kebutuhan per kecamatan
    populationLayer: false, // choropleth jumlah penduduk per kecamatan (BPS)
    showBlankSpots: false,
    showCoverage: false,
    showCandidates: false, // hanya aktif saat dibutuhkan / tab kandidat dibuka agar peta tidak menumpuk
  },
  toggleLayer: (layerKey) =>
    set((state) => {
      const next = !state.activeLayers[layerKey];
      return {
        activeLayers: {
          ...state.activeLayers,
          [layerKey]: next,
          ...(layerKey === 'populationLayer' && next ? { mcdaLayer: false } : {}),
          ...(layerKey === 'mcdaLayer' && next ? { populationLayer: false } : {}),
        },
      };
    }),
  setLayer: (layerKey, value) =>
    set((state) => {
      const next = Boolean(value);
      return {
        activeLayers: {
          ...state.activeLayers,
          [layerKey]: next,
          ...(layerKey === 'populationLayer' && next ? { mcdaLayer: false } : {}),
          ...(layerKey === 'mcdaLayer' && next ? { populationLayer: false } : {}),
        },
      };
    }),
  setChoroplethMode: (mode) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        mcdaLayer: mode === 'mcda',
        populationLayer: mode === 'population',
      },
    })),

  // Titik lokasi rumah pengguna (untuk Peta Publik & perbandingan jarak)
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),

  // Seleksi
  selectedFeature: null, // popup sekolah
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  selectedWilayahId: null,
  setSelectedWilayahId: (id) => set({ selectedWilayahId: id === null || id === undefined ? null : String(id) }),
  highlightedWilayahIds: [],
  setHighlightedWilayahIds: (ids) =>
    set({
      highlightedWilayahIds: Array.isArray(ids)
        ? [...new Set(ids.filter((v) => v !== null && v !== undefined && v !== '').map((v) => String(v)))]
        : [],
    }),
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

  clearSelection: () =>
    set({
      selectedFeature: null,
      selectedWilayahId: null,
      highlightedWilayahIds: [],
      selectedCandidateId: null,
    }),

  comparedSchools: [],
  addToCompare: (school) =>
    set((state) => {
      if (state.comparedSchools.some((s) => s.id === school.id)) return state;
      if (state.comparedSchools.length >= 3) return state; // maksimum 3 sekolah (sesuai teks pada modal)
      return { comparedSchools: [...state.comparedSchools, school] };
    }),
  removeFromCompare: (id) => set((state) => ({ comparedSchools: state.comparedSchools.filter((s) => s.id !== id) })),

  isCompareOpen: false,
  setIsCompareOpen: (isOpen) => set({ isCompareOpen: isOpen }),
}));
