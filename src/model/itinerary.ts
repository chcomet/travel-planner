import type { Accommodation, AppData, Day, Place, Stop, StopSource, TransportBooking } from "./types";
import { addDays } from "../utils/dates";
import { createId } from "../utils/ids";

function timeDate(value?: string): string | undefined {
  return value?.slice(0, 10) || undefined;
}

interface GeneratedStop extends Stop {
  placement: "start" | "middle" | "end";
  sortKey: string;
}

function makeGeneratedStop(
  dayId: string,
  placeId: string,
  source: StopSource,
  placement: GeneratedStop["placement"],
  sortKey: string,
  fixedStartTime?: string,
): GeneratedStop {
  return {
    id: createId("stop"),
    dayId,
    placeId,
    order: 0,
    source,
    fixedStartTime,
    placement,
    sortKey,
  };
}

/**
 * Rebuilds only booking-created stops. Manual stops keep their existing order;
 * generated airport stops go to the edge of the day and hotels go last.
 */
export function materializeBookingStops(
  days: Day[],
  places: Place[],
  accommodations: Accommodation[],
  bookings: TransportBooking[],
  existingStops: Stop[] = [],
): Stop[] {
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const dayIds = new Set(days.map((day) => day.id));
  const placeIds = new Set(places.map((place) => place.id));
  const generated: GeneratedStop[] = [];

  accommodations.forEach((accommodation) => {
    if (!placeIds.has(accommodation.placeId)) return;
    let date = accommodation.checkInDate;
    while (date < accommodation.checkOutDate) {
      const day = dayByDate.get(date);
      if (day) {
        generated.push(makeGeneratedStop(
          day.id,
          accommodation.placeId,
          { type: "accommodation", accommodationId: accommodation.id },
          "end",
          `hotel:${date}:${accommodation.id}`,
        ));
      }
      date = addDays(date, 1);
    }
  });

  bookings.forEach((booking) => {
    if (!placeIds.has(booking.originPlaceId) || !placeIds.has(booking.destinationPlaceId)) return;
    const departureDate = timeDate(booking.departureTime);
    const arrivalDate = timeDate(booking.arrivalTime) ?? departureDate;
    if (!departureDate || !arrivalDate) return;
    const departureDay = dayByDate.get(departureDate);
    const arrivalDay = dayByDate.get(arrivalDate);
    const sameDay = departureDate === arrivalDate && departureDay?.id === arrivalDay?.id;

    if (sameDay && departureDay) {
      generated.push(makeGeneratedStop(departureDay.id, booking.originPlaceId, { type: "transport_departure", bookingId: booking.id }, "start", `transport:${booking.departureTime}:0:${booking.id}`, booking.departureTime));
      generated.push(makeGeneratedStop(departureDay.id, booking.destinationPlaceId, { type: "transport_arrival", bookingId: booking.id }, "start", `transport:${booking.arrivalTime}:1:${booking.id}`, booking.arrivalTime));
      return;
    }
    if (departureDay) generated.push(makeGeneratedStop(departureDay.id, booking.originPlaceId, { type: "transport_departure", bookingId: booking.id }, "end", `transport:${booking.departureTime}:2:${booking.id}`, booking.departureTime));
    if (arrivalDay) generated.push(makeGeneratedStop(arrivalDay.id, booking.destinationPlaceId, { type: "transport_arrival", bookingId: booking.id }, "start", `transport:${booking.arrivalTime ?? booking.departureTime}:1:${booking.id}`, booking.arrivalTime));
  });

  const manualStops = existingStops.filter((stop) => {
    if (!dayIds.has(stop.dayId)) return true;
    return !stop.source;
  });
  const stopsByDay = new Map<string, Stop[]>();
  manualStops.forEach((stop) => {
    const list = stopsByDay.get(stop.dayId) ?? [];
    list.push(stop);
    stopsByDay.set(stop.dayId, list);
  });
  generated.forEach((stop) => {
    const list = stopsByDay.get(stop.dayId) ?? [];
    list.push(stop);
    stopsByDay.set(stop.dayId, list);
  });

  const orderedStops: Stop[] = [];
  days.slice().sort((a, b) => a.order - b.order).forEach((day) => {
    const list = stopsByDay.get(day.id) ?? [];
    const generatedForDay = list.filter((stop): stop is GeneratedStop => Boolean(stop.source && "placement" in stop));
    const manualForDay = list.filter((stop) => !generatedForDay.includes(stop as GeneratedStop)).sort((a, b) => a.order - b.order);
    const start = generatedForDay.filter((stop) => stop.placement === "start").sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const middle = generatedForDay.filter((stop) => stop.placement === "middle").sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const end = generatedForDay.filter((stop) => stop.placement === "end").sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    [...start, ...middle, ...manualForDay, ...end].forEach((stop, index) => orderedStops.push({
      id: stop.id,
      dayId: stop.dayId,
      placeId: stop.placeId,
      order: index + 1,
      source: stop.source,
      transportToNext: stop.transportToNext,
      fixedStartTime: stop.fixedStartTime,
      fixedEndTime: stop.fixedEndTime,
    }));
  });

  const orphanStops = manualStops.filter((stop) => !dayIds.has(stop.dayId));
  return [...orphanStops, ...orderedStops];
}

export function rematerializeTripStops(data: AppData, tripId: string, days = data.days): AppData {
  const tripDays = days.filter((day) => day.tripId === tripId);
  const tripPlaces = data.places.filter((place) => place.tripId === tripId);
  const tripAccommodations = data.accommodations.filter((item) => item.tripId === tripId);
  const tripBookings = data.transportBookings.filter((item) => item.tripId === tripId);
  const otherStops = data.stops.filter((stop) => {
    const day = data.days.find((item) => item.id === stop.dayId);
    return day?.tripId !== tripId;
  });
  const tripStops = data.stops.filter((stop) => data.days.some((day) => day.id === stop.dayId && day.tripId === tripId));
  return {
    ...data,
    stops: [...otherStops, ...materializeBookingStops(tripDays, tripPlaces, tripAccommodations, tripBookings, tripStops)],
  };
}
