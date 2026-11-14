/**
 * ============================================================================
 * KOMPONEN: OperatorIndicatorMap (Peta Indikator & Titik Spasial Sekolah)
 * ============================================================================
 * Fitur:
 * 1. Menggambar batas poligon Kabupaten Bogor (garis putus-putus hijau).
 * 2. Mengambil data koordinat sekolah langsung dari database PostgreSQL PostGIS.
 * 3. Membedakan status titik:
 *    - Hijau (#1f6f5f): Data server sah di dalam Kabupaten Bogor.
 *    - Merah (#dc2626): Data server yang koordinatnya nyasar ke luar batas wilayah.
 *    - Kuning (#e6a03c): Titik baru dari draf impor berkas.
 *    - Ungu (#854dce): Titik hasil perbaikan yang diterapkan operator.
 * 4. Menyediakan saklar filter untuk menyinkronkan tampilan dengan Peta Publik.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import { Maximize2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { BOGOR_BOUNDS, BOGOR_BOUNDARY, isInBogor } from '../../lib/bogorBoundary';
import { useOperatorStore } from '../../store/useOperatorStore';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function OperatorIndicatorMap({ onSelectSchool, highlightedNpsn }) {
  const mapRef = useRef(null);
  const draft = useOperatorStore((state) => state.draft);
  const corrections = useOperatorStore((state) => state.corrections);

  const [published, setPublished] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterBogorOnly, setFilterBogorOnly] = useState(true);

  // Muat data titik sekolah aktual dari endpoint backend database
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get('/sekolah/geojson', undefined, { signal: controller.signal })
      .then((res) => {
        const features = res?.data?.features || res?.features || [];
        setPublished(features);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Koneksi server lokal belum aktif. Menampilkan mode draf/pratinjau.');
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Sinkronisasi data draf impor dengan data server
  const geojson = useMemo(() => {
    const read = (row, key) =>
      draft?.mapping?.[key] == null || draft.mapping[key] === ''
        ? ''
        : String(row[Number(draft.mapping[key])] ?? '').trim();

    const draftFeatures = (draft?.rows || []).flatMap((row, index) => {
      const latText = read(row, 'lat');
      const lngText = read(row, 'lng');
      const lat = Number(latText.replace(',', '.'));
      const lng = Number(lngText.replace(',', '.'));

      if (!latText || !lngText || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return [];
      }

      const changed = Object.values(corrections).some(
        (item) => item.line === index + 2 && item.status === 'Diterapkan'
      );
      const inBogor = isInBogor([lng, lat]);

      return [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            nama: read(row, 'name') || `Sekolah Draf Baris ${index + 2}`,
            npsn: read(row, 'npsn') || '—',
            jenjang: read(row, 'stage') || 'SMP',
            state: changed
              ? 'Diperbaiki dalam draf'
              : !inBogor
              ? 'Di luar batas Bogor'
              : 'Draf impor',
            lat,
            lng,
            line: index + 2,
          },
        },
      ];
    });

    const draftNpsn = new Set(draftFeatures.map((f) => f.properties.npsn).filter((n) => n && n !== '—'));

    const serverFeatures = published
      .filter((f) => !draftNpsn.has(String(f.properties?.npsn)))
      .map((f) => {
        const [lng, lat] = f.geometry?.coordinates || [0, 0];
        const inBogor = isInBogor([lng, lat]);
        return {
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            nama: f.properties?.nama_sekolah || f.properties?.nama || 'Sekolah Terdaftar',
            npsn: f.properties?.npsn || '—',
            jenjang: f.properties?.jenjang || 'SMP',
            inBogor,
            state: !inBogor ? 'Di luar batas Bogor' : 'Data server',
            lat,
            lng,
          },
        };
      });

    const all = [...serverFeatures, ...draftFeatures];
    const filtered = filterBogorOnly ? all.filter((f) => f.properties.inBogor !== false) : all;

    return {
      type: 'FeatureCollection',
      features: filtered,
    };
  }, [published, draft, corrections, filterBogorOnly]);

  // Sorot titik jika dipilih dari tabel luar
  useEffect(() => {
    if (!highlightedNpsn || !mapRef.current) return;
    const target = geojson.features.find((f) => f.properties.npsn === highlightedNpsn);
    if (target && target.geometry?.coordinates) {
      const [lng, lat] = target.geometry.coordinates;
      setSelected(target);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
    }
  }, [highlightedNpsn, geojson]);

  const handleResetView = () => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(BOGOR_BOUNDS, { padding: 30, duration: 800 });
  };

  const handlePointClick = (event) => {
    const feature = event.features?.[0];
    if (feature) {
      setSelected(feature);
      if (onSelectSchool) onSelectSchool(feature.properties);
    }
  };

  if (!token) {
    return (
      <div className="flex h-[380px] w-full flex-col items-center justify-center rounded-lg border border-[#d7e1e8] bg-[#edf3f6] p-4 text-center">
        <p className="text-sm font-semibold text-[#173042]">Token Mapbox belum dikonfigurasi</p>
        <p className="mt-1 text-xs text-[#445665]">Tambahkan VITE_MAPBOX_ACCESS_TOKEN di file .env untuk menampilkan peta.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2">
      {/* Kontrol Filter Batas Wilayah */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] px-3 py-2 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#173042]">
          <input
            type="checkbox"
            checked={filterBogorOnly}
            onChange={(e) => setFilterBogorOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#d7e1e8] text-[#1f6f5f] focus:ring-[#1f6f5f]"
          />
          <span>Hanya tampilkan dalam batas Kab. Bogor ({geojson.features.length} titik • Sama dengan Peta Publik)</span>
        </label>
        {!filterBogorOnly && (
          <span className="inline-flex items-center gap-1 rounded bg-[#fff0f0] px-2 py-0.5 text-[11px] font-semibold text-[#a12b31]">
            🔴 Menampilkan titik di luar batas wilayah (perlu koreksi)
          </span>
        )}
      </div>

      {/* Area Peta */}
      <div className="relative h-[380px] w-full overflow-hidden rounded-lg border border-[#d7e1e8]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs">
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
              <RefreshCw size={15} className="animate-spin text-[#1f6f5f]" />
              <span className="text-xs font-semibold text-[#173042]">Memuat data spasial…</span>
            </div>
          </div>
        )}

        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={{ bounds: BOGOR_BOUNDS, fitBoundsOptions: { padding: 30 } }}
          interactiveLayerIds={['operator-school-points']}
          onClick={handlePointClick}
          style={{ width: '100%', height: '100%' }}
          scrollZoom={false}
        >
          <NavigationControl position="top-right" />

          {/* Batas Kabupaten Bogor */}
          <Source id="bogor-regency-boundary" type="geojson" data={BOGOR_BOUNDARY}>
            <Layer
              id="bogor-regency-line"
              type="line"
              paint={{
                'line-color': '#1f6f5f',
                'line-width': 2,
                'line-dasharray': [2, 1],
              }}
            />
          </Source>

          {/* Sebaran Titik Sekolah */}
          <Source id="school-spatial-points" type="geojson" data={geojson}>
            <Layer
              id="operator-school-points"
              type="circle"
              paint={{
                'circle-radius': [
                  'case',
                  ['==', ['get', 'npsn'], highlightedNpsn || ''],
                  9,
                  6,
                ],
                'circle-color': [
                  'match',
                  ['get', 'state'],
                  'Draf impor',
                  '#e6a03c',
                  'Diperbaiki dalam draf',
                  '#854dce',
                  'Di luar batas Bogor',
                  '#dc2626',
                  '#1f6f5f', // Data server
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.8,
              }}
            />
          </Source>

          {/* Popup Titik Terpilih */}
          {selected && (
            <Popup
              longitude={selected.geometry.coordinates[0]}
              latitude={selected.geometry.coordinates[1]}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              anchor="bottom"
              offset={14}
            >
              <div className="min-w-[210px] p-1 text-[#173042]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f6f5f]">
                  {selected.properties.state}
                </p>
                <h4 className="mt-0.5 text-xs font-bold leading-tight">
                  {selected.properties.nama}
                </h4>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-[#445665]">
                  <p>NPSN: <span className="font-semibold text-[#173042]">{selected.properties.npsn || '—'}</span></p>
                  <p>Jenjang: <span className="font-semibold text-[#173042]">{selected.properties.jenjang || '—'}</span></p>
                  <p className="text-[10px] text-slate-500">
                    {selected.geometry.coordinates[1].toFixed(5)}, {selected.geometry.coordinates[0].toFixed(5)}
                  </p>
                  {selected.properties.line && (
                    <p className="text-[10px] font-semibold text-[#e6a03c]">
                      Baris sumber: {selected.properties.line}
                    </p>
                  )}
                  {selected.properties.state === 'Di luar batas Bogor' && (
                    <div className="mt-2 rounded bg-[#fff0f0] p-1.5 text-[10px] font-medium text-[#a12b31] leading-tight">
                      ⚠️ Titik berada di luar batas Kabupaten Bogor. Otomatis disembunyikan di Peta Publik agar tidak membingungkan warga.
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Tombol Reset Tampilan */}
        <button
          type="button"
          onClick={handleResetView}
          title="Kembalikan batas wilayah Bogor"
          className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-md border border-[#d7e1e8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#173042] shadow-sm hover:bg-[#edf3f6]"
        >
          <Maximize2 size={13} />
          Reset Fokus
        </button>
      </div>

      {/* Baris Legenda & Status Data */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#445665]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1f6f5f]" />
            Data server ({geojson.features.filter((f) => f.properties.state === 'Data server').length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            Luar Bogor ({geojson.features.filter((f) => f.properties.state === 'Di luar batas Bogor').length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e6a03c]" />
            Draf impor ({geojson.features.filter((f) => f.properties.state === 'Draf impor').length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#854dce]" />
            Diperbaiki ({geojson.features.filter((f) => f.properties.state === 'Diperbaiki dalam draf').length})
          </span>
        </div>
        <p className="text-[11px] font-medium text-slate-500">
          Total: <strong className="text-[#173042]">{geojson.features.length}</strong> sekolah terpetakan
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-[#fff7ed] px-2.5 py-1.5 text-[11px] text-[#c2410c]">
          {error}
        </p>
      )}
    </div>
  );
}
