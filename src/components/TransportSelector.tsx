import type { TransportMode } from "../model/types";
import { Icon } from "./Icons";

interface TransportSelectorProps {
  value?: TransportMode;
  onChange: (mode: TransportMode) => void;
}

const transportOptions: Array<[TransportMode, string, string]> = [
  ["walk", "Walk", "walk"],
  ["transit", "Transit", "boat"],
  ["taxi", "Taxi", "car"],
  ["drive", "Drive", "car"],
  ["bike", "Bike", "walk"],
];

export function TransportSelector({ value = "walk", onChange }: TransportSelectorProps) {
  const current = transportOptions.find(([mode]) => mode === value) ?? transportOptions[0];
  return (
    <label className="transport-selector">
      <Icon name={current[2]} size={15} />
      <select value={value} onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value as TransportMode)}>
        {transportOptions.map(([mode, label]) => (
          <option key={mode} value={mode}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
