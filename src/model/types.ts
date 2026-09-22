export type PlaceCategory =
  | "food"
  | "cafe"
  | "sight"
  | "shopping"
  | "hotel"
  | "airport"
  | "station"
  | "activity"
  | "other";

export type PlacePriority = "candidate" | "preferred" | "must_go";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Trip {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
}

export interface Day {
  id: string;
  tripId: string;
  date: string;
  order: number;
  city?: string;
  title?: string;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  coordinates: Coordinates;
  formattedAddress?: string;
  category: PlaceCategory;
  priority: PlacePriority;
  tags: string[];
  highlights: string[];
  notes?: string;
  sourceUrl?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
}

export type TransportMode = "walk" | "transit" | "taxi" | "drive" | "bike";

export interface Stop {
  id: string;
  dayId: string;
  placeId: string;
  order: number;
  source?: StopSource;
  transportToNext?: TransportMode;
  fixedStartTime?: string;
  fixedEndTime?: string;
}

export type StopSource =
  | { type: "accommodation"; accommodationId: string }
  | { type: "flight_departure"; bookingId: string }
  | { type: "flight_arrival"; bookingId: string }
  | { type: "transport_departure"; bookingId: string }
  | { type: "transport_arrival"; bookingId: string };

export interface Accommodation {
  id: string;
  tripId: string;
  placeId: string;
  checkInDate: string;
  checkOutDate: string;
  notes?: string;
}

export type BookingType = "flight" | "train" | "bus";

export const bookingTypeLabels: Record<BookingType, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus / Coach",
};

export interface TransportBooking {
  id: string;
  tripId: string;
  type: BookingType;
  originPlaceId: string;
  destinationPlaceId: string;
  departureTime: string;
  arrivalTime?: string;
  reference?: string;
  notes?: string;
}

export interface AppData {
  version: 2;
  trips: Trip[];
  days: Day[];
  places: Place[];
  stops: Stop[];
  accommodations: Accommodation[];
  transportBookings: TransportBooking[];
}

export const categoryLabels: Record<PlaceCategory, string> = {
  food: "Food",
  cafe: "Cafe",
  sight: "Sight",
  shopping: "Shopping",
  hotel: "Hotel",
  airport: "Airport",
  station: "Station",
  activity: "Activity",
  other: "Place",
};

export const priorityLabels: Record<PlacePriority, string> = {
  candidate: "Candidate",
  preferred: "Preferred",
  must_go: "Must Go",
};
