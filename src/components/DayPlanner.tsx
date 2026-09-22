import { useEffect, useRef, useState } from "preact/hooks";
import type { Accommodation, Day, Place, Stop, TransportBooking, TransportMode } from "../model/types";
import { bookingTypeLabels, categoryLabels } from "../model/types";
import { formatDate } from "../utils/dates";
import { Icon } from "./Icons";
import { TransportSelector } from "./TransportSelector";

interface DayPlannerProps {
  day?: Day;
  stops: Stop[];
  places: Place[];
  accommodations: Accommodation[];
  transportBookings: TransportBooking[];
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onChangeTransport: (stopId: string, mode: TransportMode) => void;
  onReorderStops: (draggedStopId: string, targetStopId: string) => void;
  onDeleteDay: (dayId: string) => void;
  onEditDay: (dayId: string, patch: Pick<Day, "date" | "city" | "title">) => void;
  onAddStop: () => void;
  onCopyHotelStop: (stopId: string) => void;
}

function formatTime(value?: string): string | undefined {
  if (!value) return undefined;
  const time = value.slice(11, 16);
  return time || undefined;
}

export function DayPlanner({ day, stops, places, accommodations, transportBookings, selectedPlaceId, onSelectPlace, onRemoveStop, onChangeTransport, onReorderStops, onDeleteDay, onEditDay, onAddStop, onCopyHotelStop }: DayPlannerProps) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const accommodationById = new Map(accommodations.map((item) => [item.id, item]));
  const bookingById = new Map(transportBookings.map((item) => [item.id, item]));
  const draggedStopId = useRef<string | undefined>(undefined);
  const [editingDay, setEditingDay] = useState(false);
  const [draft, setDraft] = useState({ date: day?.date ?? "", city: day?.city ?? "", title: day?.title ?? "" });

  useEffect(() => {
    setEditingDay(false);
    setDraft({ date: day?.date ?? "", city: day?.city ?? "", title: day?.title ?? "" });
  }, [day?.id, day?.date, day?.city, day?.title]);

  const submitDayEdit = (event: Event) => {
    event.preventDefault();
    if (!day || !draft.date) return;
    onEditDay(day.id, { date: draft.date, city: draft.city.trim() || undefined, title: draft.title.trim() || undefined });
    setEditingDay(false);
  };

  return (
    <section className="day-planner">
      <div className="day-planner__header">
        <div><h1>{day ? (day.title || `Day ${day.order} · ${day.city || "Unplanned"}`) : "No day selected"}</h1><p>{day ? `${formatDate(day.date, true)}${day.title && day.city ? ` · ${day.city}` : ""}` : "Add a day from the sidebar to start planning"}</p></div>
        {day && <div className="day-planner__header-actions"><button className="icon-button" aria-label="Edit day" title="Edit day" onClick={() => setEditingDay((open) => !open)}><Icon name="edit" size={14} /></button><button className="icon-button day-delete-button" aria-label="Delete day" title="Delete day" onClick={() => onDeleteDay(day.id)}><Icon name="trash" size={15} /></button></div>}
      </div>
      {editingDay && day && <form className="day-edit-form" onSubmit={submitDayEdit}><label>Date<input type="date" value={draft.date} onInput={(event) => setDraft((current) => ({ ...current, date: (event.currentTarget as HTMLInputElement).value }))} required /></label><label>City<span className="optional-label">Optional</span><input value={draft.city} placeholder="e.g. Bangkok" onInput={(event) => setDraft((current) => ({ ...current, city: (event.currentTarget as HTMLInputElement).value }))} /></label><label>Title<span className="optional-label">Optional</span><input value={draft.title} placeholder={`Day ${day.order}`} onInput={(event) => setDraft((current) => ({ ...current, title: (event.currentTarget as HTMLInputElement).value }))} /></label><div><button type="button" className="text-button" onClick={() => setEditingDay(false)}>Cancel</button><button type="submit" className="primary-button">Save</button></div></form>}
      <div className="planner-rule" />

      <div className="stops-list">
        {!day && <p className="empty-state">This Trip has no Days yet. Use the plus next to DAYS to add one.</p>}
        {day && !stops.length && <p className="empty-state">No stops planned yet. Select a Candidate and add it to this Day.</p>}
        {stops.map((stop, index) => {
          const place = placeById.get(stop.placeId);
          if (!place) return null;
          const isSelected = selectedPlaceId === place.id;
          const isHotel = place.category === "hotel";
          const isLast = index === stops.length - 1;
          const source = stop.source;
          const transportSource = source && source.type !== "accommodation" ? source : undefined;
          const booking = transportSource ? bookingById.get(transportSource.bookingId) : undefined;
          const accommodation = source?.type === "accommodation" ? accommodationById.get(source.accommodationId) : undefined;
          const isDeparture = transportSource?.type === "flight_departure" || transportSource?.type === "transport_departure";
          const sourceLabel = booking && transportSource ? `${isDeparture ? "Departure" : "Arrival"} · ${booking.reference || bookingTypeLabels[booking.type]}${formatTime(isDeparture ? booking.departureTime : booking.arrivalTime) ? ` · ${formatTime(isDeparture ? booking.departureTime : booking.arrivalTime)}` : ""}` : accommodation ? `Hotel · ${accommodation.checkInDate} – ${accommodation.checkOutDate}` : undefined;
          const nextSource = !isLast ? stops[index + 1].source : undefined;
          const isTransportSegment = Boolean(isDeparture && (nextSource?.type === "flight_arrival" || nextSource?.type === "transport_arrival") && transportSource?.bookingId === nextSource.bookingId);
          const transportSegmentLabel = isTransportSegment && booking ? `${booking.reference || bookingTypeLabels[booking.type]}${formatTime(booking.departureTime) ? ` · ${formatTime(booking.departureTime)}` : ""}${formatTime(booking.arrivalTime) ? ` → ${formatTime(booking.arrivalTime)}` : ""}` : "";
          const iconName = place.category === "food" ? "food" : place.category === "activity" ? "activity" : place.category === "shopping" ? "shopping" : place.category === "cafe" ? "coffee" : place.category === "hotel" ? "pin" : "pin";
          return <div className="stop-block" key={stop.id}>
            <div className={`stop-item ${isSelected ? "is-selected" : ""}`} draggable onDragStart={() => { draggedStopId.current = stop.id; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedStopId.current && draggedStopId.current !== stop.id) onReorderStops(draggedStopId.current, stop.id); draggedStopId.current = undefined; }}>
              <button className="stop-select" onClick={() => onSelectPlace(place.id)}><span className="stop-number">{index + 1}</span><span className="stop-copy"><strong>{place.name}</strong><span className="stop-meta"><Icon name={iconName} size={14} />{categoryLabels[place.category]}{place.tags[0] ? ` · ${place.tags[0]}` : ""}</span>{sourceLabel && <span className="stop-source">{sourceLabel}</span>}</span></button>
              <div className="stop-item__actions">
                {isHotel && <button className="copy-stop" aria-label={`Copy ${place.name} to the end of this day`} title="Copy hotel to end of this day" onClick={() => onCopyHotelStop(stop.id)}><Icon name="copy" size={14} /></button>}
                <button className="remove-stop" aria-label={`Remove ${place.name} from this day`} title="Remove from day" onClick={() => onRemoveStop(stop.id)}><Icon name="close" size={14} /></button>
              </div>
            </div>
            {!isLast && (isTransportSegment ? <div className="transport-row transport-row--flight"><span className="transport-line" /><span className="flight-segment"><Icon name="send" size={13} />{transportSegmentLabel}</span></div> : <div className="transport-row"><span className="transport-line" /><TransportSelector value={stop.transportToNext} onChange={(mode) => onChangeTransport(stop.id, mode)} /><span className="transport-duration">{stop.transportToNext === "taxi" ? "Taxi" : stop.transportToNext === "transit" ? "Transit" : stop.transportToNext === "drive" ? "Drive" : stop.transportToNext === "bike" ? "Bike" : "Walk"}</span></div>)}
          </div>;
        })}
      </div>

      {day && <div className="planner-actions"><button className="primary-button" onClick={onAddStop}><Icon name="plus" size={16} /> Add Stop</button></div>}
    </section>
  );
}
