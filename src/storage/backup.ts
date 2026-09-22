import type { AppData } from "../model/types";
import type { RouteCacheSnapshot } from "../map/googleMaps";

const BACKUP_FORMAT = "travel-spatial-planner";
const BACKUP_VERSION = 1;

interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: AppData;
  routeCache: RouteCacheSnapshot;
}

export function downloadDataBackup(data: AppData, routeCache: RouteCacheSnapshot): void {
  const payload: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    routeCache,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `travel-spatial-planner-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readDataBackup(file: File): Promise<{ data: AppData; routeCache?: RouteCacheSnapshot }> {
  const parsed: unknown = JSON.parse(await file.text());
  const data = isBackupEnvelope(parsed) ? parsed.data : parsed;
  if (!isAppData(data)) throw new Error("This file is not a valid Travel Spatial Planner backup.");
  return { data, routeCache: isBackupEnvelope(parsed) ? parsed.routeCache : undefined };
}

function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BackupEnvelope>;
  return candidate.format === BACKUP_FORMAT && candidate.version === BACKUP_VERSION && Boolean(candidate.data);
}

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AppData>;
  return Boolean(
    data.version === 2 &&
      Array.isArray(data.trips) &&
      Array.isArray(data.days) &&
      Array.isArray(data.places) &&
      Array.isArray(data.stops) &&
      Array.isArray(data.accommodations) &&
      Array.isArray(data.transportBookings),
  );
}
