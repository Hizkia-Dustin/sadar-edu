import { useEffect, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import { Check, Compass, MapPin, TriangleAlert } from 'lucide-react';
import { BOGOR_BOUNDS, BOGOR_BOUNDARY, isInBogor } from '../../lib/bogorBoundary';
import { BTN_PRIMARY, BTN_OUTLINE } from './ui';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Titik default tengah Kabupaten Bogor
const DEFAULT_CENTER = { lng: 106.8166, lat: -6.5950 };

export default function OperatorSpatialPicker({
  initialLat,
  initialLng,
  schoolName = 'Sekolah',
  onApplyCoordinate,
  onCancel,
}) {
  const mapRef = useRef(null);

  // Parse initial coordinates if valid
  const hasInitial =
    Number.isFinite(Number(initialLat)) &&
    Number.isFinite(Number(initialLng)) &&
    Math.abs(Number(initialLat)) <= 90 &&
    Math.abs(Number(initialLng)) <= 180;

  const [coord, setCoord] = useState(() => ({
    lng: hasInitial ? Number(initialLng) : DEFAULT_CENTER.lng,
    lat: hasInitial ? Number(initialLat) : DEFAULT_CENTER.lat,
  }));

  const inBogor = isInBogor([coord.lng, coord.lat]);

  const handleMapClick = (e) => {
    const { lng, lat } = e.lngLat;
    setCoord({ lng, lat });
  };

  const handleMarkerDragEnd = (e) => {
    const { lng, lat } = e.lngLat;
    setCoord({ lng, lat });
  };

  const handleApply = () => {
    if (onApplyCoordinate) {
      onApplyCoordinate({
        lat: Number(coord.lat.toFixed(6)),
        lng: Number(coord.lng.toFixed(6)),
      });
    }
  };

  if (!token) {
    return (
      <div className="rounded-lg border border-[#d7e1e8] bg-[#edf3f6] p-4 text-xs text-[#173042]">
        Token Mapbox belum tersedia untuk pemilih koordinat interaktif.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#b8cbc2] bg-[#fdfdfd] p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1f6f5f]">
          <MapPin size={16} />
          <span>Kotak-Katik Koordinat Spasial di Peta</span>
        </div>
        <span className="text-[11px] font-medium text-[#445665] truncate max-w-[200px]" title={schoolName}>
          {schoolName}
        </span>
      </div>

      <p className="text-[11px] text-[#445665] leading-relaxed">
        Klik peta atau geser (drag) pin merah ke lokasi sekolah yang tepat. Posisi koordinat akan ter-update otomatis.
      </p>

      {/* Mini Map Container */}
      <div className="relative h-[260px] w-full overflow-hidden rounded-md border border-[#d7e1e8]">
        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={{
            longitude: coord.lng,
            latitude: coord.lat,
            zoom: hasInitial ? 14 : 10,
          }}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" />

          {/* Garis Batas Kabupaten Bogor */}
          <Source id="picker-boundary" type="geojson" data={BOGOR_BOUNDARY}>
            <Layer
              id="picker-boundary-line"
              type="line"
              paint={{
                'line-color': '#1f6f5f',
                'line-width': 2,
                'line-dasharray': [2, 1],
              }}
            />
          </Source>

          {/* Marker Titik yang Bisa Digeser (Draggable) */}
          <Marker
            longitude={coord.lng}
            latitude={coord.lat}
            draggable
            onDragEnd={handleMarkerDragEnd}
            anchor="bottom"
          >
            <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e63946] text-white shadow-lg ring-2 ring-white">
                <MapPin size={16} />
              </div>
              <div className="h-2 w-2 rounded-full bg-black/40 blur-[1px] -mt-0.5" />
            </div>
          </Marker>
        </Map>
      </div>

      {/* Status Koordinat Terpilih */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d7e1e8] bg-[#edf3f6] p-2.5 text-xs">
        <div>
          <span className="block text-[10px] uppercase font-bold text-[#445665]">Koordinat Terpilih</span>
          <span className="font-mono font-semibold text-[#173042]">
            {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {inBogor ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#e8f3f0] px-2 py-1 text-[11px] font-semibold text-[#126552]">
              <Check size={13} />
              Di Dalam Bogor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-[#fff0f0] px-2 py-1 text-[11px] font-semibold text-[#a12b31]">
              <TriangleAlert size={13} />
              Di Luar Bogor
            </span>
          )}
        </div>
      </div>

      {/* Aksi */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`${BTN_OUTLINE} h-[34px] px-3 text-xs`}
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          className={`${BTN_PRIMARY} h-[34px] px-3 text-xs`}
        >
          Gunakan Koordinat Peta
        </button>
      </div>
    </div>
  );
}
