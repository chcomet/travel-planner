export function dateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function addDays(value: string, amount: number): string {
  const date = dateFromInput(value);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = start;
  while (current <= end && dates.length < 366) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function formatDate(value?: string, includeYear = false): string {
  if (!value) return "Dates not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(dateFromInput(value));
}

export function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return "Dates not set";
  if (start && !end) return formatDate(start, true);
  if (!start && end) return formatDate(end, true);
  return `${formatDate(start)} – ${formatDate(end)}, ${dateFromInput(start!).getFullYear()}`;
}
