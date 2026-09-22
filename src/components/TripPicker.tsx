import type { Day, Place, Trip, TransportBooking, Accommodation } from "../model/types";
import { formatDateRange } from "../utils/dates";
import { Icon } from "./Icons";
import { DataBackupControls } from "./DataBackupControls";

export interface TripSummary {
  trip: Trip;
  dayCount: number;
  placeCount: number;
  accommodationCount: number;
  flightCount: number;
}

interface TripPickerProps {
  summaries: TripSummary[];
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: () => void;
  onDeleteTrip: (tripId: string) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
}

export function createTripSummaries(
  trips: Trip[],
  days: Day[],
  places: Place[],
  accommodations: Accommodation[],
  transportBookings: TransportBooking[],
): TripSummary[] {
  return trips.map((trip) => ({
    trip,
    dayCount: days.filter((day) => day.tripId === trip.id).length,
    placeCount: places.filter((place) => place.tripId === trip.id).length,
    accommodationCount: accommodations.filter((item) => item.tripId === trip.id).length,
    flightCount: transportBookings.filter((item) => item.tripId === trip.id && item.type === "flight").length,
  }));
}

export function TripPicker({ summaries, onOpenTrip, onCreateTrip, onDeleteTrip, onExportData, onImportData }: TripPickerProps) {
  return (
    <main className="trip-picker">
      <div className="trip-picker__topline">
        <span className="brand-mark">S</span>
        <span>TRAVEL SPATIAL PLANNER</span>
        <DataBackupControls onExport={onExportData} onImport={onImportData} />
      </div>
      <div className="trip-picker__intro">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>Where are you going next?</h1>
        <p>Choose a trip to continue planning, or start a new one.</p>
      </div>
      <div className="trip-grid">
        {summaries.map(({ trip, dayCount, placeCount, accommodationCount, flightCount }) => (
          <article className="trip-card" key={trip.id}>
            <button className="trip-card__open" onClick={() => onOpenTrip(trip.id)}>
              <span className="trip-card__top"><span className="trip-card__avatar">{trip.title.slice(0, 1).toUpperCase()}</span><Icon name="chevronRight" size={17} /></span>
              <span className="trip-card__copy"><strong>{trip.title}</strong><small>{formatDateRange(trip.startDate, trip.endDate)}</small></span>
              <span className="trip-card__stats"><span>{dayCount} {dayCount === 1 ? "day" : "days"}</span><span>{placeCount} places</span>{flightCount > 0 && <span>{flightCount} flight{flightCount > 1 ? "s" : ""}</span>}{accommodationCount > 0 && <span>{accommodationCount} hotel{accommodationCount > 1 ? "s" : ""}</span>}</span>
            </button>
            <button className="trip-card__delete" aria-label={`Delete ${trip.title}`} title="Delete trip" onClick={() => onDeleteTrip(trip.id)}><Icon name="trash" size={14} /></button>
          </article>
        ))}
        <button className="trip-card trip-card--new" onClick={onCreateTrip}>
          <span className="trip-card--new__icon"><Icon name="plus" size={21} /></span>
          <span className="trip-card__copy"><strong>Create a new trip</strong><small>Start with the details you know</small></span>
        </button>
      </div>
    </main>
  );
}
