import { useEffect, useState } from "preact/hooks";
import type { Day, Place, PlaceCategory, PlacePriority } from "../model/types";
import { categoryLabels, priorityLabels } from "../model/types";
import { Icon } from "./Icons";

interface PlaceDetailCardProps {
  place?: Place;
  days: Day[];
  activeDayId: string;
  activeDayStop?: boolean;
  isPreview?: boolean;
  onClose: () => void;
  onSave: (placeId: string, patch: Partial<Place>) => void;
  onAddCandidate: (place: Place) => void;
  onAddToDay: (place: Place, dayId: string) => void;
  canDelete?: boolean;
  onDelete?: (placeId: string) => void;
}

interface Draft {
  category: PlaceCategory;
  priority: PlacePriority;
  tags: string;
  highlights: string;
  notes: string;
  sourceUrl: string;
}

const categoryOptions: PlaceCategory[] = ["food", "cafe", "sight", "shopping", "activity", "hotel", "airport", "station", "other"];

function makeDraft(place: Place): Draft {
  return {
    category: place.category,
    priority: place.priority,
    tags: place.tags.join(", "),
    highlights: place.highlights.join(", "),
    notes: place.notes ?? "",
    sourceUrl: place.sourceUrl ?? "",
  };
}

export function PlaceDetailCard({ place, days, activeDayId, activeDayStop, isPreview = false, onClose, onSave, onAddCandidate, onAddToDay, canDelete = false, onDelete }: PlaceDetailCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(place ? makeDraft(place) : null);

  useEffect(() => {
    setEditing(false);
    setDraft(place ? makeDraft(place) : null);
  }, [place?.id]);

  if (!place || !draft) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const save = () => {
    onSave(place.id, {
      category: draft.category,
      priority: draft.priority,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      highlights: draft.highlights.split(",").map((highlight) => highlight.trim()).filter(Boolean),
      notes: draft.notes.trim(),
      sourceUrl: draft.sourceUrl.trim(),
    });
    setEditing(false);
  };

  return (
    <aside className="place-detail-card" aria-label={`Details for ${place.name}`}>
      <div className="place-detail-card__heading">
        <div className="place-detail-card__title">
          <span className="detail-category-icon"><Icon name={place.category === "food" ? "food" : place.category === "activity" ? "activity" : "pin"} size={18} /></span>
          <div>
            <h2>{place.name}</h2>
            <p>{categoryLabels[place.category]} · {place.formattedAddress ?? "Location details unavailable"}</p>
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close details" title="Close">
          <Icon name="close" size={16} />
        </button>
      </div>

      {editing ? (
        <div className="detail-form">
          <label>Category<select value={draft.category} onChange={(event) => updateDraft("category", (event.currentTarget as HTMLSelectElement).value as PlaceCategory)}>{categoryOptions.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select></label>
          <label>Priority<select value={draft.priority} onChange={(event) => updateDraft("priority", (event.currentTarget as HTMLSelectElement).value as PlacePriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Tags<input value={draft.tags} placeholder="thai, coffee" onInput={(event) => updateDraft("tags", (event.currentTarget as HTMLInputElement).value)} /></label>
          <label>Highlights<input value={draft.highlights} placeholder="What makes it interesting?" onInput={(event) => updateDraft("highlights", (event.currentTarget as HTMLInputElement).value)} /></label>
          <label>Notes<textarea value={draft.notes} placeholder="Personal notes" onInput={(event) => updateDraft("notes", (event.currentTarget as HTMLTextAreaElement).value)} /></label>
          <label>Source URL<input value={draft.sourceUrl} placeholder="https://..." onInput={(event) => updateDraft("sourceUrl", (event.currentTarget as HTMLInputElement).value)} /></label>
          <div className="detail-form__actions"><button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" onClick={save}>Save changes</button></div>
        </div>
      ) : (
        <>
          <div className="detail-chips">
            <span className={place.priority === "must_go" ? "priority-chip priority-chip--must_go" : "priority-chip"}>{priorityLabels[place.priority]}</span>
            {place.tags.slice(0, 2).map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}
          </div>

          <div className="detail-section">
            <span className="detail-label">Highlights</span>
            {place.highlights.length ? <p className="detail-value">{place.highlights.join(" · ")}</p> : <p className="detail-muted">No highlights added yet.</p>}
          </div>
          <div className="detail-section">
            <span className="detail-label">Notes</span>
            <p className="detail-value">{place.notes || "No notes added yet."}</p>
          </div>
          {place.sourceUrl && <div className="detail-section">
            <span className="detail-label">Source</span>
            <a className="source-link" href={place.sourceUrl} target="_blank" rel="noreferrer">Open source <Icon name="external" size={13} /></a>
          </div>}
          <div className="detail-actions">
            {isPreview ? <button className="secondary-button" onClick={() => onAddCandidate(place)}><Icon name="pin" size={14} /> Add Candidate</button> : <button className="secondary-button" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> Edit</button>}
            {canDelete && onDelete && <button className="danger-button" onClick={() => onDelete(place.id)} aria-label="Delete place"><Icon name="trash" size={14} /></button>}
            {activeDayStop ? <span className="scheduled-note">On Day {days.find((day) => day.id === activeDayId)?.order}</span> : activeDayId && days.some((day) => day.id === activeDayId) ? <button className="primary-button" onClick={() => onAddToDay(place, activeDayId)}><Icon name="plus" size={14} /> Add to Day {days.find((day) => day.id === activeDayId)?.order}</button> : <span className="scheduled-note">Select a day to add a stop</span>}
          </div>
        </>
      )}
    </aside>
  );
}
