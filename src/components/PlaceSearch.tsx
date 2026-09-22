import { useEffect, useRef, useState } from "preact/hooks";
import type { Place } from "../model/types";
import { searchGooglePlaces, googleResultToPlace } from "../map/googleMaps";
import type { GooglePlaceResult } from "../map/mapTypes";
import { createId } from "../utils/ids";
import { Icon } from "./Icons";

interface PlaceSearchProps {
  apiKey?: string;
  tripId: string;
  places: Place[];
  focusRequest: number;
  onPreviewPlace: (place: Place) => void;
  onSelectPlace: (placeId: string) => void;
}

export function PlaceSearch({ apiKey, tripId, places, focusRequest, onPreviewPlace, onSelectPlace }: PlaceSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => { if (focusRequest > 0) inputRef.current?.focus(); }, [focusRequest]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    setOpen(true); setStatus("loading"); setMessage("");
    if (!apiKey) {
      const localMatches = places.filter((place) => `${place.name} ${place.formattedAddress ?? ""}`.toLowerCase().includes(text.toLowerCase()));
      setResults(localMatches.map((place) => ({ id: place.googlePlaceId ?? place.id, displayName: place.name, formattedAddress: place.formattedAddress, location: place.coordinates, googleMapsURI: place.googleMapsUrl })));
      setStatus(localMatches.length ? "idle" : "error");
      setMessage(localMatches.length ? "Local sample results · add a Maps key for Google search" : "Google search is unavailable without a Maps API key");
      return;
    }
    try { setResults(await searchGooglePlaces(apiKey, text)); setStatus("idle"); } catch (reason) { setResults([]); setStatus("error"); setMessage(reason instanceof Error ? reason.message : "Search unavailable. Check your Google Maps key."); }
  };

  const addResult = (result: GooglePlaceResult) => {
    if (!result.id) return;
    const existing = places.find((place) => place.googlePlaceId === result.id || place.id === result.id);
    if (existing) { onSelectPlace(existing.id); setOpen(false); return; }
    const place = googleResultToPlace(result, tripId, createId("place"));
    if (!place) return;
    onPreviewPlace({ ...place, id: `preview-${result.id}` }); setOpen(false); setQuery("");
  };

  return <div className="topbar">
    <div className="search-wrap">
      <Icon name="search" size={19} />
      <input ref={inputRef} value={query} placeholder="Search places, restaurants, sights..." onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} onFocus={() => query && setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") void search(); if (event.key === "Escape") setOpen(false); }} aria-label="Search places" />
      <kbd>⌘ K</kbd>
      {open && <div className="search-results">
        {status === "loading" && <div className="search-message">Searching Google Places…</div>}
        {status === "error" && <div className="search-message search-message--error">{message}</div>}
        {status !== "loading" && results.map((result) => <button className="search-result" key={result.id ?? result.displayName} onClick={() => addResult(result)}><span className="search-result__icon"><Icon name="pin" size={16} /></span><span><strong>{result.displayName}</strong><small>{result.formattedAddress ?? "Location result"}</small></span><span className="search-result__action">{places.some((place) => place.googlePlaceId === result.id || place.id === result.id) ? "Open" : "Preview"}</span></button>)}
        {status === "idle" && !results.length && <div className="search-message">Press Enter to search Google Places.</div>}
        {message && status === "idle" && <div className="search-hint">{message}</div>}
      </div>}
    </div>
  </div>;
}
