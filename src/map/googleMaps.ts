import type { Coordinates, Place, PlaceCategory, PlacePriority, Stop } from "../model/types";
import {
  modeToGoogleTravelMode,
  readGoogleLocation,
  type GoogleMapsGlobal,
  type GoogleMapInstance,
  type GoogleRenderedMarker,
  type GooglePinElement,
  type GooglePlaceResult,
  type GoogleRouteClass,
  type GooglePolylineInstance,
  type MapsModules,
} from "./mapTypes";

declare global {
  interface Window {
    google?: { maps?: GoogleMapsGlobal };
  }
}

let scriptPromise: Promise<GoogleMapsGlobal> | null = null;

/** Load Maps JS using Google's importLibrary bootstrap pattern. */
export async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsGlobal> {
  const currentMaps = window.google?.maps;
  if (currentMaps?.importLibrary && currentMaps.Map && !currentMaps.__plannerImportLibraryStub) return currentMaps;
  if (scriptPromise) return scriptPromise;

  if (currentMaps?.importLibrary) {
    Reflect.deleteProperty(currentMaps, "importLibrary");
    Reflect.deleteProperty(currentMaps, "__plannerImportLibraryStub");
  }

  scriptPromise = new Promise<GoogleMapsGlobal>((resolve, reject) => {
    const google = window.google ?? (window.google = {});
    const maps = google.maps ?? (google.maps = {} as GoogleMapsGlobal);
    const libraries = new Set<string>();
    let bootstrapPromise: Promise<void> | undefined;
    let importerStub: GoogleMapsGlobal["importLibrary"];

    const startBootstrap = (): Promise<void> => {
      if (bootstrapPromise) return bootstrapPromise;
      bootstrapPromise = new Promise<void>((bootstrapResolve, bootstrapReject) => {
        const script = document.createElement("script");
        const params = new URLSearchParams({
          key: apiKey,
          v: "weekly",
          callback: "google.maps.__plannerInit",
          libraries: [...libraries].join(","),
        });
        maps.__plannerInit = bootstrapResolve;
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => bootstrapReject(new Error("Google Maps could not be loaded. Check the API key and allowed origins."));
        document.head.appendChild(script);
      });
      return bootstrapPromise;
    };

    importerStub = (library: string) => {
      libraries.add(library);
      return startBootstrap().then(() => {
        const importer = window.google?.maps?.importLibrary;
        if (!importer || importer === importerStub) throw new Error("Google Maps loaded without importLibrary.");
        return importer(library);
      });
    };

    maps.importLibrary = importerStub;
    maps.__plannerImportLibraryStub = true;

    importerStub("maps").then(() => {
      maps.__plannerImportLibraryStub = false;
      delete maps.__plannerInit;
      resolve(maps);
    }).catch((error: unknown) => {
      if (maps.importLibrary === importerStub) Reflect.deleteProperty(maps, "importLibrary");
      delete maps.__plannerImportLibraryStub;
      delete maps.__plannerInit;
      reject(error);
    });
  });

  try {
    return await scriptPromise;
  } catch (error) {
    scriptPromise = null;
    throw error;
  }
}

export async function searchGooglePlaces(apiKey: string, query: string): Promise<GooglePlaceResult[]> {
  const maps = await loadGoogleMaps(apiKey);
  const placesLibrary = await maps.importLibrary("places");
  const Place = placesLibrary.Place as {
    searchByText: (request: Record<string, unknown>) => Promise<{ places?: GooglePlaceResult[] }>;
  };

  const response = await Place.searchByText({
    textQuery: query,
    fields: ["id", "displayName", "formattedAddress", "location", "googleMapsURI"],
    maxResultCount: 5,
  });
  return response.places ?? [];
}

export async function fetchGooglePlace(apiKey: string, googlePlaceId: string): Promise<GooglePlaceResult | null> {
  const maps = await loadGoogleMaps(apiKey);
  const placesLibrary = await maps.importLibrary("places");
  const Place = placesLibrary.Place as {
    new (options: { id: string }): {
      id?: string;
      displayName?: string;
      formattedAddress?: string;
      location?: GooglePlaceResult["location"];
      googleMapsURI?: string;
      fetchFields: (request: { fields: string[] }) => Promise<void>;
    };
  };
  const place = new Place({ id: googlePlaceId });
  await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location", "googleMapsURI"] });
  return {
    id: place.id ?? googlePlaceId,
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    location: place.location,
    googleMapsURI: place.googleMapsURI,
  };
}

export function googleResultToPlace(result: GooglePlaceResult, tripId: string, id: string): Place | null {
  const coordinates = readGoogleLocation(result.location);
  if (!coordinates || !result.displayName) return null;

  return {
    id,
    tripId,
    name: result.displayName,
    coordinates,
    formattedAddress: result.formattedAddress,
    category: "other",
    priority: "candidate",
    tags: ["google"],
    highlights: [],
    googlePlaceId: result.id,
    googleMapsUrl: result.googleMapsURI,
  };
}

export async function createMapModules(maps: GoogleMapsGlobal): Promise<MapsModules> {
  const [coreLibrary, mapsLibrary, markerLibrary] = await Promise.all([
    maps.importLibrary("core"),
    maps.importLibrary("maps"),
    maps.importLibrary("marker"),
  ]);
  let routesLibrary: Record<string, unknown> = {};
  try {
    routesLibrary = await maps.importLibrary("routes");
  } catch {
    // Routes is optional: the base map and markers must still work without it.
  }

  return {
    Map: mapsLibrary.Map as MapsModules["Map"],
    LatLngBounds: coreLibrary.LatLngBounds as MapsModules["LatLngBounds"],
    AdvancedMarkerElement: markerLibrary.AdvancedMarkerElement as MapsModules["AdvancedMarkerElement"],
    PinElement: markerLibrary.PinElement as MapsModules["PinElement"],
    Polyline: mapsLibrary.Polyline as MapsModules["Polyline"],
    Route: routesLibrary.Route as GoogleRouteClass | undefined,
  };
}

type MarkerKind = "active" | "candidate" | "other" | "essential";

interface MarkerPin {
  pin: GooglePinElement;
  appearance: GoogleRenderedMarker["appearance"];
}

const categoryGlyphPaths: Record<PlaceCategory, string> = {
  food: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 10v11M16 3v18M16 3c3 2 3 6 0 8"/>',
  cafe: '<path d="M4 8h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM17 10h1a3 3 0 0 1 0 6h-1M7 4c-1 1 1 2 0 3M11 4c-1 1 1 2 0 3"/>',
  sight: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
  shopping: '<path d="M5 8h14l-1 12H6L5 8ZM9 8a3 3 0 0 1 6 0"/>',
  hotel: '<path d="m4 10 8-7 8 7M6 9v11h12V9M9 20v-6h6v6"/>',
  airport: '<path d="m3 11 18-8-8 18-2-8-8-2ZM11 13l4-4"/>',
  station: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h.1M12 16h.1M16 16h.1"/>',
  activity: '<path d="m12 3 2.2 4.6L19 9.8l-4.8 2.2L12 17l-2.2-5L5 9.8l4.8-2.2L12 3Z"/><path d="m19 16 .8 1.7L21.5 18l-1.7.8L19 20.5l-.8-1.7-1.7-.8 1.7-.8L19 16Z"/>',
  other: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
};

function categoryGlyphSrc(category: PlaceCategory, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${categoryGlyphPaths[category]}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function markerAppearance(kind: MarkerKind, priority: PlacePriority, category: PlaceCategory, order?: number): GoogleRenderedMarker["appearance"] {
  const glyphText = kind === "active" && order ? String(order) : "";
  if (kind === "active") return { background: "#111513", borderColor: "#ffffff", glyphText, glyphColor: "#ffffff", scale: 1, zIndex: 400 };
  if (kind === "essential") return { background: "#b3834d", borderColor: "#ffffff", glyphSrc: categoryGlyphSrc(category, "#ffffff"), selectedGlyphSrc: categoryGlyphSrc(category, "#ffffff"), glyphText, glyphColor: "#ffffff", scale: 0.98, zIndex: 300 };
  if (kind === "other") return { background: "#8b9690", borderColor: "#ffffff", glyphSrc: categoryGlyphSrc(category, "#ffffff"), selectedGlyphSrc: categoryGlyphSrc(category, "#ffffff"), glyphText, glyphColor: "#ffffff", scale: 0.9, zIndex: 200 };

  switch (priority) {
    case "must_go":
      return { background: "#2f9868", borderColor: "#ffffff", glyphSrc: categoryGlyphSrc(category, "#ffffff"), selectedGlyphSrc: categoryGlyphSrc(category, "#ffffff"), glyphText, glyphColor: "#ffffff", scale: 1.08, zIndex: 260 };
    case "preferred":
      return { background: "#d59a54", borderColor: "#ffffff", glyphSrc: categoryGlyphSrc(category, "#ffffff"), selectedGlyphSrc: categoryGlyphSrc(category, "#ffffff"), glyphText, glyphColor: "#ffffff", scale: 0.98, zIndex: 180 };
    case "candidate":
    default:
      return { background: "#ffffff", borderColor: "#66736c", glyphSrc: categoryGlyphSrc(category, "#38433d"), selectedGlyphSrc: categoryGlyphSrc(category, "#ffffff"), glyphText, glyphColor: "#38433d", scale: 0.84, zIndex: 100 };
  }
}

function createMarkerPin(
  modules: MapsModules,
  kind: MarkerKind,
  priority: PlacePriority,
  category: PlaceCategory,
  order?: number,
): MarkerPin {
  const appearance = markerAppearance(kind, priority, category, order);
  const pin = new modules.PinElement({
    background: appearance.background,
    borderColor: appearance.borderColor,
    glyphSrc: appearance.glyphSrc,
    glyphColor: appearance.glyphColor,
    glyphText: appearance.glyphText,
    scale: appearance.scale,
  });
  pin.classList.add("map-marker__pin");
  return { pin, appearance };
}

export function updateGoogleMarkerState(rendered: GoogleRenderedMarker, selected: boolean, hovered: boolean): void {
  rendered.pin.classList.toggle("is-selected", selected);
  rendered.pin.classList.toggle("is-hovered", hovered);
  rendered.pin.background = selected ? "#d83f35" : rendered.appearance.background;
  rendered.pin.borderColor = selected ? "#ffffff" : rendered.appearance.borderColor;
  rendered.pin.glyphText = rendered.appearance.glyphText;
  if (selected && rendered.appearance.selectedGlyphSrc) rendered.pin.glyphSrc = rendered.appearance.selectedGlyphSrc;
  else if (rendered.appearance.glyphSrc) rendered.pin.glyphSrc = rendered.appearance.glyphSrc;
  rendered.pin.glyphColor = selected ? "#ffffff" : rendered.appearance.glyphColor;
  rendered.pin.scale = selected ? Math.max(rendered.appearance.scale, 1.45) : hovered ? rendered.appearance.scale * 1.12 : rendered.appearance.scale;
  rendered.marker.zIndex = selected ? 10_000 : hovered ? rendered.appearance.zIndex + 1_000 : rendered.appearance.zIndex;
}

export function updateGoogleMap(
  map: GoogleMapInstance,
  modules: MapsModules,
  places: Place[],
  activeStops: Stop[],
  allStops: Stop[],
  essentialPlaceIds: ReadonlySet<string>,
  selectedPlaceId: string | undefined,
  hoveredPlaceId: string | undefined,
  onSelectPlace: (placeId: string) => void,
  onHoverPlace?: (placeId?: string) => void,
): { markers: Map<string, GoogleRenderedMarker> } {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const activeStopByPlace = new Map(activeStops.map((stop) => [stop.placeId, stop]));
  const scheduledPlaceIds = new Set(allStops.map((stop) => stop.placeId));
  const markers = new Map<string, GoogleRenderedMarker>();

  places.forEach((place) => {
    const activeStop = activeStopByPlace.get(place.id);
    const kind = activeStop
      ? "active"
      : essentialPlaceIds.has(place.id)
        ? "essential"
        : scheduledPlaceIds.has(place.id)
          ? "other"
          : "candidate";
    const content = createMarkerPin(modules, kind, place.priority, place.category, activeStop?.order);
    const marker = new modules.AdvancedMarkerElement({
      map,
      position: place.coordinates,
      title: place.name,
      gmpClickable: true,
      zIndex: content.appearance.zIndex,
    });
    marker.append(content.pin);
    const rendered = { marker, pin: content.pin, appearance: content.appearance };
    updateGoogleMarkerState(rendered, place.id === selectedPlaceId, place.id === hoveredPlaceId);
    marker.addEventListener("gmp-click", () => onSelectPlace(place.id));
    marker.addEventListener("mouseenter", () => onHoverPlace?.(place.id));
    marker.addEventListener("mouseleave", () => onHoverPlace?.(undefined));
    markers.set(place.id, rendered);
  });

  const bounds = new modules.LatLngBounds();
  const relevantPlaces = activeStops.length > 1
    ? activeStops.map((stop) => placeById.get(stop.placeId)).filter((place): place is Place => Boolean(place))
    : places.slice(0, 8);
  relevantPlaces.forEach((place) => bounds.extend(place.coordinates));
  if (relevantPlaces.length > 1) map.fitBounds(bounds, 44);

  return { markers };
}

interface RouteRenderCallbacks {
  onPolylineCreated?: (polyline: GooglePolylineInstance) => void;
  onRouteError?: (message: string) => void;
}

const ROUTE_CACHE_KEY = "travel-spatial-planner-route-cache";
const ROUTE_CACHE_VERSION = 1;
const MAX_CACHED_ROUTES = 200;

interface CachedRoute {
  path: Coordinates[];
  updatedAt: number;
}

type RouteCache = Record<string, CachedRoute>;

export type RouteCacheSnapshot = RouteCache;

let routeCache: RouteCache | undefined;

function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Coordinates>;
  return typeof candidate.lat === "number" && Number.isFinite(candidate.lat) && typeof candidate.lng === "number" && Number.isFinite(candidate.lng);
}

function readRouteCache(): RouteCache {
  if (routeCache) return routeCache;
  routeCache = {};
  try {
    const raw = window.localStorage.getItem(ROUTE_CACHE_KEY);
    if (!raw) return routeCache;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return routeCache;
    const envelope = parsed as { version?: unknown; routes?: unknown };
    if (envelope.version !== ROUTE_CACHE_VERSION || !envelope.routes || typeof envelope.routes !== "object") return routeCache;
    Object.entries(envelope.routes).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const candidate = value as { path?: unknown; updatedAt?: unknown };
      if (!Array.isArray(candidate.path) || candidate.path.length < 2 || !candidate.path.every(isCoordinates)) return;
      routeCache![key] = {
        path: candidate.path,
        updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : 0,
      };
    });
  } catch {
    routeCache = {};
  }
  return routeCache;
}

function saveRouteCache(): void {
  if (!routeCache) return;
  try {
    window.localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify({ version: ROUTE_CACHE_VERSION, routes: routeCache }));
  } catch {
    // Route caching is an optimization; a full or unavailable localStorage should not block routing.
  }
}

export function exportRouteCache(): RouteCacheSnapshot {
  return Object.fromEntries(Object.entries(readRouteCache()).map(([key, route]) => [key, {
    path: route.path.map((point) => ({ lat: point.lat, lng: point.lng })),
    updatedAt: route.updatedAt,
  }]));
}

export function restoreRouteCache(snapshot: unknown): void {
  const restored: RouteCache = {};
  if (snapshot && typeof snapshot === "object") {
    Object.entries(snapshot).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const candidate = value as { path?: unknown; updatedAt?: unknown };
      if (!Array.isArray(candidate.path) || candidate.path.length < 2 || !candidate.path.every(isCoordinates)) return;
      restored[key] = {
        path: candidate.path,
        updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
      };
    });
  }
  routeCache = restored;
  saveRouteCache();
}

function routeCacheKey(origin: Coordinates, destination: Coordinates, travelMode: string): string {
  return JSON.stringify({
    version: ROUTE_CACHE_VERSION,
    origin: [origin.lat, origin.lng],
    destination: [destination.lat, destination.lng],
    travelMode,
  });
}

function cacheRoute(key: string, path: Coordinates[]): void {
  const cache = readRouteCache();
  cache[key] = { path, updatedAt: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHED_ROUTES) {
    keys
      .sort((a, b) => cache[a].updatedAt - cache[b].updatedAt)
      .slice(0, keys.length - MAX_CACHED_ROUTES)
      .forEach((oldKey) => delete cache[oldKey]);
  }
  saveRouteCache();
}

function createFallbackRoute(
  map: GoogleMapInstance,
  modules: MapsModules,
  origin: Coordinates,
  destination: Coordinates,
): GooglePolylineInstance {
  return new modules.Polyline({
    map,
    path: [origin, destination],
    strokeColor: "#171717",
    strokeOpacity: 0,
    strokeWeight: 2,
    icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: "#171717", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "12px" }],
  });
}

function numericCoordinate(value: unknown, receiver?: object): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "function") {
    const result = value.call(receiver);
    return typeof result === "number" && Number.isFinite(result) ? result : undefined;
  }
  return undefined;
}

function normalizeRoutePath(path: unknown[]): Coordinates[] {
  return path
    .map((point): Coordinates | undefined => {
      if (!point || typeof point !== "object") return undefined;
      const value = point as { lat?: unknown; lng?: unknown };
      const lat = numericCoordinate(value.lat, point);
      const lng = numericCoordinate(value.lng, point);
      return lat === undefined || lng === undefined ? undefined : { lat, lng };
    })
    .filter((point): point is Coordinates => Boolean(point))
    .filter((point, index, points) => index === 0 || !sameCoordinates(point, points[index - 1]));
}

function createDashedRoute(map: GoogleMapInstance, modules: MapsModules, path: Coordinates[]): GooglePolylineInstance {
  return new modules.Polyline({
    map,
    path,
    strokeColor: "#171717",
    strokeOpacity: 0,
    strokeWeight: 2.5,
    icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: "#171717", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "12px" }],
  });
}

function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

export async function renderGoogleRoutes(
  map: GoogleMapInstance,
  modules: MapsModules,
  places: Place[],
  activeStops: Stop[],
  callbacks: RouteRenderCallbacks = {},
): Promise<void> {
  const placeById = new Map(places.map((place) => [place.id, place]));

  for (let index = 0; index < activeStops.length - 1; index += 1) {
    const stop = activeStops[index];
    const nextStop = activeStops[index + 1];
    const departureSource = stop.source?.type === "flight_departure" || stop.source?.type === "transport_departure" ? stop.source : undefined;
    const arrivalSource = nextStop.source?.type === "flight_arrival" || nextStop.source?.type === "transport_arrival" ? nextStop.source : undefined;
    if (departureSource && arrivalSource && departureSource.bookingId === arrivalSource.bookingId) continue;
    const origin = placeById.get(stop.placeId)?.coordinates;
    const destination = placeById.get(nextStop.placeId)?.coordinates;
    if (!origin || !destination) continue;
    if (sameCoordinates(origin, destination)) continue;
    const travelMode = modeToGoogleTravelMode(stop.transportToNext);
    const cacheKey = routeCacheKey(origin, destination, travelMode);
    const cachedRoute = readRouteCache()[cacheKey];
    if (cachedRoute) {
      const polyline = createDashedRoute(map, modules, cachedRoute.path);
      polyline.setMap(map);
      callbacks.onPolylineCreated?.(polyline);
      continue;
    }

    try {
      if (!modules.Route?.computeRoutes) throw new Error("Route API is unavailable for this Maps key.");
      const response = await modules.Route.computeRoutes({
        origin,
        destination,
        travelMode,
        fields: ["path"],
      });
      const route = response.routes?.[0];
      if (!route) throw new Error("No route returned for this segment.");
      if (!route.path?.length) throw new Error("Route path was not returned for this segment.");
      const routePath = normalizeRoutePath(route.path);
      if (routePath.length < 2) throw new Error("Route path did not contain two usable points.");
      cacheRoute(cacheKey, routePath);
      const polyline = createDashedRoute(map, modules, routePath);
      polyline.setMap(map);
      callbacks.onPolylineCreated?.(polyline);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Route unavailable; showing a direct segment.";
      callbacks.onRouteError?.(`Stop ${index + 1} → ${index + 2}: ${message}`);
      callbacks.onPolylineCreated?.(createFallbackRoute(map, modules, origin, destination));
    }
  }
}

export function focusMapLocation(map: GoogleMapInstance, coordinates: Coordinates): void {
  map.setCenter(coordinates);
  map.setZoom(14);
}
