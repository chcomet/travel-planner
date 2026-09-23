# Travel Spatial Planner

Travel Spatial Planner is a local-first travel itinerary planner for organizing trips, daily stops, places, accommodations, and transport bookings. It supports flights, trains, buses, interactive maps, candidate places, HTML exports, and local JSON backups.

## Development

```bash
npm install
npm run dev
```

Production builds can be verified with `npm run build`.

## Google Maps API key

Interactive maps require a Google Maps API key. Before you can use the map features, you need to apply for a demo key:

- Apply here: <https://mapsplatform.google.com/maps-demo-key/>

Once you have the key, set it in your environment (see [`.env.example`](./.env.example)).

## Roadmap

Planned features:

- **小红书 connector + JEV**: one-click import of favorites/collections into candidates, with automatic categorization
- **高德地图 (AMap) API support**: add support for the AMap (Gaode) mapping API

## Trip exports

Place exported trip JSON backups in [`trips/`](./trips). The directory is intentionally kept in the repository so trip snapshots can be versioned alongside the planner.
