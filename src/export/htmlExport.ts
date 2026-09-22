import type { AppData, Place, Stop, TransportBooking } from "../model/types";
import { bookingTypeLabels, categoryLabels, priorityLabels } from "../model/types";
import { formatDate, formatDateRange } from "../utils/dates";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function formatDateTime(value?: string): string {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function mapsUrl(place: Place): string {
  return place.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.coordinates.lat},${place.coordinates.lng}`)}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
}

function sourceLabel(stop: Stop, accommodations: AppData["accommodations"], bookings: TransportBooking[]): string | undefined {
  const source = stop.source;
  if (!source) return undefined;
  if (source.type === "accommodation") {
    const accommodation = accommodations.find((item) => item.id === source.accommodationId);
    return accommodation ? `Hotel stay · ${formatDate(accommodation.checkInDate)} – ${formatDate(accommodation.checkOutDate)}` : "Hotel stay";
  }
  const booking = bookings.find((item) => item.id === source.bookingId);
  const isDeparture = source.type === "flight_departure" || source.type === "transport_departure";
  if (!booking) return isDeparture ? "Transport departure" : "Transport arrival";
  return `${isDeparture ? "Departure" : "Arrival"} · ${booking.reference || bookingTypeLabels[booking.type]} · ${formatDateTime(isDeparture ? booking.departureTime : booking.arrivalTime)}`;
}

function placeDetails(place: Place): string {
  const highlights = place.highlights.length ? `<small class="place-detail-line"><b>Highlights:</b> ${escapeHtml(place.highlights.join(" · "))}</small>` : "";
  const notes = place.notes ? `<small class="place-detail-line"><b>Note:</b> ${escapeHtml(place.notes)}</small>` : "";
  return `${highlights}${notes}`;
}

function renderStop(stop: Stop, place: Place | undefined, accommodations: AppData["accommodations"], bookings: TransportBooking[]): string {
  if (!place) return "";
  const source = sourceLabel(stop, accommodations, bookings);
  return `<li class="stop"><span class="stop-number">${stop.order}</span><span class="stop-icon">${escapeHtml(place.category.slice(0, 1).toUpperCase())}</span><span class="stop-copy"><strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(categoryLabels[place.category])} · <em class="priority priority--${place.priority}">${escapeHtml(priorityLabels[place.priority])}</em></span>${source ? `<small>${escapeHtml(source)}</small>` : ""}${placeDetails(place)}</span><a class="map-link" href="${escapeHtml(mapsUrl(place))}" target="_blank" rel="noreferrer">Open map <span aria-hidden="true">↗</span></a></li>`;
}

export function downloadTripHtml(data: AppData, tripId: string): void {
  const trip = data.trips.find((item) => item.id === tripId);
  if (!trip) return;

  const days = data.days.filter((day) => day.tripId === tripId).sort((a, b) => a.order - b.order);
  const places = data.places.filter((place) => place.tripId === tripId);
  const dayIds = new Set(days.map((day) => day.id));
  const stops = data.stops.filter((stop) => dayIds.has(stop.dayId));
  const accommodations = data.accommodations.filter((item) => item.tripId === tripId);
  const bookings = data.transportBookings.filter((item) => item.tripId === tripId);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const scheduledIds = new Set(stops.map((stop) => stop.placeId));
  const essentialIds = new Set([...accommodations.map((item) => item.placeId), ...bookings.flatMap((booking) => [booking.originPlaceId, booking.destinationPlaceId])]);
  const candidates = places.filter((place) => !scheduledIds.has(place.id) && !essentialIds.has(place.id));

  const daySections = days.map((day) => {
    const dayStops = stops.filter((stop) => stop.dayId === day.id).sort((a, b) => a.order - b.order);
    return `<section class="day" id="day-${day.order}"><div class="day-heading"><div><p class="eyebrow">DAY ${day.order}</p><h2>${escapeHtml(day.title || day.city || "Unplanned")}</h2></div><time>${escapeHtml(formatDate(day.date, true))}</time></div>${dayStops.length ? `<ol class="stops">${dayStops.map((stop) => renderStop(stop, placeById.get(stop.placeId), accommodations, bookings)).join("")}</ol>` : `<p class="empty">No stops planned.</p>`}</section>`;
  }).join("");
  const dayNavigation = days.length > 1 ? `<nav class="day-nav" aria-label="Trip days">${days.map((day) => `<a href="#day-${day.order}"><strong>Day ${day.order}</strong><span>${escapeHtml(formatDate(day.date))}</span></a>`).join("")}</nav>` : "";

  const hotelSections = accommodations.map((item) => {
    const place = placeById.get(item.placeId);
    return place ? `<li><strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(formatDate(item.checkInDate, true))} – ${escapeHtml(formatDate(item.checkOutDate, true))}</span>${item.notes ? `<small class="place-detail-line"><b>Note:</b> ${escapeHtml(item.notes)}</small>` : ""}</li>` : "";
  }).join("");
  const transportSections = bookings.map((booking) => {
    const origin = placeById.get(booking.originPlaceId)?.name || "Origin";
    const destination = placeById.get(booking.destinationPlaceId)?.name || "Destination";
    return `<li><strong>${escapeHtml(booking.reference || bookingTypeLabels[booking.type])}</strong><span>${escapeHtml(origin)} → ${escapeHtml(destination)} · ${escapeHtml(formatDateTime(booking.departureTime))}</span>${booking.notes ? `<small class="place-detail-line"><b>Note:</b> ${escapeHtml(booking.notes)}</small>` : ""}</li>`;
  }).join("");
  const candidateSections = candidates.map((place) => `<li><span class="candidate-dot candidate-dot--${place.priority}"></span><span class="candidate-copy"><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(categoryLabels[place.category])} · ${escapeHtml(priorityLabels[place.priority])}</small>${placeDetails(place)}</span><a class="map-link" href="${escapeHtml(mapsUrl(place))}" target="_blank" rel="noreferrer">Open map <span aria-hidden="true">↗</span></a></li>`).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(trip.title)}</title><style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171917;background:#f5f6f3;scroll-behavior:smooth;scroll-padding-top:78px}*{box-sizing:border-box}body{margin:0;padding:20px 14px 40px}.page{max-width:680px;margin:0 auto}.hero{padding:22px 20px;border-radius:18px;color:#fff;background:#171a18;box-shadow:0 12px 30px #1113}.eyebrow{margin:0 0 7px;color:#9ca89f;font-size:10px;font-weight:700;letter-spacing:.13em}.hero .eyebrow{color:#b9c8bd}.hero h1{margin:0 0 8px;font-size:28px;line-height:1.12}.hero p{margin:0;color:#d0d8d2;font-size:13px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.stat,.section,.day{border:1px solid #e1e5df;border-radius:14px;background:#fff}.stat{padding:12px}.stat strong{display:block;font-size:18px}.stat span{color:#788078;font-size:10px}.day-nav{position:sticky;z-index:20;top:0;display:flex;gap:6px;margin:0 -2px 12px;padding:8px 2px;overflow-x:auto;background:#f5f6f3eF;backdrop-filter:blur(10px);scrollbar-width:none}.day-nav::-webkit-scrollbar{display:none}.day-nav a{display:grid;flex:0 0 auto;min-width:70px;gap:2px;padding:8px 11px;border:1px solid #dfe3dd;border-radius:10px;color:#313632;background:#fff;text-decoration:none;box-shadow:0 3px 10px #1111}.day-nav a:hover{border-color:#9fad9f;background:#f8fbf8}.day-nav strong{font-size:11px}.day-nav span{color:#788078;font-size:9px}.section{margin-top:12px;padding:16px}.section h2{margin:0 0 12px;font-size:15px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.compact{margin:0;padding:0;list-style:none}.compact li{display:grid;gap:3px;padding:8px 0;border-top:1px solid #eef0ed;font-size:12px}.compact li:first-child{border-top:0;padding-top:0}.compact span,.compact small{color:#788078;font-size:11px}.place-detail-line{display:block;color:#788078;font-size:10px;line-height:1.35;white-space:normal}.place-detail-line b{color:#59615b;font-weight:600}.day{margin-top:12px;padding:16px;scroll-margin-top:78px}.day-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.day-heading h2{margin:0;font-size:20px}.day-heading time{color:#788078;font-size:11px}.stops{display:grid;gap:8px;margin:0;padding:0;list-style:none}.stop{display:flex;align-items:center;gap:9px;min-width:0;padding:9px;border:1px solid #edf0eb;border-radius:10px}.stop-number{display:grid;flex:0 0 auto;width:22px;height:22px;place-items:center;border-radius:50%;color:#fff;background:#171a18;font-size:10px;font-weight:700}.stop-icon{display:grid;flex:0 0 auto;width:27px;height:27px;place-items:center;border-radius:8px;color:#3b6847;background:#edf5ed;font-size:12px;font-weight:700}.stop-copy{display:grid;flex:1;min-width:0;gap:3px}.stop-copy strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.stop-copy span,.stop-copy small{overflow:hidden;color:#788078;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.stop-copy .place-detail-line{overflow:visible;white-space:normal}.stop-copy em{font-style:normal}.priority{padding:2px 5px;border-radius:5px}.priority--candidate{color:#66716f;background:#eef2f1}.priority--preferred{color:#875f43;background:#f7f1eb}.priority--must_go{color:#39633d;background:#edf5ed}.stop>a,.compact a{flex:0 0 auto;color:#58725f;font-size:10px;text-decoration:none}.map-link{display:inline-flex;align-items:center;gap:4px;padding:6px 8px;border:1px solid #dfe8df;border-radius:7px;color:#3e684c!important;background:#f7fbf7;font-size:10px!important;font-weight:600}.map-link:hover{border-color:#b9cfbc;background:#edf7ee;text-decoration:none!important}.candidates{display:grid;gap:8px;margin:0;padding:0;list-style:none}.candidates li{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid #eef0ed}.candidates li:first-child{border-top:0}.candidates li>span:nth-child(2){display:grid;flex:1;gap:3px}.candidate-copy .place-detail-line{overflow:visible;white-space:normal}.candidates strong{font-size:12px}.candidates small{color:#788078;font-size:10px}.candidate-dot{width:9px;height:9px;border-radius:50%;background:#aab4ad}.candidate-dot--preferred{border-radius:3px;background:#d59a54}.candidate-dot--must_go{width:11px;height:11px;background:#2f9868}.empty{margin:0;color:#788078;font-size:12px}@media(max-width:480px){body{padding:10px 10px 28px}.hero{padding:19px 16px}.hero h1{font-size:24px}.stats{gap:6px}.stat{padding:10px 8px}.columns{grid-template-columns:1fr;gap:15px}.section,.day{padding:13px}}
</style></head><body><main class="page"><header class="hero"><p class="eyebrow">TRAVEL PLAN</p><h1>${escapeHtml(trip.title)}</h1><p>${escapeHtml(formatDateRange(trip.startDate, trip.endDate))}</p></header><div class="stats"><div class="stat"><strong>${days.length}</strong><span>Days</span></div><div class="stat"><strong>${stops.length}</strong><span>Stops</span></div><div class="stat"><strong>${places.length}</strong><span>Places</span></div></div>${dayNavigation}${(hotelSections || transportSections) ? `<section class="section"><div class="columns">${hotelSections ? `<div><h2>Hotels</h2><ul class="compact">${hotelSections}</ul></div>` : ""}${transportSections ? `<div><h2>Transport</h2><ul class="compact">${transportSections}</ul></div>` : ""}</div></section>` : ""}${daySections}${candidateSections ? `<section class="section"><h2>Saved candidates</h2><ul class="candidates">${candidateSections}</ul></section>` : ""}</main></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(trip.title)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
