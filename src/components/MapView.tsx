import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Coordinates, Place, PlaceCategory, Stop } from "../model/types";
import { createMapModules, focusMapLocation, loadGoogleMaps, renderGoogleRoutes, updateGoogleMap, updateGoogleMarkerState } from "../map/googleMaps";
import type { GoogleMapInstance, GooglePolylineInstance, GoogleRenderedMarker, MapViewHandle, MapsModules } from "../map/mapTypes";
import { Icon } from "./Icons";

interface MapViewProps {
  apiKey?: string;
  places: Place[];
  stops: Stop[];
  activeDayId?: string;
  essentialPlaceIds?: ReadonlySet<string>;
  selectedPlaceId?: string;
  hoveredPlaceId?: string;
  children?: ComponentChildren;
  onSelectPlace: (placeId: string) => void;
  onHoverPlace?: (placeId?: string) => void;
  onPreviewGooglePlace?: (googlePlaceId: string) => void;
  onRouteError?: (message: string) => void;
}

const WORLD_CENTER: Coordinates = { lat: 20, lng: 0 };
const EMPTY_PLACE_IDS: ReadonlySet<string> = new Set();

interface FallbackBounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

function fallbackBounds(places: Place[]): FallbackBounds {
  if (!places.length) return { minLat: -45, maxLat: 75, minLng: -180, maxLng: 180 };
  const lats = places.map((place) => place.coordinates.lat);
  const lngs = places.map((place) => place.coordinates.lng);
  const latPadding = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.2, 2);
  const lngPadding = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.2, 2);
  return { minLat: Math.min(...lats) - latPadding, maxLat: Math.max(...lats) + latPadding, minLng: Math.min(...lngs) - lngPadding, maxLng: Math.max(...lngs) + lngPadding };
}

function project(coordinates: Coordinates, bounds: FallbackBounds): { x: number; y: number } {
  const x = ((coordinates.lng - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 1)) * 100;
  const y = ((bounds.maxLat - coordinates.lat) / Math.max(bounds.maxLat - bounds.minLat, 1)) * 100;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(4, Math.min(96, y)) };
}

function placeIcon(category: PlaceCategory): string {
  if (category === "cafe") return "coffee";
  if (category === "food") return "food";
  if (category === "shopping") return "shopping";
  if (category === "activity") return "activity";
  return "pin";
}

function fallbackPath(stops: Stop[], places: Map<string, Place>, bounds: FallbackBounds): string {
  const points = stops
    .map((stop) => project(places.get(stop.placeId)?.coordinates ?? WORLD_CENTER, bounds))
    .filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
  return points
    .map(({ x, y }, index) => `${index ? "L" : "M"} ${x} ${y}`)
    .join(" ");
}

export function MapView({
  apiKey,
  places,
  stops,
  activeDayId,
  essentialPlaceIds = EMPTY_PLACE_IDS,
  selectedPlaceId,
  hoveredPlaceId,
  children,
  onSelectPlace,
  onHoverPlace,
  onPreviewGooglePlace,
  onRouteError,
}: MapViewProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const modulesRef = useRef<MapsModules | null>(null);
  const markerRef = useRef<Map<string, GoogleRenderedMarker>>(new Map());
  const polylinesRef = useRef<GooglePolylineInstance[]>([]);
  const renderGeneration = useRef(0);
  const previewGooglePlaceRef = useRef(onPreviewGooglePlace);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  previewGooglePlaceRef.current = onPreviewGooglePlace;

  const activeStops = useMemo(
    () => stops.filter((stop) => stop.dayId === activeDayId).sort((a, b) => a.order - b.order),
    [stops, activeDayId],
  );
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const scheduledIds = useMemo(() => new Set(stops.map((stop) => stop.placeId)), [stops]);
  const activeStopIds = useMemo(() => new Set(activeStops.map((stop) => stop.placeId)), [activeStops]);
  const essentialIds = essentialPlaceIds;
  const candidatePlaces = places.filter((place) => !activeStopIds.has(place.id) && !scheduledIds.has(place.id) && !essentialIds.has(place.id));
  const otherPlaces = places.filter((place) => !activeStopIds.has(place.id) && scheduledIds.has(place.id) && !essentialIds.has(place.id));
  const essentialPlaces = places.filter((place) => essentialIds.has(place.id) && !activeStopIds.has(place.id));

  useEffect(() => {
    if (!apiKey || !mapElementRef.current) return;
    let cancelled = false;
    setMapError("");

    void loadGoogleMaps(apiKey)
      .then(createMapModules)
      .then((modules) => {
        if (cancelled || !mapElementRef.current) return;
        modulesRef.current = modules;
        const map = new modules.Map(mapElementRef.current, {
          center: WORLD_CENTER,
          zoom: 2,
          mapId: "DEMO_MAP_ID",
          renderingType: "VECTOR",
          disableDefaultUI: true,
          clickableIcons: true,
          gestureHandling: "greedy",
        });
        map.addListener("click", (event) => {
          if (!event.placeId) return;
          event.stop?.();
          previewGooglePlaceRef.current?.(event.placeId);
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "Google Maps could not be loaded.");
      });

    return () => {
      cancelled = true;
      markerRef.current.forEach(({ marker }) => { marker.map = null; });
      polylinesRef.current.forEach((polyline) => polyline.setMap(null));
      markerRef.current.clear();
      polylinesRef.current = [];
      mapRef.current = null;
      modulesRef.current = null;
      setMapReady(false);
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const modules = modulesRef.current;
    if (!map || !modules || !mapReady) return;

    setMapError("");
    markerRef.current.forEach(({ marker }) => { marker.map = null; });
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    markerRef.current.clear();
    polylinesRef.current = [];
    const generation = ++renderGeneration.current;
    let result: ReturnType<typeof updateGoogleMap>;
    try {
      result = updateGoogleMap(map, modules, places, activeStops, stops, essentialIds, selectedPlaceId, hoveredPlaceId, onSelectPlace, onHoverPlace);
    } catch (error) {
      setMapError(error instanceof Error ? `Marker render failed: ${error.message}` : "Marker render failed.");
      return;
    }
    markerRef.current = result.markers;

    void renderGoogleRoutes(map, modules, places, activeStops, {
      onPolylineCreated: (polyline) => {
        if (generation === renderGeneration.current) polylinesRef.current.push(polyline);
        else polyline.setMap(null);
      },
      onRouteError: (message) => {
        if (generation === renderGeneration.current) onRouteError?.(message);
      },
    });
  }, [places, activeStops, stops, essentialIds, mapReady, onSelectPlace, onHoverPlace, onRouteError]);

  useEffect(() => {
    markerRef.current.forEach((rendered, placeId) => {
      updateGoogleMarkerState(rendered, placeId === selectedPlaceId, placeId === hoveredPlaceId);
    });
    const selected = selectedPlaceId ? placeById.get(selectedPlaceId) : undefined;
    if (selected && mapRef.current) focusMapLocation(mapRef.current, selected.coordinates);
  }, [selectedPlaceId, hoveredPlaceId, placeById]);

  const controls: MapViewHandle = {
    focus: (placeId) => {
      const place = placeById.get(placeId);
      if (place && mapRef.current) focusMapLocation(mapRef.current, place.coordinates);
    },
    zoom: (amount) => {
      if (mapRef.current) mapRef.current.setZoom((mapRef.current.getZoom() ?? 12) + amount);
    },
    reset: () => {
      if (!mapRef.current) return;
      const firstActivePlace = activeStops[0] ? placeById.get(activeStops[0].placeId) : undefined;
      const firstPlace = firstActivePlace ?? places[0];
      mapRef.current.setCenter(firstPlace?.coordinates ?? WORLD_CENTER);
      mapRef.current.setZoom(firstPlace ? 12 : 2);
    },
  };

  const fallbackPlaces = [
    ...activeStops.map((stop) => placeById.get(stop.placeId)).filter((place): place is Place => Boolean(place)),
    ...candidatePlaces,
    ...otherPlaces,
    ...essentialPlaces,
  ];
  const fallbackMapBounds = fallbackBounds(fallbackPlaces);
  const isFallback = !apiKey || Boolean(mapError) || !mapReady;

  return (
    <section className={`map-view ${isFallback ? "map-view--fallback" : ""}`}>
      <div ref={mapElementRef} className="google-map" />
      {isFallback && <div className="map-placeholder" aria-label="Map preview">
        <div className="map-grid" />
        <div className="map-river map-river--one" />
        <div className="map-river map-river--two" />
        <div className="map-label map-label--bangkok">{places.length ? "TRIP MAP" : "YOUR MAP"}</div>
        <div className="map-label map-label--phra">PLACES</div>
        <div className="map-label map-label--river">Trip map</div>
        <div className="map-label map-label--park">Essentials</div>
        <svg className="fallback-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={fallbackPath(activeStops, placeById, fallbackMapBounds)} />
        </svg>
        {fallbackPlaces.map((place) => {
          const activeStop = activeStops.find((stop) => stop.placeId === place.id);
          const kind = activeStop ? "active" : essentialIds.has(place.id) ? "essential" : scheduledIds.has(place.id) ? "other" : "candidate";
          const isSelected = selectedPlaceId === place.id;
          const isHovered = hoveredPlaceId === place.id;
          const point = project(place.coordinates, fallbackMapBounds);
          return <button
            key={place.id}
            data-map-place-id={place.id}
            className={`fallback-marker fallback-marker--${kind} fallback-marker--priority-${place.priority} ${isSelected ? "is-selected" : isHovered ? "is-hovered" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onClick={() => onSelectPlace(place.id)}
            onMouseEnter={() => onHoverPlace?.(place.id)}
            onMouseLeave={() => onHoverPlace?.(undefined)}
            title={place.name}
          >{kind === "active" ? activeStops.indexOf(activeStop!) + 1 : <span className="fallback-marker__glyph"><Icon name={placeIcon(place.category)} size={12} /></span>}<span className="fallback-marker__label">{place.name}</span></button>;
        })}
        <div className="map-fallback-note">
          <span className="map-fallback-note__dot" />
          {apiKey ? mapError || "Loading live map…" : "Live map preview"}
        </div>
      </div>}
      <div className="map-controls map-controls--compass"><Icon name="compass" size={17} /><span>N</span></div>
      <div className="map-controls map-controls--zoom">
        <button onClick={() => controls.zoom(1)} aria-label="Zoom in">+</button>
        <button onClick={() => controls.zoom(-1)} aria-label="Zoom out">−</button>
      </div>
      <button className="map-controls map-controls--locate" onClick={() => controls.reset()} aria-label="Reset map view"><Icon name="send" size={17} /></button>
      {!isFallback && <div className="map-poi-hint"><Icon name="pin" size={13} /> Click a Google place to preview it</div>}
      {!apiKey && <div className="map-key-warning"><strong>Google Maps key not configured</strong><span>Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env.local</code> for live map + search.</span></div>}
      {children}
    </section>
  );
}
