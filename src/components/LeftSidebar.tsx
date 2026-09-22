import { useState } from "preact/hooks";
import type { Accommodation, Day, Place, TransportBooking, Trip } from "../model/types";
import { formatDateRange } from "../utils/dates";
import { Icon } from "./Icons";
import { DataBackupControls } from "./DataBackupControls";
import { TransportBookingForm, type NewTransportBooking } from "./TransportBookingForm";
import { bookingTypeLabels } from "../model/types";

interface LeftSidebarProps {
  trip: Trip;
  days: Day[];
  places: Place[];
  accommodations: Accommodation[];
  transportBookings: TransportBooking[];
  activeDayId: string;
  onSelectDay: (dayId: string) => void;
  onAddDay: (date: string, city: string) => void;
  onSelectPlace: (placeId: string) => void;
  onBackToTrips: () => void;
  onExportTrip: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  apiKey?: string;
  onAddTransportBooking: (payload: NewTransportBooking) => void;
}

function formatEssentialsDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function LeftSidebar({ trip, days, places, accommodations, transportBookings, activeDayId, onSelectDay, onAddDay, onSelectPlace, onBackToTrips, onExportTrip, onExportData, onImportData, apiKey, onAddTransportBooking }: LeftSidebarProps) {
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [addTransportOpen, setAddTransportOpen] = useState(false);
  const [essentialsOpen, setEssentialsOpen] = useState(true);
  const [daysOpen, setDaysOpen] = useState(true);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const sortedDays = days.slice().sort((a, b) => a.order - b.order);
  const lastDay = sortedDays[sortedDays.length - 1];

  const openAddDay = () => {
    if (!date && lastDay?.date) {
      const next = new Date(`${lastDay.date}T12:00:00`);
      next.setDate(next.getDate() + 1);
      setDate(next.toISOString().slice(0, 10));
    }
    setCity("");
    setAddDayOpen((open) => !open);
  };

  const submitDay = (event: Event) => {
    event.preventDefault();
    if (!date) return;
    onAddDay(date, city.trim());
    setAddDayOpen(false);
    setDate("");
    setCity("");
  };

  return (
    <aside className="left-sidebar">
      <button className="workspace-back" onClick={onBackToTrips}><Icon name="chevronLeft" size={14} /> All trips</button>
      <div className="trip-heading">
        <div className="trip-avatar">{trip.title.slice(0, 1).toUpperCase()}</div>
        <div className="trip-heading__copy"><strong>{trip.title}</strong><span>{formatDateRange(trip.startDate, trip.endDate)}</span></div>
      </div>
      <button className="sidebar-export" onClick={onExportTrip}><Icon name="download" size={14} /> Export HTML</button>
      <DataBackupControls onExport={onExportData} onImport={onImportData} />

      <div className="sidebar-scroll">
      <section className="sidebar-collapsible essentials">
        <div className="sidebar-section-label sidebar-section-label--action"><button className="sidebar-section-toggle" aria-expanded={essentialsOpen} onClick={() => setEssentialsOpen((open) => !open)}><Icon name="chevronDown" size={13} /><span>TRIP ESSENTIALS</span><small>{accommodations.length + transportBookings.length}</small></button><button className="icon-button icon-button--tiny" aria-label="Add flight, train or bus" title="Add transport" onClick={() => { setEssentialsOpen(true); setAddTransportOpen((open) => !open); }}><Icon name="plus" size={16} /></button></div>
        {essentialsOpen && <div className="sidebar-section-content">
        {addTransportOpen && <TransportBookingForm apiKey={apiKey} tripId={trip.id} onCancel={() => setAddTransportOpen(false)} onAdd={(payload) => { onAddTransportBooking(payload); setAddTransportOpen(false); }} />}
        {accommodations.map((item) => {
          const place = placeById.get(item.placeId);
          if (!place) return null;
          return <button className="essential-row" key={item.id} onClick={() => onSelectPlace(place.id)}><Icon name="pin" size={15} /><span><strong>{place.name}</strong><small>{formatEssentialsDate(item.checkInDate)} – {formatEssentialsDate(item.checkOutDate)}</small></span></button>;
        })}
        {transportBookings.map((booking) => {
          const origin = placeById.get(booking.originPlaceId);
          const destination = placeById.get(booking.destinationPlaceId);
          return <button className="essential-row" key={booking.id} onClick={() => onSelectPlace(origin?.id ?? destination?.id ?? "")}><Icon name="send" size={15} /><span><strong>{booking.reference || bookingTypeLabels[booking.type]}</strong><small>{origin?.name ?? "Origin"} → {destination?.name ?? "Destination"}</small></span></button>;
        })}
        {!accommodations.length && !transportBookings.length && !addTransportOpen && <p className="sidebar-empty">No essentials added yet.</p>}
        </div>}
      </section>

      <section className="sidebar-collapsible days-section">
      <div className="days-heading"><button className="sidebar-section-toggle" aria-expanded={daysOpen} onClick={() => setDaysOpen((open) => !open)}><Icon name="chevronDown" size={13} /><span>DAYS</span><small>{sortedDays.length}</small></button><button className="icon-button icon-button--tiny" aria-label="Add day" title="Add day" onClick={() => { setDaysOpen(true); openAddDay(); }}><Icon name="plus" size={16} /></button></div>
      {daysOpen && <div className="sidebar-section-content">{addDayOpen && <form className="day-form" onSubmit={submitDay}><label>Date<input type="date" value={date} onInput={(event) => setDate((event.currentTarget as HTMLInputElement).value)} required /></label><label>City<span className="optional-label">Optional</span><input value={city} placeholder="Bangkok" onInput={(event) => setCity((event.currentTarget as HTMLInputElement).value)} /></label><div><button type="button" className="text-button" onClick={() => setAddDayOpen(false)}>Cancel</button><button type="submit" className="primary-button">Add Day</button></div></form>}
      <div className="days-list">
        {sortedDays.map((day) => <button key={day.id} className={`day-link ${day.id === activeDayId ? "is-active" : ""}`} onClick={() => onSelectDay(day.id)}><strong>Day {day.order}</strong><span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${day.date}T12:00:00`))} · {day.city || "Unplanned"}</span></button>)}
        {!sortedDays.length && <p className="sidebar-empty">No days yet. Add your first day above.</p>}
      </div>
      </div>}
      </section>
      </div>

      <div className="sidebar-footer" />
    </aside>
  );
}
