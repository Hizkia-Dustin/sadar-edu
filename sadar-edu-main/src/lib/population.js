// Ambang tetap dalam jiwa, bukan kuantil; warna tidak berubah ketika sekolah difilter.
export const POPULATION_BANDS = [
  // Hijau–kuning–merah sesuai permintaan; label angka tetap diperlukan agar tidak bergantung pada warna.
  { min: 0, label: '< 75.000', color: '#15803d' },
  { min: 75000, label: '75.000–124.999', color: '#84cc16' },
  { min: 125000, label: '125.000–199.999', color: '#facc15' },
  { min: 200000, label: '200.000–299.999', color: '#f97316' },
  { min: 300000, label: '≥ 300.000', color: '#dc2626' },
];

export function populationColor(count) {
  if (!Number.isFinite(count) || count < 0) return '#cbd5e1';
  return POPULATION_BANDS.findLast((band) => count >= band.min).color;
}
