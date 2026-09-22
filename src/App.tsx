import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { AppData, Day, Place, PlaceCategory, PlacePriority, TransportMode } from "./model/types";
import { loadData, saveData } from "./storage/storage";
import { createSampleData } from "./model/sampleData";
import { createId } from "./utils/ids";
import { rematerializeTripStops } from "./model/itinerary";
import { exportRouteCache, fetchGooglePlace, googleResultToPlace, restoreRouteCache } from "./map/googleMaps";
import { LeftSidebar } from "./components/LeftSidebar";
import { DayPlanner } from "./components/DayPlanner";
import { MapView } from "./components/MapView";
import { CandidateStrip } from "./components/CandidateStrip";
import { PlaceDetailCard } from "./components/PlaceDetailCard";
import { PlaceSearch } from "./components/PlaceSearch";
import { createTripSummaries, TripPicker } from "./components/TripPicker";
import { TripCreator, type NewTripPayload } from "./components/TripCreator";
import { downloadTripHtml } from "./export/htmlExport";
import { downloadDataBackup, readDataBackup } from "./storage/backup";
import type { NewTransportBooking } from "./components/TransportBookingForm";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

type Screen = "picker" | "creator" | "planner";

function dateBounds(days: Day[]): { startDate?: string; endDate?: string } {
  const dates = days.map((day) => day.date).sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData() ?? createSampleData());
  const [screen, setScreen] = useState<Screen>("picker");
  const [activeTripId, setActiveTripId] = useState<string>();
  const [activeDayId, setActiveDayId] = useState<string>();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [previewPlace, setPreviewPlace] = useState<Place>();
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string>();
  const [categoryFilter, setCategoryFilter] = useState<PlaceCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PlacePriority | "all">("all");
  const [focusSearchRequest, setFocusSearchRequest] = useState(0);
  const [toast, setToast] = useState("");

  useEffect(() => saveData(data), [data]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const notify = useCallback((message: string) => setToast(message), []);
  const currentTrip = data.trips.find((trip) => trip.id === activeTripId);
  const tripDays = useMemo(
    () => data.days.filter((day) => day.tripId === activeTripId).sort((a, b) => a.order - b.order),
    [data.days, activeTripId],
  );
  const tripPlaces = useMemo(() => data.places.filter((place) => place.tripId === activeTripId), [data.places, activeTripId]);
  const tripStops = useMemo(() => {
    const dayIds = new Set(tripDays.map((day) => day.id));
    return data.stops.filter((stop) => dayIds.has(stop.dayId));
  }, [data.stops, tripDays]);
  const tripAccommodations = useMemo(() => data.accommodations.filter((item) => item.tripId === activeTripId), [data.accommodations, activeTripId]);
  const tripBookings = useMemo(() => data.transportBookings.filter((item) => item.tripId === activeTripId), [data.transportBookings, activeTripId]);
  const essentialPlaceIds = useMemo(() => new Set([
    ...tripAccommodations.map((item) => item.placeId),
    ...tripBookings.flatMap((item) => [item.originPlaceId, item.destinationPlaceId]),
  ]), [tripAccommodations, tripBookings]);
  const activeDay = tripDays.find((day) => day.id === activeDayId);
  const activeDayStops = useMemo(
    () => tripStops.filter((stop) => stop.dayId === activeDayId).sort((a, b) => a.order - b.order),
    [tripStops, activeDayId],
  );
  const scheduledPlaceIds = useMemo(() => new Set(tripStops.map((stop) => stop.placeId)), [tripStops]);
  const candidatePlaces = useMemo(() => tripPlaces.filter((place) => {
    if (scheduledPlaceIds.has(place.id) || essentialPlaceIds.has(place.id)) return false;
    const categoryMatches = categoryFilter === "all" || place.category === categoryFilter;
    const priorityMatches = priorityFilter === "all" || place.priority === priorityFilter;
    return categoryMatches && priorityMatches;
  }), [tripPlaces, scheduledPlaceIds, essentialPlaceIds, categoryFilter, priorityFilter]);
  const selectedPlace = previewPlace?.id === selectedPlaceId ? previewPlace : tripPlaces.find((place) => place.id === selectedPlaceId);
  const isPreview = Boolean(previewPlace && previewPlace.id === selectedPlaceId);
  const isSelectedPlaceOnActiveDay = Boolean(!isPreview && selectedPlaceId && activeDayStops.some((stop) => stop.placeId === selectedPlaceId));
  const mapPlaces = useMemo(() => previewPlace ? [...tripPlaces, previewPlace] : tripPlaces, [previewPlace, tripPlaces]);

  const selectPlace = useCallback((placeId: string) => {
    setPreviewPlace((current) => current?.id === placeId ? current : undefined);
    setSelectedPlaceId(placeId || undefined);
  }, []);

  const openTrip = useCallback((tripId: string) => {
    const days = data.days.filter((day) => day.tripId === tripId).sort((a, b) => a.order - b.order);
    setActiveTripId(tripId);
    setActiveDayId(days.find((day) => day.order === 2)?.id ?? days[0]?.id);
    setSelectedPlaceId(undefined);
    setPreviewPlace(undefined);
    setHoveredPlaceId(undefined);
    setScreen("planner");
  }, [data.days]);

  const backToTrips = useCallback(() => {
    setScreen("picker");
    setActiveTripId(undefined);
    setActiveDayId(undefined);
    setSelectedPlaceId(undefined);
    setPreviewPlace(undefined);
    setHoveredPlaceId(undefined);
  }, []);

  const addCandidate = useCallback((place: Place) => {
    if (!activeTripId) return;
    const existing = tripPlaces.find((item) => (place.googlePlaceId && item.googlePlaceId === place.googlePlaceId) || item.id === place.id);
    const normalized = existing ?? { ...place, id: createId("place"), tripId: activeTripId };
    setData((current) => {
      const duplicate = current.places.find((item) => item.tripId === activeTripId && ((normalized.googlePlaceId && item.googlePlaceId === normalized.googlePlaceId) || item.id === normalized.id));
      if (duplicate) {
        setSelectedPlaceId(duplicate.id);
        setPreviewPlace(undefined);
        notify("This place is already in your trip.");
        return current;
      }
      setSelectedPlaceId(normalized.id);
      setPreviewPlace(undefined);
      notify(`${normalized.name} added to candidates.`);
      return { ...current, places: [...current.places, normalized] };
    });
  }, [activeTripId, notify, tripPlaces]);

  const previewGooglePlace = useCallback(async (googlePlaceId: string) => {
    const tripId = activeTripId;
    if (!tripId || !apiKey) return;
    const existing = tripPlaces.find((place) => place.googlePlaceId === googlePlaceId);
    if (existing) {
      selectPlace(existing.id);
      notify("Showing this place from your trip.");
      return;
    }
    notify("Loading place details…");
    try {
      const result = await fetchGooglePlace(apiKey, googlePlaceId);
      const place = result ? googleResultToPlace(result, tripId, createId("place")) : null;
      if (!place) {
        notify("Google did not return enough details for this place.");
        return;
      }
      const preview = { ...place, id: `preview-${googlePlaceId}` };
      setPreviewPlace(preview);
      setSelectedPlaceId(preview.id);
      notify(`Previewing ${place.name}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add this Google place.");
    }
  }, [activeTripId, notify, selectPlace, tripPlaces]);

  const savePlace = useCallback((placeId: string, patch: Partial<Place>) => {
    setData((current) => ({
      ...current,
      places: current.places.map((place) => place.tripId === activeTripId && place.id === placeId ? { ...place, ...patch } : place),
    }));
    notify("Place details saved.");
  }, [activeTripId, notify]);

  const deletePlace = useCallback((placeId: string) => {
    if (scheduledPlaceIds.has(placeId) || essentialPlaceIds.has(placeId)) {
      notify("Scheduled places and trip essentials cannot be deleted here.");
      return;
    }
    const place = tripPlaces.find((item) => item.id === placeId);
    if (!place || !window.confirm(`Delete ${place.name} from this trip?`)) return;
    setData((current) => ({ ...current, places: current.places.filter((item) => item.id !== placeId) }));
    setSelectedPlaceId(undefined);
    setPreviewPlace(undefined);
    notify("Candidate deleted.");
  }, [essentialPlaceIds, notify, scheduledPlaceIds, tripPlaces]);

  const addPlaceToDay = useCallback((input: Place, dayId: string) => {
    if (!activeTripId || !dayId) return;
    const existing = tripPlaces.find((place) => (input.googlePlaceId && place.googlePlaceId === input.googlePlaceId) || place.id === input.id);
    const normalized = existing ?? { ...input, id: createId("place"), tripId: activeTripId };
    setData((current) => {
      const day = current.days.find((item) => item.id === dayId && item.tripId === activeTripId);
      const place = current.places.find((item) => item.id === normalized.id || (normalized.googlePlaceId && item.googlePlaceId === normalized.googlePlaceId));
      if (!day) return current;
      if (current.stops.some((stop) => stop.dayId === dayId && stop.placeId === (place?.id ?? normalized.id))) {
        setSelectedPlaceId(place?.id ?? normalized.id);
        setPreviewPlace(undefined);
        notify(`Already on Day ${day.order}.`);
        return current;
      }
      const dayStops = current.stops.filter((stop) => stop.dayId === dayId);
      notify(`Added to Day ${day.order}.`);
      return {
        ...current,
        places: place ? current.places : [...current.places, normalized],
        stops: [...current.stops, { id: createId("stop"), dayId, placeId: place?.id ?? normalized.id, order: dayStops.length + 1 }],
      };
    });
    setSelectedPlaceId(normalized.id);
    setPreviewPlace(undefined);
  }, [activeTripId, notify, tripPlaces]);

  const addStopFromPlanner = useCallback(() => {
    const nextCandidate = selectedPlace && candidatePlaces.some((place) => place.id === selectedPlace.id)
      ? selectedPlace
      : candidatePlaces[0];
    if (!nextCandidate || !activeDayId) {
      notify("Add a candidate before creating a stop.");
      return;
    }
    addPlaceToDay(nextCandidate, activeDayId);
    setSelectedPlaceId(nextCandidate.id);
  }, [activeDayId, addPlaceToDay, candidatePlaces, notify, selectedPlace]);

  const copyHotelStop = useCallback((stopId: string) => {
    if (!activeTripId) return;
    const sourceStop = tripStops.find((stop) => stop.id === stopId);
    const sourceDay = sourceStop ? tripDays.find((day) => day.id === sourceStop.dayId) : undefined;
    const hotel = sourceStop ? tripPlaces.find((place) => place.id === sourceStop.placeId) : undefined;

    if (!sourceStop || !sourceDay || !hotel || hotel.category !== "hotel") {
      notify("Only hotel stops can be copied.");
      return;
    }
    if (tripStops.some((stop) => stop.dayId === sourceDay.id && stop.id !== sourceStop.id && stop.placeId === sourceStop.placeId && !stop.source)) {
      setActiveDayId(sourceDay.id);
      setSelectedPlaceId(sourceStop.placeId);
      setPreviewPlace(undefined);
      notify(`Hotel is already copied to Day ${sourceDay.order}.`);
      return;
    }

    setData((current) => {
      const nextOrder = current.stops
        .filter((stop) => stop.dayId === sourceDay.id)
        .reduce((maximum, stop) => Math.max(maximum, stop.order), 0) + 1;
      return {
        ...current,
        stops: [...current.stops, { id: createId("stop"), dayId: sourceDay.id, placeId: sourceStop.placeId, order: nextOrder }],
      };
    });
    setActiveDayId(sourceDay.id);
    setSelectedPlaceId(sourceStop.placeId);
    setPreviewPlace(undefined);
    notify(`${hotel.name} copied to the end of Day ${sourceDay.order}.`);
  }, [activeTripId, notify, tripDays, tripPlaces, tripStops]);

  const removeStop = useCallback((stopId: string) => {
    setData((current) => {
      const removed = current.stops.find((stop) => stop.id === stopId);
      if (!removed) return current;
      const remaining = current.stops
        .filter((stop) => stop.id !== stopId)
        .map((stop) => stop.dayId === removed.dayId && stop.order > removed.order ? { ...stop, order: stop.order - 1 } : stop);
      notify("Place returned to candidates.");
      return { ...current, stops: remaining };
    });
  }, [notify]);

  const changeTransport = useCallback((stopId: string, mode: TransportMode) => {
    setData((current) => ({
      ...current,
      stops: current.stops.map((stop) => stop.id === stopId ? { ...stop, transportToNext: mode } : stop),
    }));
  }, []);

  const reorderStops = useCallback((draggedStopId: string, targetStopId: string) => {
    if (!activeDayId) return;
    setData((current) => {
      const dayStops = current.stops.filter((stop) => stop.dayId === activeDayId).sort((a, b) => a.order - b.order);
      const fromIndex = dayStops.findIndex((stop) => stop.id === draggedStopId);
      const toIndex = dayStops.findIndex((stop) => stop.id === targetStopId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = dayStops.splice(fromIndex, 1);
      dayStops.splice(toIndex, 0, moved);
      const orderById = new Map(dayStops.map((stop, index) => [stop.id, index + 1]));
      notify("Day order updated.");
      return { ...current, stops: current.stops.map((stop) => orderById.has(stop.id) ? { ...stop, order: orderById.get(stop.id)! } : stop) };
    });
  }, [activeDayId, notify]);

  const addDay = useCallback((date: string, city: string) => {
    if (!activeTripId || tripDays.some((day) => day.date === date)) {
      notify("This date already has a day.");
      return;
    }
    const newDayId = createId("day");
    setData((current) => {
      const newDay: Day = { id: newDayId, tripId: activeTripId, date, order: tripDays.length + 1, city: city || undefined };
      const days = [...current.days, newDay].filter((day) => day.tripId === activeTripId).sort((a, b) => a.date.localeCompare(b.date)).map((day, index) => ({ ...day, order: index + 1 }));
      const dayById = new Map(days.map((day) => [day.id, day]));
      const bounds = dateBounds(days);
      notify("Day added.");
      const nextData = {
        ...current,
        days: current.days.map((day) => day.tripId === activeTripId ? dayById.get(day.id)! : day).concat(dayById.get(newDay.id)!),
        trips: current.trips.map((trip) => trip.id === activeTripId ? { ...trip, ...bounds } : trip),
      };
      return rematerializeTripStops(nextData, activeTripId);
    });
    setActiveDayId(newDayId);
  }, [activeTripId, notify, tripDays]);

  const editDay = useCallback((dayId: string, patch: Pick<Day, "date" | "city" | "title">) => {
    if (!activeTripId || !patch.date) return;
    if (tripDays.some((day) => day.id !== dayId && day.date === patch.date)) {
      notify("This date already has a day.");
      return;
    }
    setData((current) => {
      const updated = current.days.map((day) => day.id === dayId && day.tripId === activeTripId ? { ...day, ...patch } : day);
      const sortedTripDays = updated.filter((day) => day.tripId === activeTripId).sort((a, b) => a.date.localeCompare(b.date)).map((day, index) => ({ ...day, order: index + 1 }));
      const byId = new Map(sortedTripDays.map((day) => [day.id, day]));
      const nextData = {
        ...current,
        days: updated.map((day) => day.tripId === activeTripId ? byId.get(day.id)! : day),
        trips: current.trips.map((trip) => trip.id === activeTripId ? { ...trip, ...dateBounds(sortedTripDays) } : trip),
      };
      notify("Day updated.");
      return rematerializeTripStops(nextData, activeTripId);
    });
  }, [activeTripId, notify, tripDays]);

  const deleteDay = useCallback((dayId: string) => {
    if (tripDays.length <= 1) {
      notify("Keep at least one day in a trip.");
      return;
    }
    const day = tripDays.find((item) => item.id === dayId);
    if (!day || !window.confirm(`Delete Day ${day.order}? Its places will return to Candidates.`)) return;
    const remainingDays = tripDays.filter((item) => item.id !== dayId).map((item, index) => ({ ...item, order: index + 1 }));
    const bounds = dateBounds(remainingDays);
    setData((current) => ({
      ...current,
      days: current.days.filter((item) => item.id !== dayId).map((item) => remainingDays.find((next) => next.id === item.id) ?? item),
      stops: current.stops.filter((stop) => stop.dayId !== dayId),
      trips: current.trips.map((trip) => trip.id === activeTripId ? { ...trip, ...bounds } : trip),
    }));
    const nextDay = remainingDays[Math.max(0, Math.min(day.order - 1, remainingDays.length - 1))];
    setActiveDayId(nextDay?.id);
    notify(`Day ${day.order} deleted.`);
  }, [activeTripId, notify, tripDays]);

  const completeTrip = useCallback((payload: NewTripPayload) => {
    setData((current) => ({
      ...current,
      trips: [...current.trips, payload.trip],
      days: [...current.days, ...payload.days],
      places: [...current.places, ...payload.places],
      stops: [...current.stops, ...payload.stops],
      accommodations: [...current.accommodations, ...payload.accommodations],
      transportBookings: [...current.transportBookings, ...payload.transportBookings],
    }));
    setActiveTripId(payload.trip.id);
    setActiveDayId(payload.days[0]?.id);
    setSelectedPlaceId(undefined);
    setPreviewPlace(undefined);
    setScreen("planner");
    notify(`${payload.trip.title} created.`);
  }, [notify]);

  const deleteTrip = useCallback((tripId: string) => {
    const trip = data.trips.find((item) => item.id === tripId);
    if (!trip || !window.confirm(`Delete ${trip.title}? This removes its days, places, flights and hotels.`)) return;
    setData((current) => {
      const dayIds = new Set(current.days.filter((day) => day.tripId === tripId).map((day) => day.id));
      return {
        ...current,
        trips: current.trips.filter((item) => item.id !== tripId),
        days: current.days.filter((day) => day.tripId !== tripId),
        places: current.places.filter((place) => place.tripId !== tripId),
        stops: current.stops.filter((stop) => !dayIds.has(stop.dayId)),
        accommodations: current.accommodations.filter((item) => item.tripId !== tripId),
        transportBookings: current.transportBookings.filter((item) => item.tripId !== tripId),
      };
    });
    if (activeTripId === tripId) backToTrips();
    notify("Trip deleted.");
  }, [activeTripId, backToTrips, data.trips, notify]);

  const addTransportBooking = useCallback((payload: NewTransportBooking) => {
    if (!activeTripId) return;
    setData((current) => {
      const places = [...current.places];
      const canonicalIds = new Map<string, string>();
      payload.places.forEach((place) => {
        const existing = places.find((item) => item.tripId === activeTripId && ((place.googlePlaceId && item.googlePlaceId === place.googlePlaceId) || item.id === place.id));
        if (existing) canonicalIds.set(place.id, existing.id);
        else { places.push({ ...place, tripId: activeTripId }); canonicalIds.set(place.id, place.id); }
      });
      const booking = {
        ...payload.booking,
        tripId: activeTripId,
        originPlaceId: canonicalIds.get(payload.booking.originPlaceId) ?? payload.booking.originPlaceId,
        destinationPlaceId: canonicalIds.get(payload.booking.destinationPlaceId) ?? payload.booking.destinationPlaceId,
      };
      return rematerializeTripStops({ ...current, places, transportBookings: [...current.transportBookings, booking] }, activeTripId);
    });
    notify("Transport booking added to this trip.");
  }, [activeTripId, notify]);

  const routeError = useCallback((message: string) => {
    if (message) notify(`Route fallback: ${message}`);
  }, [notify]);

  const exportCurrentTrip = useCallback(() => {
    if (!currentTrip) return;
    downloadTripHtml(data, currentTrip.id);
    notify("Trip exported as a mobile-friendly HTML file.");
  }, [currentTrip, data, notify]);

  const exportDataBackup = useCallback(() => {
    downloadDataBackup(data, exportRouteCache());
    notify("Local JSON backup downloaded.");
  }, [data, notify]);

  const importDataBackup = useCallback((file: File) => {
    if (!window.confirm("Load this backup and replace the current local data?")) return;
    void readDataBackup(file)
      .then((imported) => {
        restoreRouteCache(imported.routeCache);
        setData(imported.data);
        setScreen("picker");
        setActiveTripId(undefined);
        setActiveDayId(undefined);
        setSelectedPlaceId(undefined);
        setPreviewPlace(undefined);
        setHoveredPlaceId(undefined);
        notify("Local JSON backup loaded.");
      })
      .catch((error: unknown) => {
        notify(error instanceof Error ? error.message : "Could not load this JSON backup.");
      });
  }, [notify]);

  if (screen === "picker") {
    return <TripPicker summaries={createTripSummaries(data.trips, data.days, data.places, data.accommodations, data.transportBookings)} onOpenTrip={openTrip} onCreateTrip={() => setScreen("creator")} onDeleteTrip={deleteTrip} onExportData={exportDataBackup} onImportData={importDataBackup} />;
  }

  if (screen === "creator") {
    return <TripCreator apiKey={apiKey} onCancel={() => setScreen("picker")} onComplete={completeTrip} />;
  }

  if (!currentTrip) {
    return <TripPicker summaries={createTripSummaries(data.trips, data.days, data.places, data.accommodations, data.transportBookings)} onOpenTrip={openTrip} onCreateTrip={() => setScreen("creator")} onDeleteTrip={deleteTrip} onExportData={exportDataBackup} onImportData={importDataBackup} />;
  }

  return (
    <main className="app-shell">
      <LeftSidebar
        trip={currentTrip}
        days={tripDays}
        places={tripPlaces}
        accommodations={tripAccommodations}
        transportBookings={tripBookings}
        activeDayId={activeDayId ?? ""}
        onSelectDay={setActiveDayId}
        onAddDay={addDay}
        onSelectPlace={selectPlace}
        onBackToTrips={backToTrips}
        onExportTrip={exportCurrentTrip}
        onExportData={exportDataBackup}
        onImportData={importDataBackup}
        apiKey={apiKey}
        onAddTransportBooking={addTransportBooking}
      />
      <DayPlanner
        day={activeDay}
        stops={activeDayStops}
        places={tripPlaces}
        accommodations={tripAccommodations}
        transportBookings={tripBookings}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={selectPlace}
        onRemoveStop={removeStop}
        onChangeTransport={changeTransport}
        onReorderStops={reorderStops}
        onDeleteDay={deleteDay}
        onEditDay={editDay}
        onAddStop={addStopFromPlanner}
        onCopyHotelStop={copyHotelStop}
      />
      <section className="workspace">
        <PlaceSearch
          apiKey={apiKey}
          tripId={currentTrip.id}
          places={tripPlaces}
          focusRequest={focusSearchRequest}
          onPreviewPlace={(place) => { setPreviewPlace(place); setSelectedPlaceId(place.id); }}
          onSelectPlace={selectPlace}
        />
        <MapView
          apiKey={apiKey}
          places={mapPlaces}
          stops={tripStops}
          activeDayId={activeDayId}
          essentialPlaceIds={essentialPlaceIds}
          selectedPlaceId={selectedPlaceId}
          hoveredPlaceId={hoveredPlaceId}
          onSelectPlace={selectPlace}
          onHoverPlace={setHoveredPlaceId}
          onPreviewGooglePlace={previewGooglePlace}
          onRouteError={routeError}
        >
          <PlaceDetailCard
            place={selectedPlace}
            days={tripDays}
            activeDayId={activeDayId ?? ""}
            activeDayStop={isSelectedPlaceOnActiveDay}
            isPreview={isPreview}
            canDelete={Boolean(selectedPlace && !isPreview && !scheduledPlaceIds.has(selectedPlace.id) && !essentialPlaceIds.has(selectedPlace.id))}
            onClose={() => { setSelectedPlaceId(undefined); setPreviewPlace(undefined); }}
            onSave={savePlace}
            onAddCandidate={addCandidate}
            onAddToDay={addPlaceToDay}
            onDelete={deletePlace}
          />
        </MapView>
        <CandidateStrip
          places={candidatePlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={selectPlace}
          onHoverPlace={setHoveredPlaceId}
          onDeletePlace={deletePlace}
          onAddCandidate={() => setFocusSearchRequest((value) => value + 1)}
          categoryFilter={categoryFilter}
          priorityFilter={priorityFilter}
          onCategoryFilterChange={setCategoryFilter}
          onPriorityFilterChange={setPriorityFilter}
        />
        {toast && <div className="toast" role="status">{toast}</div>}
      </section>
    </main>
  );
}
