import { create } from 'zustand';

// Pusat tampilan Kabupaten Bogor
const KABUPATEN_VIEW = { longitude: 106.82, latitude: -6.55, zoom: 9.3, pitch: 25, bearing: 0 };

export const useMapStore = create((set) => ({
  viewState: { ...KABUPATEN_VIEW },
  setViewState: (viewState) => set({ viewState }),

  flyToRegion: (lng, lat, zoom = 14) =>
    set((state) => ({ viewState: { ...state.viewState, longitude: lng, latitude: lat, zoom, transitionDuration: 1000 } })),

  // Permintaan fitBounds ([minLng, minLat, maxLng, maxLat]); dieksekusi oleh MapCanvas
  pendingBounds: null,
  flyToBounds: (bbox) => set({ pendingBounds: bbox ? { bbox, nonce: Date.now() } : null }),

  activeLayers: {
    showSchools: true,
    show3DBuildings: true,
    mcdaLayer: true, // choropleth kategori kebutuhan per kecamatan
    showBlankSpots: false,
    showCoverage: false,
    showCandidates: true,
  },
  toggleLayer: (layerKey) =>
    set((state) => ({ activeLayers: { ...state.activeLayers, [layerKey]: !state.activeLayers[layerKey] } })),

  // Seleksi
  selectedFeature: null, // popup sekolah
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  selectedWilayahId: null,
  setSelectedWilayahId: (id) => set({ selectedWilayahId: id === null || id === undefined ? null : String(id) }),
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

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
