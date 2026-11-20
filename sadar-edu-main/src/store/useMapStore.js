import { create } from 'zustand';

// Pusat tampilan Kabupaten Bogor (diposisikan proporsional agar utara dan selatan Bogor tercover utuh)
const KABUPATEN_VIEW = { longitude: 106.82, latitude: -6.52, zoom: 9.8, pitch: 0, bearing: 0 };

export const useMapStore = create((set) => ({
  viewState: { ...KABUPATEN_VIEW },
  setViewState: (viewState) => set({ viewState }),

  flyToRegion: (lng, lat, zoom = 14) =>
    set((state) => ({
      viewState: {
        ...state.viewState,
        longitude: lng,
        latitude: lat,
        zoom,
        pitch: 0,
        bearing: 0,
        transitionDuration: 850,
      },
    })),

  // Permintaan fitBounds ([minLng, minLat, maxLng, maxLat]); dieksekusi oleh MapCanvas
  pendingBounds: null,
  flyToBounds: (bbox) => set({ pendingBounds: bbox ? { bbox, nonce: Date.now() } : null }),

  flyToSchool: (feature) => {
    if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) return;
    const [lng, lat] = feature.geometry.coordinates;
    set((state) => ({
      viewState: {
        ...state.viewState,
        longitude: lng,
        latitude: lat,
        zoom: 15,
        pitch: 0,
        bearing: 0,
        transitionDuration: 800,
      },
      pendingBounds: { bbox: [lng - 0.003, lat - 0.003, lng + 0.003, lat + 0.003], nonce: Date.now() },
      selectedFeature: { longitude: lng, latitude: lat, properties: feature.properties || {} },
    }));
  },

  activeLayers: {
    showSchools: true,
    show3DBuildings: false,
    mcdaLayer: true, // choropleth kategori kebutuhan per kecamatan
    showBlankSpots: false,
    showCoverage: false,
    showCandidates: false, // hanya aktif saat dibutuhkan / tab kandidat dibuka agar peta tidak menumpuk
  },
  toggleLayer: (layerKey) =>
    set((state) => ({ activeLayers: { ...state.activeLayers, [layerKey]: !state.activeLayers[layerKey] } })),
  setLayer: (layerKey, value) =>
    set((state) => ({ activeLayers: { ...state.activeLayers, [layerKey]: Boolean(value) } })),

  // Seleksi
  selectedFeature: null, // popup sekolah
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  selectedWilayahId: null,
  setSelectedWilayahId: (id) => set({ selectedWilayahId: id === null || id === undefined ? null : String(id) }),
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

  clearSelection: () =>
    set({
      selectedFeature: null,
      selectedWilayahId: null,
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
