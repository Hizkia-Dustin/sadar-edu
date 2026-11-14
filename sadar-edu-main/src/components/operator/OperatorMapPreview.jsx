/**
 * ============================================================================
 * KOMPONEN: OperatorMapPreview (Pratinjau Peta Spasial Operator)
 * ============================================================================
 * Fitur:
 * 1. Menggambar batas resmi Kabupaten Bogor (BOGOR_BOUNDARY).
 * 2. Menampilkan titik-titik sekolah dari database dan draf yang sedang dikerjakan.
 * 3. Menyediakan saklar filter "Hanya tampilkan dalam batas Kab. Bogor":
 *    - Aktif (Default): 521 sekolah (Sama persis dengan Peta Interaktif Publik).
 *    - Nonaktif: 617 sekolah (Mode audit, titik di luar Bogor ditandai merah).
 * 4. Popup interaktif untuk memeriksa informasi sekolah, NPSN, dan baris sumber.
 * ============================================================================
 */

import { useEffect, useMemo, useState } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import { api } from '../../lib/api';
import { BOGOR_BOUNDS, BOGOR_BOUNDARY, isInBogor } from '../../lib/bogorBoundary';
import { useOperatorStore } from '../../store/useOperatorStore';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function OperatorMapPreview() {
  const draft = useOperatorStore((state) => state.draft);
  const corrections = useOperatorStore((state) => state.corrections);
  const [published, setPublished] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterBogorOnly, setFilterBogorOnly] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/sekolah/geojson', undefined, { signal: controller.signal })
      .then((result) => setPublished(result.data.features))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError('Data server belum dapat dimuat.');
      });
    return () => controller.abort();
  }, []);

  const data = useMemo(() => {
    // Draf memakai koordinat hasil perbaikan yang sudah diterapkan, bukan usulan yang belum disimpan.
    const read = (row, key) =>
      draft?.mapping?.[key] == null || draft.mapping[key] === ''
        ? ''
        : String(row[Number(draft.mapping[key])] ?? '').trim();

    const draftFeatures = (draft?.rows || []).flatMap((row, index) => {
      const latText = read(row, 'lat');
      const lngText = read(row, 'lng');
      const lat = Number(latText.replace(',', '.'));
      const lng = Number(lngText.replace(',', '.'));
      if (
        !latText ||
        !lngText ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) {
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
            nama: read(row, 'name'),
            npsn: read(row, 'npsn'),
            line: index + 2,
            inBogor,
            state: changed
              ? 'Diperbaiki dalam draf'
              : !inBogor
              ? 'Luar batas Bogor'
              : 'Draf impor',
            file: draft.fileName,
          },
        },
      ];
    });

    const draftNpsn = new Set(draftFeatures.map((feature) => feature.properties.npsn).filter(Boolean));

    const serverFeatures = published
      .filter((feature) => !draftNpsn.has(String(feature.properties.npsn)))
      .map((feature) => {
        const coords = feature.geometry?.coordinates || [0, 0];
        const inBogor = isInBogor(coords);
        return {
          ...feature,
          properties: {
            nama: feature.properties.nama_sekolah,
            npsn: feature.properties.npsn,
            inBogor,
            state: !inBogor ? 'Luar batas Bogor' : 'Data server',
          },
        };
      });

    const all = [...serverFeatures, ...draftFeatures];
    const filtered = filterBogorOnly ? all.filter((f) => f.properties.inBogor !== false) : all;

    return { type: 'FeatureCollection', features: filtered };
  }, [published, draft, corrections, filterBogorOnly]);

  if (!token) return <p>Token peta belum tersedia.</p>;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Kontrol Filter Batas Wilayah */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] px-3 py-2 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#173042]">
          <input
            type="checkbox"
            checked={filterBogorOnly}
            onChange={(e) => setFilterBogorOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#d7e1e8] text-[#1f6f5f] focus:ring-[#1f6f5f]"
          />
          <span>Hanya tampilkan dalam batas Kab. Bogor ({data.features.length} titik • Sama dengan Peta Publik)</span>
        </label>
        {!filterBogorOnly && (
          <span className="inline-flex items-center gap-1 rounded bg-[#fff0f0] px-2 py-0.5 text-[11px] font-semibold text-[#a12b31]">
            🔴 Menampilkan titik di luar batas wilayah (perlu koreksi)
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Hijau: data resmi Bogor • Merah: di luar batas Bogor • Kuning: draf impor • Ungu: perbaikan diterapkan.
      </p>

      {error && <p role="alert" className="text-xs text-red-800">{error}</p>}

      <div style={{ height: 370, borderRadius: 12, overflow: 'hidden', border: '1px solid #d7e1e8' }}>
        <Map
          mapboxAccessToken={token}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={{ bounds: BOGOR_BOUNDS, fitBoundsOptions: { padding: 30 } }}
          interactiveLayerIds={['operator-schools']}
          onClick={(event) => setSelected(event.features?.[0] || null)}
          style={{ width: '100%', height: '100%' }}
          scrollZoom={false}
        >
          <NavigationControl position="top-right" />
          <Source id="operator-boundary" type="geojson" data={BOGOR_BOUNDARY}>
            <Layer id="operator-boundary-line" type="line" paint={{ 'line-color': '#1f6f5f', 'line-width': 2, 'line-dasharray': [2, 1] }} />
          </Source>
          <Source id="operator-school-data" type="geojson" data={data}>
            <Layer
              id="operator-schools"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': [
                  'match',
                  ['get', 'state'],
                  'Draf impor',
                  '#e6a03c',
                  'Diperbaiki dalam draf',
                  '#854dce',
                  'Luar batas Bogor',
                  '#dc2626',
                  '#1f6f5f',
                ],
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 1.5,
              }}
            />
          </Source>
          {selected && (
            <Popup
              longitude={selected.geometry.coordinates[0]}
              latitude={selected.geometry.coordinates[1]}
              onClose={() => setSelected(null)}
              closeOnClick={false}
            >
              <div className="p-2 text-xs text-slate-800 max-w-[220px]">
                <strong className="block text-sm text-[#173042]">{selected.properties.nama}</strong>
                <p className="text-[#445665]">NPSN: {selected.properties.npsn || '—'}</p>
                <div className="mt-1">
                  {selected.properties.state === 'Luar batas Bogor' ? (
                    <span className="inline-block rounded bg-[#fff0f0] px-2 py-0.5 text-[10px] font-semibold text-[#a12b31]">
                      ⚠️ Di Luar Batas Kab. Bogor (Perlu Koreksi)
                    </span>
                  ) : (
                    <span className="inline-block rounded bg-[#e8f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#126552]">
                      {selected.properties.state}
                    </span>
                  )}
                </div>
                {selected.properties.state === 'Luar batas Bogor' && (
                  <p className="mt-1 text-[10px] text-[#85520c] leading-tight">
                    Titik ini otomatis disembunyikan di Peta Publik agar tidak membingungkan warga.
                  </p>
                )}
                {selected.properties.line && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    {selected.properties.file} · Baris {selected.properties.line}
                  </p>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Total ditampilkan: <strong>{data.features.length}</strong> titik sekolah
        </span>
        <span className="text-[11px]">
          {filterBogorOnly
            ? 'Filter aktif: hanya menampilkan sekolah di dalam batas wilayah Bogor.'
            : 'Menampilkan seluruh titik, termasuk titik di luar batas (warna merah).'}
        </span>
      </div>
    </div>
  );
}
