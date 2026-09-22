import type { AppData } from "../model/types";

export const STORAGE_KEY = "travel-spatial-planner";
export const SAFETY_BACKUP_KEY = `${STORAGE_KEY}-safety-backup`;

export function loadData(): AppData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Preserve the exact pre-change payload before the app can save anything new.
    // Never overwrite it automatically; the user can still export newer backups.
    try {
      if (!window.localStorage.getItem(SAFETY_BACKUP_KEY)) {
        window.localStorage.setItem(SAFETY_BACKUP_KEY, raw);
      }
    } catch {
      // A failed safety copy must never prevent the original data from loading.
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isAppData(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveData(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // A full or unavailable localStorage should not make the planner unusable.
  }
}

export function clearData(): void {
  window.localStorage.removeItem(STORAGE_KEY);
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
