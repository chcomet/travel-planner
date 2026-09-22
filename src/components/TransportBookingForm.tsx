import { useState } from "preact/hooks";
import type { BookingType, Place, PlaceCategory, TransportBooking } from "../model/types";
import { bookingTypeLabels } from "../model/types";
import { createId } from "../utils/ids";
import { GooglePlacePicker } from "./TripCreator";

export interface NewTransportBooking {
  booking: TransportBooking;
  places: Place[];
}

interface Props {
  apiKey?: string;
  tripId: string;
  onCancel: () => void;
  onAdd: (payload: NewTransportBooking) => void;
}

export function TransportBookingForm({ apiKey, tripId, onCancel, onAdd }: Props) {
  const [type, setType] = useState<BookingType>("flight");
  const [origin, setOrigin] = useState<Place>();
  const [destination, setDestination] = useState<Place>();
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const category: PlaceCategory = type === "flight" ? "airport" : "station";

  const changeType = (next: BookingType) => {
    setType(next);
    setOrigin(undefined);
    setDestination(undefined);
  };

  const submit = (event: Event) => {
    event.preventDefault();
    if (!origin || !destination || !departureTime) {
      setError("Please choose both locations and add a departure time.");
      return;
    }
    if (arrivalTime && arrivalTime < departureTime) {
      setError("Arrival cannot be before departure.");
      return;
    }
    onAdd({
      booking: {
        id: createId("booking"), tripId, type,
        originPlaceId: origin.id, destinationPlaceId: destination.id,
        departureTime, arrivalTime: arrivalTime || undefined,
        reference: reference.trim() || undefined, notes: notes.trim() || undefined,
      },
      places: [origin, destination],
    });
  };

  return <form className="transport-form" onSubmit={submit}>
    <div className="transport-form__heading"><strong>Add transport</strong><button type="button" className="text-button" onClick={onCancel}>Cancel</button></div>
    <label>Type<select value={type} onChange={(event) => changeType((event.currentTarget as HTMLSelectElement).value as BookingType)}>{Object.entries(bookingTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>From<GooglePlacePicker apiKey={apiKey} tripId={tripId} category={category} value={origin} placeholder={type === "flight" ? "Search departure airport" : "Search departure station"} onChange={setOrigin} /></label>
    <label>To<GooglePlacePicker apiKey={apiKey} tripId={tripId} category={category} value={destination} placeholder={type === "flight" ? "Search arrival airport" : "Search arrival station"} onChange={setDestination} /></label>
    <label>Departure<input type="datetime-local" value={departureTime} onInput={(event) => setDepartureTime((event.currentTarget as HTMLInputElement).value)} required /></label>
    <label>Arrival<span className="optional-label">Optional</span><input type="datetime-local" value={arrivalTime} onInput={(event) => setArrivalTime((event.currentTarget as HTMLInputElement).value)} /></label>
    <label>Flight / train / bus no.<span className="optional-label">Optional</span><input value={reference} placeholder="e.g. FD 3419" onInput={(event) => setReference((event.currentTarget as HTMLInputElement).value)} /></label>
    <label>Notes<span className="optional-label">Optional</span><textarea value={notes} placeholder="Booking reference, seat…" onInput={(event) => setNotes((event.currentTarget as HTMLTextAreaElement).value)} /></label>
    {error && <p className="wizard-form-error">{error}</p>}
    <button className="primary-button" type="submit">Save transport</button>
  </form>;
}
