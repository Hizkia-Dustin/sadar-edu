import { LocateFixed, Layers, ArrowRight, Plus, Check } from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import MapView, { NavigationControl, Source, Layer, Popup } from "react-map-gl/mapbox";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { rescoreFeatures, colorOf } from "../../lib/analysis";
import { BOGOR_BOUNDARY, BOGOR_BOUNDS, isInBogor } from "../../lib/bogorBoundary";
import { populationColor } from "../../lib/population";
import kabupatenBoundary from "../../data/kabupaten-bogor.geojson.json";
import { useDistrictHover } from "./useDistrictHover";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const UNCLUSTERED = ["!", ["has", "point_count"]];

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
  // Dashboard memakai ID angka; eksplorasi geografis memakai ID geo:*.
  filter: ["==", ["get", "id"], id == null ? -1 : Number.isFinite(Number(id)) ? Number(id) : id],
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

export default function MapCanvas({ onMapLoaded, schools, publicExplorer = false, publicLayers, panelOpen = false, onOpenLayers, onSchoolSelect, population, publicBlankSpots, publicNeeds, onDistrictSelect, selectedPopulationId }) {
  const mapRef = useRef();
  const [populationPopup, setPopulationPopup] = useState(null);
  const publishedCamera = useRef(null);
  const initiallyFitted = useRef(false);
  const cameraPadding = useCallback(() => {
    if (!publicExplorer) return { top: 90, bottom: 60, left: 440, right: 60 };
    const mobile = window.innerWidth < 768;
    return { top: 110, bottom: mobile && panelOpen ? Math.round(window.innerHeight * 0.48) : 70, left: !mobile && panelOpen ? 390 : 40, right: 60 };
  }, [publicExplorer, panelOpen]);

  const { viewState, setViewState, activeLayers: storedLayers, selectedFeature, setSelectedFeature, addToCompare, comparedSchools, pendingBounds,
    selectedWilayahId, setSelectedWilayahId, selectedCandidateId, setSelectedCandidateId } = useMapStore();
  const activeLayers = publicLayers || storedLayers;
  const districtHover = useDistrictHover({
    enabled: publicExplorer && (activeLayers?.populationLayer || activeLayers?.mcdaLayer),
    population,
    popupOpen: Boolean(selectedFeature || (activeLayers?.populationLayer && populationPopup)),
  });
  const mapConfig = useMemo(() => ({ basemap: { lightPreset: "day", show3dObjects: activeLayers?.show3DBuildings !== false } }), [activeLayers?.show3DBuildings]);
  const syncViewState = useCallback((event) => {
    publishedCamera.current = event.viewState;
    setViewState(event.viewState);
  }, [setViewState]);

  // Mapbox owns animation frames; publish the camera only when movement ends.
  useEffect(() => {
    if (!publicExplorer || !mapRef.current || viewState === publishedCamera.current) return;
    const map = mapRef.current.getMap();
    const center = map.getCenter();
    if (Math.abs(center.lng - viewState.longitude) < 1e-7 && Math.abs(center.lat - viewState.latitude) < 1e-7 && Math.abs(map.getZoom() - viewState.zoom) < 1e-7) return;
    map.easeTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom, bearing: viewState.bearing, pitch: 0, duration: viewState.transitionDuration || 0 });
  }, [publicExplorer, viewState]);
  const { prioritas, meta, weights, sekolah, blankSpots, coverage, candidates } = useDataStore();
  const displayedBlankSpots = publicExplorer && publicBlankSpots ? publicBlankSpots : blankSpots;
  // Ringankan data Mapbox tanpa menggabungkan jumlah penduduk dengan skor MCDA.
  const populationGeoJson = useMemo(() => ({
    type: 'FeatureCollection',
    features: (population?.features || []).map((feature) => ({ ...feature,
      properties: { ...feature.properties, color: populationColor(feature.properties.penduduk) },
    })),
  }), [population]);

  // Skor dihitung ulang di klien dengan bobot dari slider -> peta berubah seketika
  const wilayahGeoJson = useMemo(() => {
    // Skor pratinjau sudah dihitung backend pada geometri baru, bukan skor poligon demo lama.
    if (publicExplorer && publicNeeds) return {
      type: 'FeatureCollection',
      features: publicNeeds.features.map((feature) => ({ ...feature, properties: {
        id: feature.properties.id_wilayah, nama: feature.properties.nama_wilayah,
        skor: feature.properties.skor_total, kategori: feature.properties.kategori_prioritas,
        color: colorOf(feature.properties.kategori_prioritas),
      } })),
    };
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
  }, [prioritas, weights, meta, publicExplorer, publicNeeds]);

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
  const schoolsById = useMemo(() => new Map(schoolData.features.map((feature) => [String(feature.properties.id), feature])), [schoolData]);
  const renderedSchoolData = useMemo(() => publicExplorer ? {
    type: "FeatureCollection",
    features: schoolData.features.map((feature) => ({ type: "Feature", geometry: feature.geometry, properties: { id: feature.properties.id, status: feature.properties.status } })),
  } : schoolData, [publicExplorer, schoolData]);

  const fitPublicSchools = useCallback(() => {
    if (!publicExplorer || initiallyFitted.current || !mapRef.current) return;
    mapRef.current.fitBounds(BOGOR_BOUNDS, { padding: cameraPadding(), duration: 0, maxZoom: 11, retainPadding: false });
    initiallyFitted.current = true;
  }, [publicExplorer, cameraPadding]);
  useEffect(() => { fitPublicSchools(); }, [fitPublicSchools]);

  const onMapLoad = useCallback(
    (evt) => {
      evt.target.setConfigProperty("basemap", "show3dObjects", activeLayers?.show3DBuildings !== false);
      fitPublicSchools();
      if (typeof onMapLoaded === "function") onMapLoaded();
    },
    [activeLayers?.show3DBuildings, onMapLoaded, fitPublicSchools]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (map.isStyleLoaded()) map.setConfigProperty("basemap", "show3dObjects", activeLayers?.show3DBuildings !== false);
  }, [activeLayers?.show3DBuildings, publicExplorer]);

  // Permintaan fitBounds dari panel (pilih kecamatan / pilih kandidat)
  useEffect(() => {
    if (!pendingBounds || !mapRef.current) return;
    const [minLng, minLat, maxLng, maxLat] = pendingBounds.bbox;
    mapRef.current.getMap().fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: cameraPadding(), duration: 1000, maxZoom: 14 }
    );
  }, [pendingBounds, cameraPadding]);

  const interactiveLayerIds = useMemo(() => {
    const ids = [];
    if (activeLayers?.showSchools) { ids.push("schools-layer"); if (publicExplorer) ids.push("school-clusters"); }
    if (activeLayers?.showCandidates && candidates.features.length) ids.push("candidate-fill");
    if (activeLayers?.mcdaLayer) ids.push("wilayah-fill");
    if (publicExplorer && activeLayers?.populationLayer && populationGeoJson.features.length) ids.push("population-fill");
    return ids;
  }, [activeLayers, candidates.features.length, publicExplorer, populationGeoJson.features.length]);

  const onMapClick = useCallback(
    (event) => {
      setPopulationPopup(null);
      if (publicExplorer && !isInBogor([event.lngLat.lng, event.lngLat.lat])) {
        setSelectedFeature(null);
        return;
      }
      // Titik sekolah harus tetap menang ketika poligon penduduk berada di bawahnya.
      const feature = event.features?.find((item) => ['schools-layer', 'school-clusters'].includes(item.layer.id)) || event.features?.[0];
      if (!feature) {
        setSelectedFeature(null);
        return;
      }
      if (feature.layer.id === "school-clusters") {
        setSelectedFeature(null);
        const source = mapRef.current.getMap().getSource("schools-source");
        source.getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
          if (!error) mapRef.current?.getMap().easeTo({ center: feature.geometry.coordinates, zoom, padding: cameraPadding(), duration: 450, retainPadding: false });
        });
      } else if (feature.layer.id === "schools-layer") {
        const [longitude, latitude] = feature.geometry.coordinates;
        setSelectedFeature({ longitude, latitude, properties: schoolsById.get(String(feature.properties.id))?.properties || feature.properties });
      } else if (feature.layer.id === "candidate-fill") {
        setSelectedFeature(null);
        setSelectedCandidateId(feature.properties.id);
      } else if (feature.layer.id === "wilayah-fill") {
        setSelectedFeature(null);
        if (publicExplorer && onDistrictSelect) onDistrictSelect(feature.properties.id);
        else setSelectedWilayahId(feature.properties.id);
      } else if (feature.layer.id === "population-fill") {
        setSelectedFeature(null);
        setPopulationPopup({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, properties: feature.properties });
      }
    },
    [setSelectedFeature, setSelectedWilayahId, setSelectedCandidateId, cameraPadding, schoolsById, publicExplorer, onDistrictSelect]
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
      {publicExplorer && <div className="explorer-map-tools" aria-label="Alat peta">
        <button title="Tampilkan semua hasil" aria-label="Tampilkan semua hasil" onClick={() => { initiallyFitted.current = false; fitPublicSchools(); }}><LocateFixed size={19} /></button>
        <button title="Lapisan peta" aria-label="Lapisan peta" onClick={onOpenLayers}><Layers size={19} /></button>
      </div>}
      <MapView
        ref={mapRef}
        {...(publicExplorer ? { initialViewState: { ...viewState, pitch: 0 } } : viewState)}
        onMove={publicExplorer ? undefined : syncViewState}
        onMoveEnd={publicExplorer ? syncViewState : undefined}
        mapStyle="mapbox://styles/mapbox/standard"
        config={mapConfig}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={onMapLoad}
        terrain={publicExplorer ? undefined : { source: "mapbox-dem", exaggeration: 1.2 }}
        maxBounds={publicExplorer ? BOGOR_BOUNDS : undefined}
        projection={publicExplorer ? "mercator" : undefined}
        maxPitch={publicExplorer ? 0 : undefined}
        renderWorldCopies={!publicExplorer}
        minZoom={publicExplorer ? 8 : undefined}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(event) => { districtHover.hide(); onMapClick(event); }}
        onMouseMove={publicExplorer ? districtHover.move : undefined}
        onMoveStart={districtHover.hide}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => { setCursor(""); districtHover.hide(); }}
        reuseMaps
      >
        <NavigationControl position={publicExplorer ? "top-right" : "bottom-right"} showCompass={!publicExplorer} visualizePitch={!publicExplorer} />

        {!publicExplorer && <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />}

        {activeLayers?.showCoverage && coverage.features.length > 0 && (
          <Source id="coverage-source" type="geojson" data={coverage}>
            <Layer {...coverageFill} />
          </Source>
        )}

        {publicExplorer && activeLayers?.populationLayer && populationGeoJson.features.length > 0 && (
          <Source id="population-source" type="geojson" data={populationGeoJson} tolerance={0}>
            <Layer id="population-fill" type="fill" slot="middle" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.68 }} />
            <Layer id="population-line" type="line" slot="middle" paint={{ 'line-color': '#58746b', 'line-width': 0.8, 'line-opacity': 0.7 }} />
            <Layer id="population-selected" type="line" slot="middle" filter={['==', ['get', 'id'], selectedPopulationId || '']} paint={{ 'line-color': '#173f35', 'line-width': 2.5 }} />
          </Source>
        )}

        {activeLayers?.mcdaLayer && wilayahGeoJson.features.length > 0 && (
          // Coverage sudah disederhanakan bersama di pipeline; hindari simplifikasi ulang per tile.
          <Source id="wilayah-source" type="geojson" data={wilayahGeoJson} tolerance={publicExplorer ? 0 : undefined}>
            {/* Opasitas publik lebih kuat supaya kategori tidak larut pada warna basemap. */}
            <Layer {...wilayahFill} paint={publicExplorer ? { ...wilayahFill.paint, 'fill-opacity': 0.68 } : wilayahFill.paint} />
            <Layer {...wilayahLine} />
            <Layer {...wilayahSelected(publicExplorer ? selectedPopulationId : selectedWilayahId)} />
          </Source>
        )}

        {activeLayers?.showBlankSpots && displayedBlankSpots.features.length > 0 && (
          <Source id="blank-source" type="geojson" data={displayedBlankSpots}>
            {/* Overlay akses dibedakan dari merah kebutuhan agar arti dua lapisan tidak bercampur. */}
            <Layer {...blankFill} paint={publicExplorer ? { 'fill-color': '#1e3a8a', 'fill-opacity': 0.04 } : blankFill.paint} />
            <Layer {...blankLine} paint={publicExplorer ? { 'line-color': '#1e3a8a', 'line-width': 1.8, 'line-dasharray': [3, 2] } : blankLine.paint} />
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
          <Source id="schools-source" type="geojson" data={renderedSchoolData} cluster={publicExplorer} clusterMaxZoom={12} clusterRadius={42}>
            {publicExplorer && <Layer id="school-clusters" type="circle" filter={["has", "point_count"]} paint={{ "circle-color": "#1f6f5f", "circle-radius": ["step", ["get", "point_count"], 18, 25, 23, 100, 29], "circle-stroke-width": 3, "circle-stroke-color": "#fff" }} />}
            {publicExplorer && <Layer id="school-cluster-count" type="symbol" filter={["has", "point_count"]} layout={{ "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }} paint={{ "text-color": "#fff" }} />}
            <Layer {...schoolLayerStyle} filter={publicExplorer ? UNCLUSTERED : undefined} />
          </Source>
        )}

        {publicExplorer &&
          <Source id="bogor-boundary" type="geojson" data={BOGOR_BOUNDARY} tolerance={0} attribution='<a href="https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3">Batas: BIG (2022)</a>'>
            <Layer id="bogor-boundary-line" type="line" paint={{ "line-color": "#1f6f5f", "line-width": 1.5, "line-opacity": 0.8 }} />
          </Source>
        }

        {/* Lubang pada batas kabupaten mengikuti perimeter kota; keduanya tetap terlihat. */}
        {publicExplorer && <Source id="bogor-administrative-boundary" type="geojson" data={kabupatenBoundary} tolerance={0}>
          <Layer id="bogor-administrative-line" type="line" paint={{ 'line-color': '#234f42', 'line-width': 1.6, 'line-opacity': 0.85 }} />
        </Source>}

        {publicExplorer && activeLayers?.populationLayer && populationPopup && !selectedFeature && (
          <Popup className="school-preview-popup" maxWidth="280px" longitude={populationPopup.longitude} latitude={populationPopup.latitude} closeOnClick={false} onClose={() => setPopulationPopup(null)}>
            <section className="school-preview" aria-label="Penduduk kecamatan">
              <h3>{populationPopup.properties.nama}</h3>
              <p>{populationPopup.properties.kabupaten_kota}</p>
              <strong>{new Intl.NumberFormat('id-ID').format(populationPopup.properties.penduduk)} jiwa</strong>
              <p>Tahun {populationPopup.properties.tahun} · Jumlah penduduk total</p>
              <div className="school-preview-actions">
                <a href={populationPopup.properties.sumber_penduduk} target="_blank" rel="noreferrer">Sumber BPS ↗</a>
                <button className="school-preview-profile" onClick={() => { onDistrictSelect?.(populationPopup.properties.id); setPopulationPopup(null); }}>Lihat sekolah <ArrowRight size={14} /></button>
              </div>
            </section>
          </Popup>
        )}

        {selectedFeature && (
          <Popup
            className={publicExplorer ? "school-preview-popup" : undefined}
            maxWidth={publicExplorer ? "280px" : undefined}
            longitude={selectedFeature.longitude}
            latitude={selectedFeature.latitude}
            anchor="bottom"
            offset={12}
            onClose={() => setSelectedFeature(null)}
            closeButton={true}
            closeOnClick={false}
          >
            {publicExplorer ? (
              <section className="school-preview" aria-label="Pratinjau sekolah">
                <h3>{selectedFeature.properties.nama}</h3>
                <p>{[selectedFeature.properties.status, selectedFeature.properties.kecamatan && `Kec. ${selectedFeature.properties.kecamatan}`].filter(Boolean).join(" · ")}</p>
                <div className="school-preview-actions">
                  <button className="school-preview-profile" onClick={() => {
                    const school = schoolsById.get(String(selectedFeature.properties.id));
                    onSchoolSelect?.(school || { type: "Feature", geometry: { type: "Point", coordinates: [selectedFeature.longitude, selectedFeature.latitude] }, properties: selectedFeature.properties });
                  }}>Lihat profil <ArrowRight size={14} /></button>
                  <button className="school-preview-compare"
                    disabled={comparedSchools.length >= 3 || comparedSchools.some((school) => school.id === selectedFeature.properties.id)}
                    title={comparedSchools.some((school) => school.id === selectedFeature.properties.id) ? "Sudah ditambahkan" : comparedSchools.length >= 3 ? "Maksimal 3 sekolah" : "Tambah ke perbandingan"}
                    onClick={() => addToCompare(selectedFeature.properties)}>
                    {comparedSchools.some((school) => school.id === selectedFeature.properties.id) ? <Check size={14} /> : <Plus size={14} />}
                    {comparedSchools.some((school) => school.id === selectedFeature.properties.id) ? "Ditambahkan" : "Bandingkan"}
                  </button>
                </div>
              </section>
            ) : <div className="p-1 min-w-[180px] text-slate-800">
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
            </div>}
          </Popup>
        )}
      </MapView>
    </div>
  );
}
