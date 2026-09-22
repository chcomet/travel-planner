import type { AppData, Day, Place, Stop, Trip } from "./types";

const trip: Trip = {
  id: "thailand-2026",
  title: "Thailand Trip",
  startDate: "2026-10-01",
  endDate: "2026-10-08",
};

const days: Day[] = [
  ["day-1", "2026-10-01", "Bangkok"],
  ["day-2", "2026-10-02", "Bangkok"],
  ["day-3", "2026-10-03", "Bangkok"],
  ["day-4", "2026-10-04", "Chiang Mai"],
  ["day-5", "2026-10-05", "Chiang Mai"],
  ["day-6", "2026-10-06", "Chiang Mai"],
  ["day-7", "2026-10-07", "Chiang Mai"],
  ["day-8", "2026-10-08", "Fly Home"],
].map(([id, date, city], index) => ({
  id,
  tripId: trip.id,
  date,
  order: index + 1,
  city,
}));

const place = (
  values: Omit<Place, "tripId">,
): Place => ({ ...values, tripId: trip.id });

const places: Place[] = [
  place({
    id: "place-phed-mark",
    name: "Phed Mark",
    coordinates: { lat: 13.718, lng: 100.585 },
    formattedAddress: "พระโขนง, Bangkok, Thailand",
    category: "food",
    priority: "must_go",
    tags: ["thai", "xiaohongshu"],
    highlights: ["打抛饭", "牛肉", "荷包蛋"],
    notes: "晚饭时间可能需要排队",
    googleMapsUrl: "https://maps.google.com/?q=Phed+Mark+Bangkok",
  }),
  place({
    id: "place-wat-arun",
    name: "Wat Arun Ratchawararam",
    coordinates: { lat: 13.7437, lng: 100.4889 },
    formattedAddress: "158 Thanon Wang Doem, Bangkok",
    category: "sight",
    priority: "preferred",
    tags: ["temple", "river"],
    highlights: ["Riverside temple", "Sunset"],
    notes: "Bring a light layer for the boat ride.",
  }),
  place({
    id: "place-tha-maharaj",
    name: "Tha Maharaj",
    coordinates: { lat: 13.7535, lng: 100.4872 },
    formattedAddress: "Maharaj Road, Bangkok",
    category: "shopping",
    priority: "preferred",
    tags: ["riverside", "shopping"],
    highlights: ["Chao Phraya views", "Small shops"],
  }),
  place({
    id: "place-painting-studio",
    name: "Paris Painting Studio",
    coordinates: { lat: 13.7358, lng: 100.529 },
    formattedAddress: "Bangkok, Thailand",
    category: "activity",
    priority: "must_go",
    tags: ["xiaohongshu", "book ahead"],
    highlights: ["Watercolor · Paris style"],
    notes: "需要提前预约",
    sourceUrl: "https://www.xiaohongshu.com/",
  }),
  place({
    id: "place-supanniga",
    name: "Supanniga Eating Room",
    coordinates: { lat: 13.7168, lng: 100.512 },
    formattedAddress: "Tha Tien, Bangkok, Thailand",
    category: "food",
    priority: "preferred",
    tags: ["thai", "dinner"],
    highlights: ["Thai comfort food"],
  }),
  place({
    id: "place-factory-coffee",
    name: "Factory Coffee",
    coordinates: { lat: 13.756, lng: 100.535 },
    formattedAddress: "Phaya Thai, Bangkok",
    category: "cafe",
    priority: "candidate",
    tags: ["coffee", "xiaohongshu"],
    highlights: ["Slow coffee", "Creative drinks"],
  }),
  place({
    id: "place-charoen-saeng",
    name: "Charoen Saeng Silom",
    coordinates: { lat: 13.723, lng: 100.519 },
    formattedAddress: "Silom, Bangkok, Thailand",
    category: "food",
    priority: "must_go",
    tags: ["thai", "pork"],
    highlights: ["Braised pork leg"],
  }),
  place({
    id: "place-jim-thompson",
    name: "Jim Thompson House",
    coordinates: { lat: 13.7492, lng: 100.528 },
    formattedAddress: "Rama I Road, Bangkok",
    category: "sight",
    priority: "candidate",
    tags: ["museum", "design"],
    highlights: ["Thai architecture", "Silk museum"],
  }),
  place({
    id: "place-blue-elephant",
    name: "Blue Elephant",
    coordinates: { lat: 13.7209, lng: 100.529 },
    formattedAddress: "South Sathorn Road, Bangkok",
    category: "food",
    priority: "preferred",
    tags: ["thai", "restaurant"],
    highlights: ["Classic Thai cuisine"],
  }),
  place({
    id: "place-maeklong",
    name: "Maeklong Railway Market",
    coordinates: { lat: 13.4098, lng: 99.999 },
    formattedAddress: "Samut Songkhram, Thailand",
    category: "sight",
    priority: "candidate",
    tags: ["market", "day trip"],
    highlights: ["Railway market"],
  }),
];

const stops: Stop[] = [
  { id: "stop-phed-mark", dayId: "day-2", placeId: "place-phed-mark", order: 1, transportToNext: "walk" },
  { id: "stop-wat-arun", dayId: "day-2", placeId: "place-wat-arun", order: 2, transportToNext: "transit" },
  { id: "stop-tha-maharaj", dayId: "day-2", placeId: "place-tha-maharaj", order: 3, transportToNext: "walk" },
  { id: "stop-painting", dayId: "day-2", placeId: "place-painting-studio", order: 4, transportToNext: "taxi" },
  { id: "stop-supanniga", dayId: "day-2", placeId: "place-supanniga", order: 5 },
];

export function createSampleData(): AppData {
  return {
    version: 2,
    trips: [structuredClone(trip)],
    days: structuredClone(days),
    places: structuredClone(places),
    stops: structuredClone(stops),
    accommodations: [],
    transportBookings: [],
  };
}
