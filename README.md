# Travel Spatial Planner

Travel Spatial Planner is a local-first travel itinerary planner for organizing trips, daily stops, places, accommodations, and transport bookings. It supports flights, trains, buses, interactive maps, candidate places, HTML exports, and local JSON backups.

## Development

```bash
npm install
npm run dev
```

Production builds can be verified with `npm run build`.

## Trip exports

Place exported trip JSON backups in [`trips/`](./trips). The directory is intentionally kept in the repository so trip snapshots can be versioned alongside the planner.
