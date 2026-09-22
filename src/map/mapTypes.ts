import type { Coordinates, Place, TransportMode } from "../model/types";

export interface GooglePlaceResult {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number } | Coordinates;
  googleMapsURI?: string;
}

export interface GoogleMapsGlobal {
  importLibrary: (name: string) => Promise<Record<string, unknown>>;
  __plannerInit?: () => void;
  __plannerImportLibraryStub?: boolean;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
}

export interface GoogleMapMouseEvent {
  placeId?: string;
  stop?: () => void;
}

export interface GoogleMapInstance {
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  fitBounds: (bounds: GoogleBounds, padding?: number) => void;
  addListener: (event: string, listener: (event: GoogleMapMouseEvent) => void) => { remove?: () => void };
}

export interface GoogleBounds { extend: (point: Coordinates) => void; }
export interface GooglePinElement extends HTMLElement {
  background: string;
  borderColor: string;
  glyphSrc?: string;
  glyphText: string;
  glyphColor: string;
  scale: number;
}

export interface GoogleMarkerAppearance {
  background: string;
  borderColor: string;
  glyphSrc?: string;
  selectedGlyphSrc?: string;
  glyphText: string;
  glyphColor: string;
  scale: number;
  zIndex: number;
}

export interface GoogleMarkerInstance {
  map: GoogleMapInstance | null;
  position: Coordinates;
  zIndex?: number;
  append: (...nodes: Node[]) => void;
  addEventListener: (event: string, listener: (event: Event) => void) => void;
}

export interface GoogleRenderedMarker {
  marker: GoogleMarkerInstance;
  pin: GooglePinElement;
  appearance: GoogleMarkerAppearance;
}
export interface GooglePolylineInstance { setMap: (map: GoogleMapInstance | null) => void; }

export interface GoogleRoute {
  path?: unknown[];
  createPolylines: (options?: Record<string, unknown>) => GooglePolylineInstance[];
  localizedValues?: { duration?: string };
  durationMillis?: number;
}

export interface GoogleRouteClass {
  computeRoutes: (request: Record<string, unknown>) => Promise<{ routes?: GoogleRoute[] }>;
}

export interface MapsModules {
  Map: GoogleMapsGlobal["Map"];
  LatLngBounds: new () => GoogleBounds;
  AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarkerInstance;
  PinElement: new (options: Record<string, unknown>) => GooglePinElement;
  Polyline: new (options: Record<string, unknown>) => GooglePolylineInstance;
  Route?: GoogleRouteClass;
}

export interface MapViewHandle {
  focus: (placeId: string) => void;
  zoom: (amount: number) => void;
  reset: () => void;
}

export function readGoogleLocation(location: GooglePlaceResult["location"]): Coordinates | undefined {
  if (!location) return undefined;
  if (typeof location.lat === "function" && typeof location.lng === "function") return { lat: location.lat(), lng: location.lng() };
  if (typeof location.lat === "number" && typeof location.lng === "number") return { lat: location.lat, lng: location.lng };
  return undefined;
}

export function modeToGoogleTravelMode(mode: TransportMode | undefined): string {
  switch (mode) {
    case "walk": return "WALKING";
    case "transit": return "TRANSIT";
    case "bike": return "BICYCLING";
    case "drive":
    case "taxi":
    default: return "DRIVING";
  }
}
