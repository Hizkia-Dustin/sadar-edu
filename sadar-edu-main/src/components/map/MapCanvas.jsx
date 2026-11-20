import { LocateFixed, Layers, ArrowRight, Plus, Check, Mountain, Map as MapIcon } from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import MapView, { NavigationControl, Source, Layer, Popup } from "react-map-gl/mapbox";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { rescoreFeatures, colorOf } from "../../lib/analysis";
import {
  BOGOR_BOUNDARY,
  BOGOR_BOUNDS,
  BOGOR_EXTENDED_BOUNDS,
  BOGOR_MASK_GEOJSON,
  isInBogor,
} from "../../lib/bogorBoundary";
import { populationColor } from "../../lib/population";
import kabupatenBoundary from "../../data/kabupaten-bogor.geojson.json";
import { useDistrictHover } from "./useDistrictHover";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const UNCLUSTERED = ["!", ["has", "point_count"]];

const schoolLayerStyle = {
  id: "schools-layer",
  type: "circle",
  slot: "top",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 11, 5.5, 14, 7.5, 16, 9.5],
    "circle-color": ["match", ["get", "status"], "Negeri", "#0f766e", "Swasta", "#d97706", "#64748B"],
    "circle-stroke-width": 1.75,
    "circle-stroke-color": "#ffffff",
  },
};

const clusterCirclePaint = {
  "circle-color": ["step", ["get", "point_count"], "#1f6f5f", 20, "#175649", 50, "#134e4a"],
  "circle-radius": ["step", ["get", "point_count"], 15, 20, 19, 50, 23],
  "circle-stroke-width": 2.5,
  "circle-stroke-color": "rgba(255, 255, 255, 0.92)",
  "circle-opacity": 0.92,
};

const clusterCountLayout = {
  "text-field": ["get", "point_count_abbreviated"],
  "text-size": 11,
};

// Polygon diletakkan di slot "middle" Mapbox Standard agar label jalan/tempat tetap terbaca jelas di atasnya
const wilayahFill = {
  id: "wilayah-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": ["get", "color"], "fill-opacity": 0.38 },
};
const wilayahLine = {
  id: "wilayah-line",
  type: "line",
  slot: "middle",
  paint: { "line-color": "#334155", "line-width": 0.9, "line-opacity": 0.45 },
};
const wilayahSelected = (id) => ({
  id: "wilayah-selected",
  type: "line",
  slot: "middle",
  filter: ["==", ["get", "id"], id == null ? -1 : Number.isFinite(Number(id)) ? Number(id) : id],
  paint: { "line-color": "#0f172a", "line-width": 2.8, "line-opacity": 0.95 },
});

const blankFill = {
  id: "blank-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": "#1e3a8a", "fill-opacity": 0.06 },
};
const blankLine = {
  id: "blank-line",
  type: "line",
  slot: "middle",
  paint: { "line-color": "#1e3a8a", "line-width": 1.6, "line-dasharray": [3, 2], "line-opacity": 0.75 },
};
const coverageFill = {
  id: "coverage-fill",
  type: "fill",
  slot: "middle",
  paint: { "fill-color": "#0284c7", "fill-opacity": 0.1 },
};
const coverageLine = {
  id: "coverage-line",
  type: "line",
  slot: "middle",
  paint: { "line-color": "#0369a1", "line-width": 1.2, "line-opacity": 0.6 },
};

const candidateFill = {
  id: "candidate-fill",
  type: "fill",
  slot: "top",
  paint: {
    "fill-color": ["match", ["get", "status"], "Disetujui", "#16a34a", "Dipertimbangkan", "#0ea5e9", "Ditolak", "#94a3b8", "#7c3aed"],
    "fill-opacity": 0.5,
  },
};
const candidateLine = {
  id: "candidate-line",
  type: "line",
  slot: "top",
  paint: { "line-color": "#ffffff", "line-width": 1.75 },
};
const candidateSelected = (id) => ({
  id: "candidate-selected",
  type: "line",
  slot: "top",
  filter: ["==", ["get", "id"], id === null ? -1 : Number(id)],
  paint: { "line-color": "#0f172a", "line-width": 3 },
});

export default function MapCanvas({
  onMapLoaded,
  schools,
  publicExplorer = false,
  publicLayers,
  panelOpen = false,
  onOpenLayers,
  onSchoolSelect,
  population,
  publicBlankSpots,
  publicNeeds,
  onDistrictSelect,
  selectedPopulationId,
}) {
  const mapRef = useRef();
  const [populationPopup, setPopulationPopup] = useState(null);
  const [, setStyleTick] = useState(0);
  const publishedCamera = useRef(null);
  const initiallyFitted = useRef(false);
  const cameraPadding = useCallback(() => {
    if (!publicExplorer) return { top: 90, bottom: 60, left: 460, right: 60 };
    const mobile = window.innerWidth < 768;
    return { top: 110, bottom: mobile && panelOpen ? Math.round(window.innerHeight * 0.48) : 70, left: !mobile && panelOpen ? 390 : 40, right: 60 };
  }, [publicExplorer, panelOpen]);

  const {
    viewState,
    setViewState,
    activeLayers: storedLayers,
    selectedFeature,
    setSelectedFeature,
    addToCompare,
    comparedSchools,
    pendingBounds,
    selectedWilayahId,
    setSelectedWilayahId,
    selectedCandidateId,
    setSelectedCandidateId,
    mapMode,
    toggleMapMode,
  } = useMapStore();
  const activeLayers = publicLayers || storedLayers;
  const districtHover = useDistrictHover({
    enabled: publicExplorer && (activeLayers?.populationLayer || activeLayers?.mcdaLayer),
    population,
    popupOpen: Boolean(selectedFeature || (activeLayers?.populationLayer && populationPopup)),
  });
  const mapConfig = useMemo(
    () => ({
      basemap: {
        lightPreset: "day",
        show3dObjects: Boolean(activeLayers?.show3DBuildings || mapMode === "3d"),
      },
    }),
    [activeLayers?.show3DBuildings, mapMode]
  );
  const syncViewState = useCallback(
    (event) => {
      publishedCamera.current = event.viewState;
      setViewState(event.viewState);
    },
    [setViewState]
  );

  // Mapbox owns animation frames; publish the camera only when movement ends.
  useEffect(() => {
    if (!mapRef.current || viewState === publishedCamera.current) return;
    const map = mapRef.current.getMap();
    const center = map.getCenter();
    if (
      Math.abs(center.lng - viewState.longitude) < 1e-7 &&
      Math.abs(center.lat - viewState.latitude) < 1e-7 &&
      Math.abs(map.getZoom() - viewState.zoom) < 1e-7
    )
      return;
    map.easeTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing !== undefined ? viewState.bearing : (mapMode === "3d" ? -14 : 0),
      pitch: mapMode === "3d" ? (viewState.pitch || 56) : 0,
      duration: viewState.transitionDuration || 0,
    });
  }, [viewState, mapMode]);

  // Transisi halus ketika berganti antara mode 2D Standar dan 3D Terrain
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (!map) return;

    const applyTerrain = () => {
      try {
        if (mapMode === "3d") {
          if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 14,
            });
          }
          map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
          map.easeTo({
            pitch: 56,
            bearing: -14,
            duration: 1200,
          });
        } else {
          map.setTerrain(null);
          map.easeTo({
            pitch: 0,
            bearing: 0,
            duration: 900,
          });
        }
      } catch {
        // Abaikan jika style sedang memuat ulang
      }
    };

    if (map.isStyleLoaded()) {
      applyTerrain();
    } else {
      map.once("style.load", applyTerrain);
    }
  }, [mapMode]);

  const { prioritas, meta, weights, sekolah, blankSpots, coverage, candidates, kecamatan } = useDataStore();
  const displayedBlankSpots = publicExplorer && publicBlankSpots ? publicBlankSpots : blankSpots;

  const populationGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: (population?.features || []).map((feature) => ({
        ...feature,
        properties: { ...feature.properties, color: populationColor(feature.properties.penduduk) },
      })),
    }),
    [population]
  );

  const wilayahGeoJson = useMemo(() => {
    if (publicExplorer && publicNeeds)
      return {
        type: "FeatureCollection",
        features: publicNeeds.features.map((feature) => ({
          ...feature,
          properties: {
            id: feature.properties.id_wilayah,
            nama: feature.properties.nama_wilayah,
            skor: feature.properties.skor_total,
            kategori: feature.properties.kategori_prioritas,
            color: colorOf(feature.properties.kategori_prioritas),
          },
        })),
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

  // Spotlight spasial: ketika satu kecamatan dipilih, kecamatan lain diredupkan agar fokus visual tajam
  const activeDistrictKey = publicExplorer ? selectedPopulationId : selectedWilayahId;
  const wilayahFillPaint = useMemo(() => {
    if (!activeDistrictKey) {
      return {
        "fill-color": ["get", "color"],
        "fill-opacity": publicExplorer ? 0.55 : 0.38,
      };
    }
    const targetVal = Number.isFinite(Number(activeDistrictKey)) ? Number(activeDistrictKey) : String(activeDistrictKey);
    return {
      "fill-color": ["get", "color"],
      "fill-opacity": ["case", ["==", ["get", "id"], targetVal], 0.52, 0.13],
    };
  }, [activeDistrictKey, publicExplorer]);

  const candidateGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: candidates.features.map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: f.properties.id_candidate,
          id_wilayah: f.properties.id_wilayah,
          skor: f.properties.skor_suitability,
          status: f.properties.status_kandidat,
          nama: f.properties.nama_wilayah,
        },
      })),
    }),
    [candidates]
  );

  const schoolData = schools || sekolah;
  const schoolsById = useMemo(
    () => new Map(schoolData.features.map((feature) => [String(feature.properties.id), feature])),
    [schoolData]
  );

  // Di halaman Stakeholder: jika ada kecamatan yang sedang dipilih, fokuskan titik sekolah pada kecamatan tersebut
  const selectedWilayahName = useMemo(() => {
    if (publicExplorer || !selectedWilayahId) return null;
    const found = kecamatan.find((k) => String(k.id) === String(selectedWilayahId));
    return found?.name ? found.name.toLowerCase().replace(/\s+/g, "") : null;
  }, [publicExplorer, selectedWilayahId, kecamatan]);

  const renderedSchoolData = useMemo(() => {
    let list = schoolData.features;
    if (!publicExplorer && selectedWilayahId) {
      const targetId = String(selectedWilayahId);
      const filtered = list.filter((f) => {
        const p = f.properties || {};
        if (p.id_wilayah && String(p.id_wilayah) === targetId) return true;
        if (selectedWilayahName && p.kecamatan) {
          return p.kecamatan.toLowerCase().replace(/\s+/g, "") === selectedWilayahName;
        }
        return false;
      });
      if (filtered.length > 0) list = filtered;
    }
    return {
      type: "FeatureCollection",
      features: list.map((feature) => ({
        type: "Feature",
        geometry: feature.geometry,
        properties: {
          id: feature.properties.id,
          status: feature.properties.status === "Negeri" ? "Negeri" : "Swasta",
        },
      })),
    };
  }, [schoolData, publicExplorer, selectedWilayahId, selectedWilayahName]);

  const fitPublicSchools = useCallback(() => {
    if (initiallyFitted.current || !mapRef.current) return;
    mapRef.current.fitBounds(BOGOR_BOUNDS, {
      padding: cameraPadding(),
      duration: 0,
      maxZoom: 11,
      pitch: mapMode === "3d" ? 56 : 0,
      bearing: mapMode === "3d" ? -14 : 0,
      retainPadding: false,
    });
    initiallyFitted.current = true;
  }, [cameraPadding, mapMode]);
  useEffect(() => {
    fitPublicSchools();
  }, [fitPublicSchools]);

  const onMapLoad = useCallback(
    (evt) => {
      const map = evt.target;
      try {
        map.setConfigProperty("basemap", "show3dObjects", Boolean(activeLayers?.show3DBuildings || mapMode === "3d"));
      } catch {
        // Ignore if style does not support basemap config
      }
      try {
        if (mapMode === "3d") {
          if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 14,
            });
          }
          map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        }
      } catch {
        // Ignore
      }
      map.fire("styledata");
      setStyleTick((t) => t + 1);
      fitPublicSchools();
      if (typeof onMapLoaded === "function") onMapLoaded();
    },
    [activeLayers, onMapLoaded, fitPublicSchools, mapMode]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (map && map.isStyleLoaded()) {
      map.fire("styledata");
    }
  }, [
    wilayahGeoJson.features.length,
    renderedSchoolData.features.length,
    displayedBlankSpots.features.length,
    coverage.features.length,
    candidateGeoJson.features.length,
    activeLayers,
    selectedWilayahId,
  ]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (map.isStyleLoaded()) {
      try {
        map.setConfigProperty("basemap", "show3dObjects", Boolean(activeLayers?.show3DBuildings));
      } catch {
        // Ignore
      }
    }
  }, [activeLayers?.show3DBuildings, publicExplorer]);

  useEffect(() => {
    if (!pendingBounds || !mapRef.current) return;
    const [minLng, minLat, maxLng, maxLat] = pendingBounds.bbox;
    mapRef.current.getMap().fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: cameraPadding(), duration: 950, maxZoom: 14 }
    );
  }, [pendingBounds, cameraPadding]);

  const interactiveLayerIds = useMemo(() => {
    const ids = [];
    if (activeLayers?.showSchools) {
      ids.push("schools-layer", "school-clusters");
    }
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
      // Prioritaskan klik titik/cluster sekolah, lalu kandidat, baru poligon kecamatan
      const feature =
        event.features?.find((item) => ["schools-layer", "school-clusters"].includes(item.layer.id)) ||
        event.features?.find((item) => item.layer.id === "candidate-fill") ||
        event.features?.[0];

      if (!feature) {
        setSelectedFeature(null);
        return;
      }
      if (feature.layer.id === "school-clusters") {
        setSelectedFeature(null);
        const source = mapRef.current.getMap().getSource("schools-source");
        if (source && typeof source.getClusterExpansionZoom === "function") {
          source.getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
            if (!error) {
              mapRef.current?.getMap().easeTo({
                center: feature.geometry.coordinates,
                zoom: Math.min(zoom + 0.5, 15),
                padding: cameraPadding(),
                duration: 450,
                retainPadding: false,
              });
            }
          });
        }
      } else if (feature.layer.id === "schools-layer") {
        const [longitude, latitude] = feature.geometry.coordinates;
        setSelectedFeature({
          longitude,
          latitude,
          properties: schoolsById.get(String(feature.properties.id))?.properties || feature.properties,
        });
      } else if (feature.layer.id === "candidate-fill") {
        setSelectedFeature(null);
        setSelectedCandidateId(feature.properties.id);
        if (feature.properties.id_wilayah) setSelectedWilayahId(feature.properties.id_wilayah);
      } else if (feature.layer.id === "wilayah-fill") {
        setSelectedFeature(null);
        if (publicExplorer && onDistrictSelect) {
          onDistrictSelect(feature.properties.id);
        } else {
          // Klik ulang kecamatan yang sama akan melepas spotlight kembali ke seluruh Bogor
          const clickedId = String(feature.properties.id);
          if (selectedWilayahId && String(selectedWilayahId) === clickedId) {
            setSelectedWilayahId(null);
          } else {
            setSelectedWilayahId(feature.properties.id);
            const k = kecamatan.find((x) => String(x.id) === clickedId);
            if (k && k.bbox && mapRef.current) {
              const [minLng, minLat, maxLng, maxLat] = k.bbox;
              mapRef.current.getMap().fitBounds(
                [
                  [minLng, minLat],
                  [maxLng, maxLat],
                ],
                { padding: cameraPadding(), duration: 850, maxZoom: 13.5 }
              );
            }
          }
        }
      } else if (feature.layer.id === "population-fill") {
        setSelectedFeature(null);
        setPopulationPopup({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, properties: feature.properties });
      }
    },
    [
      setSelectedFeature,
      setSelectedWilayahId,
      setSelectedCandidateId,
      cameraPadding,
      schoolsById,
      publicExplorer,
      onDistrictSelect,
      selectedWilayahId,
      kecamatan,
    ]
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
      {publicExplorer && (
        <div className="explorer-map-tools" aria-label="Alat peta">
          <button
            title="Tampilkan seluruh Bogor"
            aria-label="Tampilkan seluruh Bogor"
            onClick={() => {
              initiallyFitted.current = false;
              fitPublicSchools();
            }}
          >
            <LocateFixed size={19} />
          </button>
          <button
            title={mapMode === "3d" ? "Kembali ke mode 2D Standar" : "Beralih ke mode 3D Terrain"}
            aria-label={mapMode === "3d" ? "Kembali ke mode 2D Standar" : "Beralih ke mode 3D Terrain"}
            onClick={toggleMapMode}
            className={mapMode === "3d" ? "is-3d-active" : ""}
          >
            {mapMode === "3d" ? <MapIcon size={19} /> : <Mountain size={19} />}
          </button>
          <button title="Lapisan peta" aria-label="Lapisan peta" onClick={onOpenLayers}>
            <Layers size={19} />
          </button>
        </div>
      )}
      <MapView
        ref={mapRef}
        initialViewState={{ ...viewState, pitch: mapMode === "3d" ? 56 : 0 }}
        onMoveEnd={syncViewState}
        mapStyle="mapbox://styles/mapbox/standard"
        config={mapConfig}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={onMapLoad}
        onStyleData={() => setStyleTick((t) => t + 1)}
        projection="mercator"
        maxPitch={mapMode === "3d" ? 75 : 0}
        minPitch={0}
        minZoom={8}
        dragRotate={mapMode === "3d"}
        touchPitch={mapMode === "3d"}
        terrain={mapMode === "3d" ? { source: "mapbox-dem", exaggeration: 1.5 } : undefined}
        {...(publicExplorer ? { maxBounds: BOGOR_EXTENDED_BOUNDS, onMouseMove: districtHover.move } : {})}
        renderWorldCopies={!publicExplorer}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(event) => {
          districtHover.hide();
          onMapClick(event);
        }}
        onMoveStart={districtHover.hide}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => {
          setCursor("");
          districtHover.hide();
        }}
      >
        <NavigationControl
          position={publicExplorer ? "top-right" : "bottom-right"}
          showCompass={mapMode === "3d"}
          visualizePitch={mapMode === "3d"}
        />

        {/* Raster DEM source untuk terrain 3D */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />

        {/* Masking Luar Wilayah: Memotong peta agar fokus visual hanya menampilkan Bogor */}
        {publicExplorer && (
          <Source id="bogor-mask-source" type="geojson" data={BOGOR_MASK_GEOJSON} tolerance={0}>
            <Layer
              id="bogor-mask-fill"
              type="fill"
              slot="top"
              paint={{
                "fill-color": mapMode === "3d" ? "#0f172a" : "#e9eee8",
                "fill-opacity": mapMode === "3d" ? 0.94 : 0.98,
              }}
            />
            <Layer
              id="bogor-mask-glow"
              type="line"
              slot="top"
              paint={{
                "line-color": mapMode === "3d" ? "rgba(16, 185, 129, 0.4)" : "rgba(31, 111, 95, 0.25)",
                "line-width": 5,
                "line-opacity": 0.6,
              }}
            />
            <Layer
              id="bogor-mask-line"
              type="line"
              slot="top"
              paint={{
                "line-color": "#1f6f5f",
                "line-width": 2.2,
                "line-opacity": 0.95,
              }}
            />
          </Source>
        )}

        {activeLayers?.showCoverage && coverage.features.length > 0 && (
          <Source id="coverage-source" type="geojson" data={coverage} tolerance={0}>
            <Layer {...coverageFill} />
            <Layer {...coverageLine} />
          </Source>
        )}

        {publicExplorer && activeLayers?.populationLayer && populationGeoJson.features.length > 0 && (
          <Source id="population-source" type="geojson" data={populationGeoJson} tolerance={0}>
            <Layer id="population-fill" type="fill" slot="middle" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.62 }} />
            <Layer id="population-line" type="line" slot="middle" paint={{ "line-color": "#58746b", "line-width": 0.8, "line-opacity": 0.65 }} />
            <Layer id="population-selected" type="line" slot="middle" filter={["==", ["get", "id"], selectedPopulationId || ""]} paint={{ "line-color": "#173f35", "line-width": 2.5 }} />
          </Source>
        )}

        {activeLayers?.mcdaLayer && wilayahGeoJson.features.length > 0 && (
          <Source id="wilayah-source" type="geojson" data={wilayahGeoJson} tolerance={0}>
            <Layer {...wilayahFill} paint={wilayahFillPaint} />
            <Layer {...wilayahLine} />
            <Layer {...wilayahSelected(activeDistrictKey)} />
          </Source>
        )}

        {activeLayers?.showBlankSpots && displayedBlankSpots.features.length > 0 && (
          <Source id="blank-source" type="geojson" data={displayedBlankSpots} tolerance={0}>
            <Layer {...blankFill} />
            <Layer {...blankLine} />
          </Source>
        )}

        {activeLayers?.showCandidates && candidateGeoJson.features.length > 0 && (
          <Source id="candidate-source" type="geojson" data={candidateGeoJson} tolerance={0}>
            <Layer {...candidateFill} />
            <Layer {...candidateLine} />
            <Layer {...candidateSelected(selectedCandidateId)} />
          </Source>
        )}

        {activeLayers?.showSchools && renderedSchoolData.features.length > 0 && (
          <Source
            id="schools-source"
            type="geojson"
            data={renderedSchoolData}
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={publicExplorer ? 42 : 52}
          >
            <Layer id="school-clusters" type="circle" slot="top" filter={["has", "point_count"]} paint={clusterCirclePaint} />
            <Layer id="school-cluster-count" type="symbol" slot="top" filter={["has", "point_count"]} layout={clusterCountLayout} paint={{ "text-color": "#ffffff" }} />
            <Layer {...schoolLayerStyle} filter={UNCLUSTERED} />
          </Source>
        )}

        <Source
          id="bogor-boundary"
          type="geojson"
          data={BOGOR_BOUNDARY}
          tolerance={0}
          attribution='<a href="https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3">Batas: BIG (2022)</a>'
        >
          <Layer id="bogor-boundary-line" type="line" paint={{ "line-color": "#1f6f5f", "line-width": 1.6, "line-opacity": 0.75 }} />
        </Source>

        {publicExplorer && (
          <Source id="bogor-administrative-boundary" type="geojson" data={kabupatenBoundary} tolerance={0}>
            <Layer id="bogor-administrative-line" type="line" paint={{ "line-color": "#234f42", "line-width": 1.4, "line-opacity": 0.75 }} />
          </Source>
        )}

        {publicExplorer && activeLayers?.populationLayer && populationPopup && !selectedFeature && (
          <Popup
            className="school-preview-popup"
            maxWidth="280px"
            longitude={populationPopup.longitude}
            latitude={populationPopup.latitude}
            closeOnClick={false}
            onClose={() => setPopulationPopup(null)}
          >
            <section className="school-preview" aria-label="Penduduk kecamatan">
              <h3>{populationPopup.properties.nama}</h3>
              <p>{populationPopup.properties.kabupaten_kota}</p>
              <strong>{new Intl.NumberFormat("id-ID").format(populationPopup.properties.penduduk)} jiwa</strong>
              <p>Tahun {populationPopup.properties.tahun} · Jumlah penduduk total</p>
              <div className="school-preview-actions">
                <a href={populationPopup.properties.sumber_penduduk} target="_blank" rel="noreferrer">
                  Sumber BPS ↗
                </a>
                <button
                  className="school-preview-profile"
                  onClick={() => {
                    onDistrictSelect?.(populationPopup.properties.id);
                    setPopulationPopup(null);
                  }}
                >
                  Lihat sekolah <ArrowRight size={14} />
                </button>
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
                <p>
                  {[selectedFeature.properties.status, selectedFeature.properties.kecamatan && `Kec. ${selectedFeature.properties.kecamatan}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="school-preview-actions">
                  <button
                    className="school-preview-profile"
                    onClick={() => {
                      const school = schoolsById.get(String(selectedFeature.properties.id));
                      onSchoolSelect?.(
                        school || {
                          type: "Feature",
                          geometry: { type: "Point", coordinates: [selectedFeature.longitude, selectedFeature.latitude] },
                          properties: selectedFeature.properties,
                        }
                      );
                    }}
                  >
                    Lihat profil <ArrowRight size={14} />
                  </button>
                  <button
                    className="school-preview-compare"
                    disabled={comparedSchools.length >= 3 || comparedSchools.some((school) => school.id === selectedFeature.properties.id)}
                    title={
                      comparedSchools.some((school) => school.id === selectedFeature.properties.id)
                        ? "Sudah ditambahkan"
                        : comparedSchools.length >= 3
                        ? "Maksimal 3 sekolah"
                        : "Tambah ke perbandingan"
                    }
                    onClick={() => addToCompare(selectedFeature.properties)}
                  >
                    {comparedSchools.some((school) => school.id === selectedFeature.properties.id) ? <Check size={14} /> : <Plus size={14} />}
                    {comparedSchools.some((school) => school.id === selectedFeature.properties.id) ? "Ditambahkan" : "Bandingkan"}
                  </button>
                </div>
              </section>
            ) : (
              <div className="p-1.5 min-w-[240px] max-w-[280px] text-slate-800 space-y-2.5">
                <div>
                  <h3 className="font-bold text-[#132a25] text-sm leading-snug pr-4">{selectedFeature.properties.nama}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    NPSN {selectedFeature.properties.npsn || "-"}
                    {selectedFeature.properties.kecamatan ? ` · Kec. ${selectedFeature.properties.kecamatan}` : ""}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs border-y border-slate-100 py-1.5">
                  <span className="font-semibold text-slate-800">
                    {selectedFeature.properties.status} · Akred. {selectedFeature.properties.akreditasi || "Belum"}
                  </span>
                  <span className="text-slate-600">
                    {selectedFeature.properties.jumlahSiswa ?? "-"} siswa · {selectedFeature.properties.ruangKelas ?? "-"} kls
                  </span>
                </div>

                {selectedFeature.properties.ruangKelas !== null && selectedFeature.properties.ruangKelas !== undefined && (
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Baik: <strong>{selectedFeature.properties.kelasBaik ?? 0}</strong></span>
                    <span>R. Sedang: <strong className="text-amber-800">{selectedFeature.properties.kelasRusakSedang ?? 0}</strong></span>
                    <span>R. Berat: <strong className="text-rose-700">{selectedFeature.properties.kelasRusakBerat ?? 0}</strong></span>
                  </div>
                )}

                <div className="flex gap-1.5 pt-0.5">
                  {selectedFeature.properties.id_wilayah && (
                    <button
                      onClick={() => {
                        setSelectedWilayahId(selectedFeature.properties.id_wilayah);
                        setSelectedFeature(null);
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs py-1.5 px-2 rounded-lg transition-colors font-semibold"
                    >
                      Diagnosis Kec.
                    </button>
                  )}
                  <button
                    disabled={comparedSchools.length >= 3 || comparedSchools.some((s) => s.id === selectedFeature.properties.id)}
                    onClick={() => {
                      addToCompare(selectedFeature.properties);
                      setSelectedFeature(null);
                    }}
                    className="flex-1 bg-[#1F6F5F] hover:bg-[#175649] disabled:bg-slate-300 text-white text-xs py-1.5 px-2 rounded-lg transition-colors font-semibold"
                  >
                    {comparedSchools.some((s) => s.id === selectedFeature.properties.id) ? "Dibandingkan" : "+ Bandingkan"}
                  </button>
                </div>
              </div>
            )}
          </Popup>
        )}
      </MapView>
    </div>
  );
}
