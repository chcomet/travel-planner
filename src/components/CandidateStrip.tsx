import { useEffect, useRef } from "preact/hooks";
import type { Place, PlaceCategory, PlacePriority } from "../model/types";
import { categoryLabels, priorityLabels } from "../model/types";
import { Icon } from "./Icons";

interface CandidateStripProps {
  places: Place[];
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
  onHoverPlace: (placeId?: string) => void;
  onDeletePlace: (placeId: string) => void;
  onAddCandidate: () => void;
  categoryFilter: PlaceCategory | "all";
  priorityFilter: PlacePriority | "all";
  onCategoryFilterChange: (value: PlaceCategory | "all") => void;
  onPriorityFilterChange: (value: PlacePriority | "all") => void;
}

function placeIcon(category: PlaceCategory): string {
  if (category === "cafe") return "coffee";
  if (category === "food") return "food";
  if (category === "shopping") return "shopping";
  if (category === "activity") return "activity";
  return "pin";
}

function priorityClass(priority: PlacePriority): string { return `priority-chip priority-chip--${priority}`; }

export function CandidateStrip({ places, selectedPlaceId, onSelectPlace, onHoverPlace, onDeletePlace, onAddCandidate, categoryFilter, priorityFilter, onCategoryFilterChange, onPriorityFilterChange }: CandidateStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPlaceId) return;
    stripRef.current?.querySelector<HTMLElement>(`[data-place-id="${CSS.escape(selectedPlaceId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedPlaceId]);

  return <section className="candidate-strip">
    <div className="candidate-strip__header">
      <span>CANDIDATES ({places.length})</span>
      <div className="candidate-strip__filters">
        <select aria-label="Filter candidates by category" value={categoryFilter} onChange={(event) => onCategoryFilterChange((event.currentTarget as HTMLSelectElement).value as PlaceCategory | "all")}>
          <option value="all">All categories</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select aria-label="Filter candidates by priority" value={priorityFilter} onChange={(event) => onPriorityFilterChange((event.currentTarget as HTMLSelectElement).value as PlacePriority | "all")}>
          <option value="all">All priorities</option>
          {Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      <div className="candidate-strip__controls"><button className="text-button add-candidate-button" onClick={onAddCandidate}><Icon name="plus" size={14} /> Add Candidate</button><button className="icon-button icon-button--tiny" aria-label="Scroll candidates left" onClick={() => stripRef.current?.scrollBy({ left: -320, behavior: "smooth" })}><Icon name="chevronLeft" size={15} /></button><button className="icon-button icon-button--tiny" aria-label="Scroll candidates right" onClick={() => stripRef.current?.scrollBy({ left: 320, behavior: "smooth" })}><Icon name="chevronRight" size={15} /></button></div>
    </div>
    <div className="candidate-cards" ref={stripRef}>
      {places.map((place) => <div className={`candidate-card ${selectedPlaceId === place.id ? "is-selected" : ""}`} key={place.id} data-place-id={place.id} onMouseEnter={() => onHoverPlace(place.id)} onMouseLeave={() => onHoverPlace(undefined)}>
        <button className="candidate-card__main" onClick={() => onSelectPlace(place.id)}><span className="candidate-card__icon"><Icon name={placeIcon(place.category)} size={18} /></span><span className="candidate-card__body"><strong>{place.name}</strong><small>{categoryLabels[place.category]}</small><span className={priorityClass(place.priority)}>{priorityLabels[place.priority]}</span></span></button>
        <button className="candidate-card__delete" aria-label={`Delete ${place.name}`} title="Delete candidate" onClick={() => onDeletePlace(place.id)}><Icon name="trash" size={13} /></button>
      </div>)}
      {!places.length && <div className="candidate-empty">Every available place is scheduled or saved as an essential.</div>}
    </div>
  </section>;
}
