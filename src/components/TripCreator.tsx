import { useState } from "preact/hooks";
import type { Accommodation, Day, Place, PlaceCategory, Stop, TransportBooking, Trip } from "../model/types";
import { materializeBookingStops } from "../model/itinerary";
import { eachDate } from "../utils/dates";
import { createId } from "../utils/ids";
import { googleResultToPlace, searchGooglePlaces } from "../map/googleMaps";
import type { GooglePlaceResult } from "../map/mapTypes";
import { Icon } from "./Icons";

export interface NewTripPayload {
  trip: Trip;
  days: Day[];
  places: Place[];
  stops: Stop[];
  accommodations: Accommodation[];
  transportBookings: TransportBooking[];
}

interface TripCreatorProps {
  apiKey?: string;
  onCancel: () => void;
  onComplete: (payload: NewTripPayload) => void;
}

interface FlightDraft {
  id: string;
  origin?: Place;
  destination?: Place;
  departureTime: string;
  arrivalTime: string;
  reference: string;
  notes: string;
}

interface HotelDraft {
  id: string;
  place?: Place;
  checkInDate: string;
  checkOutDate: string;
  notes: string;
}

function makeFlight(): FlightDraft {
  return { id: createId("flight"), departureTime: "", arrivalTime: "", reference: "", notes: "" };
}

function makeHotel(): HotelDraft {
  return { id: createId("hotel"), checkInDate: "", checkOutDate: "", notes: "" };
}

interface GooglePlacePickerProps {
  apiKey?: string;
  tripId: string;
  category: PlaceCategory;
  value?: Place;
  placeholder: string;
  onChange: (place?: Place) => void;
}

export function GooglePlacePicker({ apiKey, tripId, category, value, placeholder, onChange }: GooglePlacePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!apiKey || !query.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(await searchGooglePlaces(apiKey, query.trim()));
    } catch (reason) {
      setResults([]);
      setError(reason instanceof Error ? reason.message : "Google search unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const choose = (result: GooglePlaceResult) => {
    const place = googleResultToPlace(result, tripId, createId("place"));
    if (!place) return;
    onChange({ ...place, category, priority: "preferred" });
    setResults([]);
    setQuery("");
  };

  return (
    <div className="google-place-picker">
      {value ? <div className="picked-place"><span><Icon name="pin" size={14} /><strong>{value.name}</strong><small>{value.formattedAddress}</small></span><button type="button" onClick={() => onChange(undefined)} aria-label="Remove selected place"><Icon name="close" size={14} /></button></div> : <>
        <div className="wizard-search"><Icon name="search" size={15} /><input value={query} placeholder={placeholder} disabled={!apiKey} onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} /><button type="button" onClick={() => void search()} disabled={!apiKey || !query.trim()}>{loading ? "…" : "Search"}</button></div>
        {!apiKey && <small className="wizard-hint">Add a Google Maps key to search places, or skip this step.</small>}
        {error && <small className="wizard-error">{error}</small>}
        {results.length > 0 && <div className="wizard-results">{results.map((result) => <button type="button" key={result.id ?? result.displayName} onClick={() => choose(result)}><Icon name="pin" size={14} /><span><strong>{result.displayName}</strong><small>{result.formattedAddress}</small></span></button>)}</div>}
      </>}
    </div>
  );
}

export function TripCreator({ apiKey, onCancel, onComplete }: TripCreatorProps) {
  const [step, setStep] = useState(0);
  const [tripId] = useState(() => createId("trip"));
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("");
  const [flights, setFlights] = useState<FlightDraft[]>([]);
  const [hotels, setHotels] = useState<HotelDraft[]>([]);
  const [error, setError] = useState("");

  const updateFlight = (id: string, patch: Partial<FlightDraft>) => setFlights((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateHotel = (id: string, patch: Partial<HotelDraft>) => setHotels((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const next = () => {
    setError("");
    if (step === 0) {
      if (!title.trim()) { setError("Give this trip a name first."); return; }
      if (endDate && !startDate) { setError("Add a start date or clear the end date."); return; }
      if (startDate && endDate && endDate < startDate) { setError("End date cannot be before start date."); return; }
    }
    setStep((value) => Math.min(value + 1, 2));
  };

  const finish = () => {
    setError("");
    const incompleteFlight = flights.find((flight) => !flight.origin || !flight.destination || !flight.departureTime);
    if (incompleteFlight) { setError("Complete or remove each flight before finishing."); return; }
    const incompleteHotel = hotels.find((hotel) => !hotel.place || !hotel.checkInDate || !hotel.checkOutDate);
    if (incompleteHotel) { setError("Complete or remove each hotel before finishing."); return; }

    const trip: Trip = { id: tripId, title: title.trim(), startDate: startDate || undefined, endDate: endDate || startDate || undefined };
    const days: Day[] = startDate ? eachDate(startDate, endDate || startDate).map((date, index) => ({ id: createId("day"), tripId, date, order: index + 1, city: index === 0 ? city.trim() || undefined : undefined })) : [];
    const places: Place[] = [];
    const canonicalPlace = (input: Place): Place => {
      const key = input.googlePlaceId ?? input.id;
      const existing = places.find((place) => (place.googlePlaceId ?? place.id) === key);
      if (existing) return existing;
      places.push(input);
      return input;
    };
    const transportBookings: TransportBooking[] = flights.map((flight) => ({ id: flight.id, tripId, type: "flight", originPlaceId: canonicalPlace(flight.origin!).id, destinationPlaceId: canonicalPlace(flight.destination!).id, departureTime: flight.departureTime, arrivalTime: flight.arrivalTime || undefined, reference: flight.reference.trim() || undefined, notes: flight.notes.trim() || undefined }));
    const accommodations: Accommodation[] = hotels.map((hotel) => ({ id: hotel.id, tripId, placeId: canonicalPlace(hotel.place!).id, checkInDate: hotel.checkInDate, checkOutDate: hotel.checkOutDate, notes: hotel.notes.trim() || undefined }));
    const stops = materializeBookingStops(days, places, accommodations, transportBookings);
    onComplete({ trip, days, places, stops, accommodations, transportBookings });
  };

  const stepTitles = ["Trip basics", "Flights", "Hotels"];
  return (
    <main className="trip-creator">
      <div className="wizard-shell">
        <button className="back-button" onClick={onCancel}><Icon name="chevronLeft" size={15} /> All trips</button>
        <div className="wizard-heading"><p className="eyebrow">NEW TRIP</p><h1>Set up your next adventure</h1><p>Start with what you know. Everything else can be added later.</p></div>
        <div className="wizard-progress">{stepTitles.map((label, index) => <span className={step === index ? "is-active" : step > index ? "is-complete" : ""} key={label}><b>{index + 1}</b>{label}</span>)}</div>

        <section className="wizard-card">
          {step === 0 && <div className="wizard-step"><h2>Tell us about the trip</h2><p className="wizard-step__intro">Dates and city are optional. You can fill them in whenever you are ready.</p><label>Trip name<input autoFocus value={title} placeholder="e.g. Thailand Trip" onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)} /></label><div className="form-two-col"><label>Start date<span className="optional-label">Optional</span><input type="date" value={startDate} onInput={(event) => setStartDate((event.currentTarget as HTMLInputElement).value)} /></label><label>End date<span className="optional-label">Optional</span><input type="date" value={endDate} onInput={(event) => setEndDate((event.currentTarget as HTMLInputElement).value)} /></label></div><label>Starting city<span className="optional-label">Optional</span><input value={city} placeholder="e.g. Bangkok" onInput={(event) => setCity((event.currentTarget as HTMLInputElement).value)} /></label></div>}
          {step === 1 && <div className="wizard-step"><div className="wizard-step__top"><div><h2>Any flights to add?</h2><p className="wizard-step__intro">Optional. Pick airports from Google so they can stay visible on your map.</p></div><button type="button" className="secondary-button" onClick={() => setFlights((items) => [...items, makeFlight()])}><Icon name="plus" size={14} /> Add flight</button></div>{flights.map((flight, index) => <div className="wizard-item wizard-item--flight" key={flight.id}><div className="wizard-item__heading"><strong>Flight {index + 1}</strong><button type="button" className="icon-button icon-button--tiny" onClick={() => setFlights((items) => items.filter((item) => item.id !== flight.id))} aria-label="Remove flight"><Icon name="trash" size={14} /></button></div><div className="form-two-col"><label>From<GooglePlacePicker apiKey={apiKey} tripId={tripId} category="airport" value={flight.origin} placeholder="Search departure airport" onChange={(place) => updateFlight(flight.id, { origin: place })} /></label><label>To<GooglePlacePicker apiKey={apiKey} tripId={tripId} category="airport" value={flight.destination} placeholder="Search arrival airport" onChange={(place) => updateFlight(flight.id, { destination: place })} /></label></div><div className="form-three-col"><label>Departure<input type="datetime-local" value={flight.departureTime} onInput={(event) => updateFlight(flight.id, { departureTime: (event.currentTarget as HTMLInputElement).value })} /></label><label>Arrival<span className="optional-label">Optional</span><input type="datetime-local" value={flight.arrivalTime} onInput={(event) => updateFlight(flight.id, { arrivalTime: (event.currentTarget as HTMLInputElement).value })} /></label><label>Flight no.<span className="optional-label">Optional</span><input value={flight.reference} placeholder="TG 403" onInput={(event) => updateFlight(flight.id, { reference: (event.currentTarget as HTMLInputElement).value })} /></label></div></div>)}{!flights.length && <div className="wizard-empty"><Icon name="send" size={18} /><span>No flights added. You can skip this step.</span></div>}</div>}
          {step === 2 && <div className="wizard-step"><div className="wizard-step__top"><div><h2>Where are you staying?</h2><p className="wizard-step__intro">Optional. Hotels are saved as trip essentials and stay visible on the map.</p></div><button type="button" className="secondary-button" onClick={() => setHotels((items) => [...items, makeHotel()])}><Icon name="plus" size={14} /> Add hotel</button></div>{hotels.map((hotel, index) => <div className="wizard-item wizard-item--hotel" key={hotel.id}><div className="wizard-item__heading"><strong>Hotel {index + 1}</strong><button type="button" className="icon-button icon-button--tiny" onClick={() => setHotels((items) => items.filter((item) => item.id !== hotel.id))} aria-label="Remove hotel"><Icon name="trash" size={14} /></button></div><label>Hotel<GooglePlacePicker apiKey={apiKey} tripId={tripId} category="hotel" value={hotel.place} placeholder="Search hotel on Google" onChange={(place) => updateHotel(hotel.id, { place })} /></label><div className="form-two-col"><label>Check in<input type="date" value={hotel.checkInDate} onInput={(event) => updateHotel(hotel.id, { checkInDate: (event.currentTarget as HTMLInputElement).value })} /></label><label>Check out<input type="date" value={hotel.checkOutDate} onInput={(event) => updateHotel(hotel.id, { checkOutDate: (event.currentTarget as HTMLInputElement).value })} /></label></div><label>Notes<span className="optional-label">Optional</span><textarea value={hotel.notes} placeholder="Booking reference, room notes…" onInput={(event) => updateHotel(hotel.id, { notes: (event.currentTarget as HTMLTextAreaElement).value })} /></label></div>)}{!hotels.length && <div className="wizard-empty"><Icon name="pin" size={18} /><span>No hotels added. You can skip this step.</span></div>}</div>}
          {error && <p className="wizard-form-error">{error}</p>}
          <div className="wizard-actions">{step > 0 ? <button className="secondary-button" onClick={() => { setError(""); setStep((value) => value - 1); }}>Back</button> : <span />}{step < 2 ? <button className="primary-button" onClick={next}>Continue <Icon name="chevronRight" size={14} /></button> : <button className="primary-button" onClick={finish}>Create trip <Icon name="chevronRight" size={14} /></button>}</div>
        </section>
        {step === 2 && <p className="wizard-skip-note">You can always add places, flights and hotels later from the planner.</p>}
      </div>
    </main>
  );
}
