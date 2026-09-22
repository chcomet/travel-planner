import type { ComponentChildren } from "preact";

interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
}

const paths: Record<string, ComponentChildren> = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  note: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6V11.6h.8a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1Z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  walk: <><circle cx="13" cy="4" r="2" /><path d="m10 22 2-7 2-2 3 3M9 10l3-2 3 2 2 4M12 15l-4 3" /></>,
  boat: <><path d="M4 16h16l-2 4H6l-2-4ZM6 16l2-8h4l4 8M10 8V4h4l2 4M3 21c1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0" /></>,
  food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 10v11M16 3v18M16 3c3 2 3 6 0 8" /></>,
  activity: <><path d="m12 3 2.2 4.6L19 9.8l-4.8 2.2L12 17l-2.2-5L5 9.8l4.8-2.2L12 3Z" /><path d="m19 16 .8 1.7L21.5 18l-1.7.8L19 20.5l-.8-1.7-1.7-.8 1.7-.8L19 16Z" /></>,
  coffee: <><path d="M4 8h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM17 10h1a3 3 0 0 1 0 6h-1M7 4c-1 1 1 2 0 3M11 4c-1 1 1 2 0 3" /></>,
  shopping: <><path d="M5 8h14l-1 12H6L5 8ZM9 8a3 3 0 0 1 6 0" /></>,
  car: <><path d="m4 16 1.5-6h13l1.5 6v4h-2v-2H6v2H4v-4ZM6 10l1-3h10l1 3M7 16h.1M17 16h.1" /></>,
  send: <><path d="m3 11 18-8-8 18-2-8-8-2Z" /><path d="m11 13 4-4" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v5H5V5h5" /></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 7.5 3 3" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2" /><path d="M20 20v-5h-5" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.note}
    </svg>
  );
}
