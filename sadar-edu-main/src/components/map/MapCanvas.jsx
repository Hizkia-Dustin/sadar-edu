import { LocateFixed, Layers, ArrowRight, Plus, Check, Home } from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import MapView, { NavigationControl, Source, Layer, Popup, Marker } from "react-map-gl/mapbox";
import { useMapStore } from "../../store/useMapStore";
import { useDataStore } from "../../store/useDataStore";
import { rescoreFeatures, colorOf } from "../../lib/analysis";
import {
  BOGOR_BOUNDARY,
  BOGOR_VIEW_BOUNDS,
  REGIONAL_BOUNDS,
  isInBogor,
} from "../../lib/bogorBoundary";
import { populationColor } from "../../lib/population";
import { createCircleGeoJSON, formatDistance, haversineKm } from "../../lib/geoDistance";
import kabupatenBoundary from "../../data/kabupaten-bogor.geojson.json";
import { useDistrictHover } from "./useDistrictHover";
import { registerSchoolPins } from "./schoolPins";

const EMPTY_FC = { type: "FeatureCollection", features: [] };

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const UNCLUSTERED = ["!", ["has", "point_count"]];

const schoolLayerStyle = {
  id: "schools-layer",
  type: "symbol",
  layout: {
    "icon-image": ["match", ["get", "status"], "negeri", "school-pin-negeri", "swasta", "school-pin-swasta", "school-pin-unknown"],
    "icon-anchor": "bottom",
    "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.68, 12, 0.86, 16, 1],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
};

const clusterCirclePaint = {
  "circle-color": ["step", ["get", "point_count"], "#1f6f5f", 20, "#175649", 50, "#134e4a"],
  "circle-radius": ["step", ["get", "point_count"], 15, 20, 19, 50, 23],
  "circle-stroke-width": 2.5,
  "circle-stroke-color": "rgba(255, 255, 255, 0.92)",
  "circle-opacity": 0.92,
};

// Cincin lembut di belakang cluster: memberi kesan "titik hidup" pada peta publik
const clusterHaloPaint = {
  "circle-color": ["step", ["get", "point_count"], "#1f6f5f", 20, "#175649", 50, "#134e4a"],
  "circle-radius": ["step", ["get", "point_count"], 22, 20, 28, 50, 34],
  "circle-opacity": 0.24,
  "circle-blur": 0.3,
};

const focusHaloPaint = {
  "circle-color": "#0f766e",
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 14, 14, 22, 17, 28],
  "circle-opacity": 0.18,
  "circle-stroke-color": "#0f766e",
  "circle-stroke-width": 2,
  "circle-stroke-opacity": 0.75,
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
const wilayahChatHighlightFill = (ids) => ({
  id: "wilayah-chat-highlight-fill",
  type: "fill",
  slot: "middle",
  filter: ["in", ["to-string", ["get", "id"]], ["literal", ids && ids.length ? ids : ["__none__"]]],
  paint: { "fill-color": "#e11d48", "fill-opacity": 0.16 },
});
const wilayahChatHighlightLine = (ids) => ({
  id: "wilayah-chat-highlight-line",
  type: "line",
  slot: "middle",
  filter: ["in", ["to-string", ["get", "id"]], ["literal", ids && ids.length ? ids : ["__none__"]]],
  paint: { "line-color": "#be123c", "line-width": 3.4, "line-opacity": 0.98 },
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
  userLocation = null,
  radiusKm = null,
  pickLocationMode = false,
  onPickLocation,
  focusedSchoolCoords = null,
}) {
  const mapRef = useRef();
  const [populationPopup, setPopulationPopup] = useState(null);
  const [, setStyleTick] = useState(0);
  const publishedCamera = useRef(null);
  const initiallyFitted = useRef(false);
  const cameraPadding = useCallback(() => {
    if (!publicExplorer) return { top: 70, bottom: 50, left: 440, right: 50 };
    const mobile = window.innerWidth < 768;
    return {
      top: mobile ? 75 : 85, // Ruang lebih lapang di bagian atas agar utara Bogor (Cibinong dsk.) terlihat utuh
      bottom: mobile && panelOpen ? Math.round(window.innerHeight * 0.46) : 60,
      left: !mobile && panelOpen ? 385 : 40,
      right: 50,
    };
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
    highlightedWilayahIds,
    selectedCandidateId,
    setSelectedCandidateId,
  } = useMapStore();
  const activeLayers = publicLayers || storedLayers;
  const districtHover = useDistrictHover({
    enabled: !pickLocationMode && ((activeLayers?.populationLayer && Boolean(population?.features?.length)) || (publicExplorer && activeLayers?.mcdaLayer)),
    population,
    popupOpen: Boolean(selectedFeature || (activeLayers?.populationLayer && populationPopup)),
  });
  const mapConfig = useMemo(
    () => ({
      basemap: {
        lightPreset: "day",
        show3dObjects: Boolean(activeLayers?.show3DBuildings),
      },
    }),
    [activeLayers?.show3DBuildings]
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
      bearing: 0,
      pitch: 0,
      duration: viewState.transitionDuration || 0,
    });
  }, [viewState]);

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

  // Spotlight spasial: ketika satu kecamatan dipilih atau beberapa kecamatan disorot chat, wilayah lain diredupkan
  const activeDistrictKey = publicExplorer ? selectedPopulationId : selectedWilayahId;
  const wilayahFillPaint = useMemo(() => {
    if (activeDistrictKey) {
      const targetVal = Number.isFinite(Number(activeDistrictKey)) ? Number(activeDistrictKey) : String(activeDistrictKey);
      return {
        "fill-color": ["get", "color"],
        "fill-opacity": ["case", ["==", ["get", "id"], targetVal], 0.54, 0.13],
      };
    }
    if (!publicExplorer && highlightedWilayahIds && highlightedWilayahIds.length > 0) {
      return {
        "fill-color": ["get", "color"],
        "fill-opacity": ["case", ["in", ["to-string", ["get", "id"]], ["literal", highlightedWilayahIds]], 0.56, 0.14],
      };
    }
    return {
      "fill-color": ["get", "color"],
      "fill-opacity": publicExplorer ? 0.55 : 0.38,
    };
  }, [activeDistrictKey, publicExplorer, highlightedWilayahIds]);

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
          status: String(feature.properties.status ?? "").trim().toLowerCase(),
        },
      })),
    };
  }, [schoolData, publicExplorer, selectedWilayahId, selectedWilayahName]);

  const fitPublicSchools = useCallback(() => {
    if (initiallyFitted.current || !mapRef.current) return;
    mapRef.current.fitBounds(BOGOR_VIEW_BOUNDS, {
      padding: cameraPadding(),
      duration: 0,
      maxZoom: 11,
      retainPadding: false,
    });
    initiallyFitted.current = true;
  }, [cameraPadding]);
  useEffect(() => {
    fitPublicSchools();
  }, [fitPublicSchools]);

  const onMapLoad = useCallback(
    (evt) => {
      registerSchoolPins(evt.target);
      try {
        evt.target.setConfigProperty("basemap", "show3dObjects", Boolean(activeLayers?.show3DBuildings));
      } catch {
        // Ignore if style does not support basemap config
      }
      evt.target.fire("styledata");
      setStyleTick((t) => t + 1);
      fitPublicSchools();
      if (typeof onMapLoaded === "function") onMapLoaded();
    },
    [activeLayers, onMapLoaded, fitPublicSchools]
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
    highlightedWilayahIds,
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

  const userRadiusGeoJson = useMemo(() => {
    if (!userLocation || !radiusKm || radiusKm <= 0) return EMPTY_FC;
    return createCircleGeoJSON([userLocation.lng, userLocation.lat], radiusKm);
  }, [userLocation, radiusKm]);

  const connectorGeoJson = useMemo(() => {
    if (!userLocation) return EMPTY_FC;
    const target =
      focusedSchoolCoords ||
      (selectedFeature ? [selectedFeature.longitude, selectedFeature.latitude] : null);
    if (!target) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [userLocation.lng, userLocation.lat],
              target,
            ],
          },
        },
      ],
    };
  }, [userLocation, focusedSchoolCoords, selectedFeature]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = pickLocationMode ? "crosshair" : "";
  }, [pickLocationMode]);

  const interactiveLayerIds = useMemo(() => {
    if (pickLocationMode) return [];
    const ids = [];
    if (activeLayers?.showSchools) {
      ids.push("schools-layer", "school-clusters");
    }
    if (activeLayers?.showCandidates && candidates.features.length) ids.push("candidate-fill");
    if (activeLayers?.mcdaLayer) ids.push("wilayah-fill");
    if (activeLayers?.populationLayer && populationGeoJson.features.length) ids.push("population-fill");
    return ids;
  }, [pickLocationMode, activeLayers, candidates.features.length, populationGeoJson.features.length]);

  const onMapClick = useCallback(
    (event) => {
      if (pickLocationMode && onPickLocation) {
        onPickLocation({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        return;
      }
      setPopulationPopup(null);
      const schoolHit = event.features?.find((item) => ["schools-layer", "school-clusters"].includes(item.layer.id));
      // Klik pada kepala pin dapat jatuh di seberang batas meski koordinat sekolah ada di Bogor.
      if (publicExplorer && !isInBogor(schoolHit?.geometry.coordinates ?? [event.lngLat.lng, event.lngLat.lat])) {
        setSelectedFeature(null);
        return;
      }
      // Prioritaskan klik titik/cluster sekolah, lalu kandidat, baru poligon kecamatan
      const feature =
        schoolHit ||
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
      pickLocationMode,
      onPickLocation,
    ]
  );

  const setCursor = useCallback((cursor) => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = pickLocationMode ? "crosshair" : cursor;
  }, [pickLocationMode]);

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
            title="Pusatkan seluruh Bogor"
            aria-label="Pusatkan seluruh Bogor"
            onClick={() => {
              mapRef.current?.fitBounds(BOGOR_VIEW_BOUNDS, {
                padding: cameraPadding(),
                duration: 750,
                maxZoom: 11,
              });
            }}
          >
            <LocateFixed size={19} />
          </button>
          <button title="Lapisan peta" aria-label="Lapisan peta" onClick={onOpenLayers}>
            <Layers size={19} />
          </button>
        </div>
      )}
      <MapView
        ref={mapRef}
        initialViewState={{ ...viewState, pitch: 0 }}
        onMoveEnd={syncViewState}
        mapStyle="mapbox://styles/mapbox/standard"
        config={mapConfig}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={onMapLoad}
        onStyleData={() => setStyleTick((t) => t + 1)}
        projection="mercator"
        maxPitch={0}
        minZoom={8}
        maxBounds={REGIONAL_BOUNDS}
        {...(publicExplorer ? { onMouseMove: districtHover.move } : { onMouseMove: districtHover.move })}
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
        <NavigationControl position={publicExplorer ? "top-right" : "bottom-right"} showCompass={false} visualizePitch={false} />

        {activeLayers?.showCoverage && coverage.features.length > 0 && (
          <Source id="coverage-source" type="geojson" data={coverage} tolerance={0}>
            <Layer {...coverageFill} />
            <Layer {...coverageLine} />
          </Source>
        )}

        {activeLayers?.populationLayer && populationGeoJson.features.length > 0 && (
          <Source id="population-source" type="geojson" data={populationGeoJson} tolerance={0}>
            <Layer id="population-fill" type="fill" slot="middle" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.6 }} />
            <Layer id="population-line" type="line" slot="middle" paint={{ "line-color": "#58746b", "line-width": 0.85, "line-opacity": 0.65 }} />
            <Layer id="population-selected" type="line" slot="middle" filter={["==", ["get", "id"], selectedPopulationId || ""]} paint={{ "line-color": "#173f35", "line-width": 2.5 }} />
          </Source>
        )}

        {activeLayers?.mcdaLayer && wilayahGeoJson.features.length > 0 && (
          <Source id="wilayah-source" type="geojson" data={wilayahGeoJson} tolerance={0}>
            <Layer {...wilayahFill} paint={wilayahFillPaint} />
            <Layer {...wilayahLine} />
            {!publicExplorer && <Layer {...wilayahChatHighlightFill(highlightedWilayahIds)} />}
            {!publicExplorer && <Layer {...wilayahChatHighlightLine(highlightedWilayahIds)} />}
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
            {publicExplorer && (
              <Layer id="school-cluster-halo" type="circle" filter={["has", "point_count"]} paint={clusterHaloPaint} />
            )}
            <Layer id="school-clusters" type="circle" filter={["has", "point_count"]} paint={clusterCirclePaint} />
            <Layer id="school-cluster-count" type="symbol" filter={["has", "point_count"]} layout={clusterCountLayout} paint={{ "text-color": "#ffffff" }} />
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
          <Layer
            id="bogor-boundary-halo"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 3.6, "line-opacity": 0.85 }}
          />
          <Layer
            id="bogor-boundary-line"
            type="line"
            paint={{ "line-color": "#1f6f5f", "line-width": 2, "line-opacity": 0.9 }}
          />
        </Source>

        {publicExplorer && (
          <Source id="bogor-administrative-boundary" type="geojson" data={kabupatenBoundary} tolerance={0}>
            <Layer id="bogor-administrative-line" type="line" paint={{ "line-color": "#234f42", "line-width": 1.4, "line-opacity": 0.75 }} />
          </Source>
        )}

        {userRadiusGeoJson.features.length > 0 && (
          <Source id="user-radius-source" type="geojson" data={userRadiusGeoJson}>
            <Layer id="user-radius-fill" type="fill" slot="middle" paint={{ "fill-color": "#0f766e", "fill-opacity": 0.09 }} />
            <Layer id="user-radius-line" type="line" slot="middle" paint={{ "line-color": "#0f766e", "line-width": 2, "line-dasharray": [4, 3], "line-opacity": 0.85 }} />
          </Source>
        )}

        {publicExplorer && focusedSchoolCoords && (
          <Source
            id="school-focus-halo"
            type="geojson"
            data={{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: focusedSchoolCoords } }}
          >
            <Layer id="school-focus-halo-circle" type="circle" slot="top" paint={focusHaloPaint} />
          </Source>
        )}

        {connectorGeoJson.features.length > 0 && (
          <Source id="user-school-connector" type="geojson" data={connectorGeoJson}>
            <Layer id="user-school-line" type="line" slot="top" paint={{ "line-color": "#0f766e", "line-width": 2.2, "line-dasharray": [2, 2], "line-opacity": 0.9 }} />
          </Source>
        )}

        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="bottom"
            draggable={Boolean(onPickLocation)}
            onDragEnd={(evt) => onPickLocation?.({ lng: evt.lngLat.lng, lat: evt.lngLat.lat })}
          >
            <div className="user-home-pin" title="Lokasi rumah Anda (geser untuk memindahkan)">
              <span className="user-home-pin-pulse" aria-hidden="true" />
              <span className="user-home-pin-head">
                <Home size={14} strokeWidth={2.3} />
              </span>
              <span className="user-home-pin-tip" aria-hidden="true" />
            </div>
          </Marker>
        )}

        {activeLayers?.populationLayer && populationPopup && !selectedFeature && (
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
                {onDistrictSelect && (
                  <button
                    className="school-preview-profile"
                    onClick={() => {
                      onDistrictSelect(populationPopup.properties.id, populationPopup.properties.nama);
                      setPopulationPopup(null);
                    }}
                  >
                    {publicExplorer ? "Lihat sekolah" : "Buka diagnosis"} <ArrowRight size={14} />
                  </button>
                )}
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
                  {[
                    selectedFeature.properties.status,
                    selectedFeature.properties.akreditasi && `Akr. ${selectedFeature.properties.akreditasi}`,
                    selectedFeature.properties.kecamatan && `Kec. ${selectedFeature.properties.kecamatan}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {userLocation && (
                  <p className="school-preview-distance">
                    {formatDistance(haversineKm([userLocation.lng, userLocation.lat], [selectedFeature.longitude, selectedFeature.latitude]))} dari lokasi rumah Anda
                  </p>
                )}
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
              <div className="pt-0.5 min-w-[248px] max-w-[290px] text-slate-800 space-y-2.5">
                <div>
                  <h3 className="font-bold text-[#132a25] text-sm leading-snug pr-9">{selectedFeature.properties.nama}</h3>
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
