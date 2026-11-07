import { useCallback, useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const formatPopulation = new Intl.NumberFormat('id-ID');

export function useDistrictHover({ enabled, population, popupOpen }) {
  const hoverRef = useRef(null);
  // Kedua layer memakai ID geografis sama; jumlah jiwa selalu dari data penduduk BPS.
  const districts = useMemo(() => new Map((population?.features || []).map((feature) => [feature.properties.id, feature.properties])), [population]);
  const hide = useCallback(() => hoverRef.current?.popup.remove(), []);

  useEffect(() => {
    return () => {
      hoverRef.current?.popup.remove();
      hoverRef.current = null;
    };
  }, [enabled, population, popupOpen]);

  const move = useCallback((event) => {
    if (!enabled || popupOpen || event.target.isMoving() || event.originalEvent?.buttons) {
      hide();
      return;
    }
    const features = event.features || [];
    const district = features.find((feature) => ['population-fill', 'wilayah-fill'].includes(feature.layer.id));
    const data = districts.get(district?.properties.id);
    if (!data || features.some((feature) => ['schools-layer', 'school-clusters'].includes(feature.layer.id))) {
      hide();
      return;
    }

    if (!hoverRef.current) {
      const content = document.createElement('section');
      content.setAttribute('role', 'tooltip');
      const name = document.createElement('strong');
      const region = document.createElement('p');
      const count = document.createElement('b');
      const source = document.createElement('small');
      content.append(name, region, count, source);
      const popup = new mapboxgl.Popup({ className: 'district-hover-tooltip', closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 16, maxWidth: '240px' }).setDOMContent(content);
      hoverRef.current = { popup, name, region, count, source, id: null };
    }

    const hover = hoverRef.current;
    if (hover.id !== data.id) {
      // textContent mencegah nama dari dataset ditafsirkan sebagai HTML.
      hover.name.textContent = data.nama;
      hover.region.textContent = data.kabupaten_kota;
      hover.count.textContent = Number.isFinite(data.penduduk) ? `${formatPopulation.format(data.penduduk)} jiwa` : 'Penduduk belum tersedia';
      hover.source.textContent = `Penduduk total · BPS ${data.tahun}`;
      hover.id = data.id;
    }
    // Mapbox mengikuti kursor langsung, tanpa render React setiap gerakan mouse.
    if (!hover.popup.isOpen()) hover.popup.setLngLat(event.lngLat).addTo(event.target).trackPointer();
  }, [enabled, popupOpen, districts, hide]);

  return { move, hide };
}
