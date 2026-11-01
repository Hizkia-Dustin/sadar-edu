import { useRef, useCallback, useEffect, useMemo } from "react";
import Map, { NavigationControl, Source, Layer, Popup } from "react-map-gl/mapbox";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { rescoreFeatures, colorOf } from "../../lib/analysis";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const schoolLayerStyle = {
  id: "schools-layer",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 12, 6, 16, 9],
    "circle-color": ["match", ["get", "status"], "Negeri", "#1F6F5F", "Swasta", "#F59E0B", "#64748B"],
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
};

// Polygon diletakkan di slot "middle" Mapbox Standard agar label jalan/tempat tetap di atasnya
const wilayahFill = {
  id: "wilayah-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": ["get", "color"], "fill-opacity": 0.5 },
};
const wilayahLine = {
  id: "wilayah-line",
  type: "line",
  slot: "middle",
  paint: { "line-color": "#ffffff", "line-width": 1.2 },
};
const wilayahSelected = (id) => ({
  id: "wilayah-selected",
  type: "line",
  slot: "middle",
  filter: ["==", ["get", "id"], id === null ? -1 : Number(id)],
  paint: { "line-color": "#0f172a", "line-width": 3 },
});

const blankFill = {
  id: "blank-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": "#ef4444", "fill-opacity": 0.22 },
};
const blankLine = {
  id: "blank-line",
  type: "line",
  slot: "middle",
  paint: { "line-color": "#b91c1c", "line-width": 1, "line-dasharray": [2, 2] },
};
const coverageFill = {
  id: "coverage-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": "#2563eb", "fill-opacity": 0.1 },
};

const candidateFill = {
  id: "candidate-fill",
  type: "fill",
  slot: "top",
  paint: {
    "fill-color": ["match", ["get", "status"], "Disetujui", "#16a34a", "Dipertimbangkan", "#0ea5e9", "Ditolak", "#94a3b8", "#7c3aed"],
    "fill-opacity": 0.55,
  },
};
const candidateLine = {
  id: "candidate-line",
  type: "line",
  slot: "top",
  paint: { "line-color": "#ffffff", "line-width": 2 },
};
const candidateSelected = (id) => ({
  id: "candidate-selected",
  type: "line",
  slot: "top",
  filter: ["==", ["get", "id"], id === null ? -1 : Number(id)],
  paint: { "line-color": "#0f172a", "line-width": 3.5 },
});

export default function MapCanvas({ onMapLoaded, schools }) {
  const mapRef = useRef();

  const { viewState, setViewState, activeLayers, selectedFeature, setSelectedFeature, addToCompare, pendingBounds,
    selectedWilayahId, setSelectedWilayahId, selectedCandidateId, setSelectedCandidateId } = useMapStore();
  const { prioritas, meta, weights, sekolah, blankSpots, coverage, candidates } = useDataStore();

  // Skor dihitung ulang di klien dengan bobot dari slider -> peta berubah seketika
  const wilayahGeoJson = useMemo(() => {
    const scored = rescoreFeatures(prioritas.features, weights, meta && meta.kategori);
    return {
      type: "FeatureCollection",
      features: scored.map((f) => ({
        type: "Feature",
        id: f.id,
        geometry: f.geometry,
        properties: {
          id: f.properties.id_wilayah,
          nama: f.properties.nama_wilayah,
          skor: f.properties.skor,
          kategori: f.properties.kategori_live,
          color: f.properties.skor === null ? colorOf(null) : f.properties.color,
        },
      })),
    };
  }, [prioritas, weights, meta]);

  const candidateGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: candidates.features.map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: { id: f.properties.id_candidate, skor: f.properties.skor_suitability, status: f.properties.status_kandidat, nama: f.properties.nama_wilayah },
      })),
    }),
    [candidates]
  );

  const schoolData = schools || sekolah;

  const onMapLoad = useCallback(
    (evt) => {
      evt.target.setConfigProperty("basemap", "show3dObjects", activeLayers?.show3DBuildings !== false);
      if (typeof onMapLoaded === "function") onMapLoaded();
    },
    [activeLayers?.show3DBuildings, onMapLoaded]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (map.isStyleLoaded()) map.setConfigProperty("basemap", "show3dObjects", activeLayers?.show3DBuildings !== false);
  }, [activeLayers?.show3DBuildings]);

  // Permintaan fitBounds dari panel (pilih kecamatan / pilih kandidat)
  useEffect(() => {
    if (!pendingBounds || !mapRef.current) return;
    const [minLng, minLat, maxLng, maxLat] = pendingBounds.bbox;
    mapRef.current.getMap().fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: { top: 90, bottom: 60, left: 440, right: 60 }, duration: 1000, maxZoom: 14 }
    );
  }, [pendingBounds]);

  const interactiveLayerIds = useMemo(() => {
    const ids = [];
    if (activeLayers?.showSchools) ids.push("schools-layer");
    if (activeLayers?.showCandidates && candidates.features.length) ids.push("candidate-fill");
    if (activeLayers?.mcdaLayer) ids.push("wilayah-fill");
    return ids;
  }, [activeLayers, candidates.features.length]);

  const onMapClick = useCallback(
    (event) => {
      const feature = event.features && event.features[0];
      if (!feature) {
        setSelectedFeature(null);
        return;
      }
      if (feature.layer.id === "schools-layer") {
        setSelectedFeature({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, properties: feature.properties });
      } else if (feature.layer.id === "candidate-fill") {
        setSelectedFeature(null);
        setSelectedCandidateId(feature.properties.id);
      } else if (feature.layer.id === "wilayah-fill") {
        setSelectedFeature(null);
        setSelectedWilayahId(feature.properties.id);
      }
    },
    [setSelectedFeature, setSelectedWilayahId, setSelectedCandidateId]
  );

  const setCursor = useCallback((cursor) => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = cursor;
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-bold">Token Mapbox belum diatur</p>
          <p className="mt-2">
            Salin <code>.env.example</code> menjadi <code>.env</code>, isi <code>VITE_MAPBOX_ACCESS_TOKEN</code>, lalu jalankan ulang <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/standard"
        config={{ basemap: { lightPreset: "day", show3dObjects: activeLayers?.show3DBuildings !== false } }}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={onMapLoad}
        terrain={{ source: "mapbox-dem", exaggeration: 1.2 }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onMapClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        reuseMaps
      >
        <NavigationControl position="bottom-right" visualizePitch={true} />

        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />

        {activeLayers?.showCoverage && coverage.features.length > 0 && (
          <Source id="coverage-source" type="geojson" data={coverage}>
            <Layer {...coverageFill} />
          </Source>
        )}

        {activeLayers?.mcdaLayer && wilayahGeoJson.features.length > 0 && (
          <Source id="wilayah-source" type="geojson" data={wilayahGeoJson}>
            <Layer {...wilayahFill} />
            <Layer {...wilayahLine} />
            <Layer {...wilayahSelected(selectedWilayahId)} />
          </Source>
        )}

        {activeLayers?.showBlankSpots && blankSpots.features.length > 0 && (
          <Source id="blank-source" type="geojson" data={blankSpots}>
            <Layer {...blankFill} />
            <Layer {...blankLine} />
          </Source>
        )}

        {activeLayers?.showCandidates && candidateGeoJson.features.length > 0 && (
          <Source id="candidate-source" type="geojson" data={candidateGeoJson}>
            <Layer {...candidateFill} />
            <Layer {...candidateLine} />
            <Layer {...candidateSelected(selectedCandidateId)} />
          </Source>
        )}

        {activeLayers?.showSchools && (
          <Source id="schools-source" type="geojson" data={schoolData}>
            <Layer {...schoolLayerStyle} />
          </Source>
        )}

        {selectedFeature && (
          <Popup
            longitude={selectedFeature.longitude}
            latitude={selectedFeature.latitude}
            anchor="bottom"
            offset={12}
            onClose={() => setSelectedFeature(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div className="p-1 min-w-[180px] text-slate-800">
              <h3 className="font-bold text-[#1F6F5F] text-sm mb-1">{selectedFeature.properties.nama}</h3>
              <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1 mb-2">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded ${
                    selectedFeature.properties.status === "Negeri" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {selectedFeature.properties.status}
                </span>
              </div>
              {selectedFeature.properties.kecamatan && (
                <p className="text-[11px] text-slate-500 mb-2">Kec. {selectedFeature.properties.kecamatan}</p>
              )}
              <button
                onClick={() => {
                  addToCompare(selectedFeature.properties);
                  setSelectedFeature(null);
                }}
                className="w-full bg-[#1F6F5F] hover:bg-emerald-800 text-white text-xs py-1.5 rounded transition-colors font-medium"
              >
                + Tambah ke Perbandingan
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
