import { useRef } from "preact/hooks";
import { Icon } from "./Icons";

interface DataBackupControlsProps {
  onExport: () => void;
  onImport: (file: File) => void;
}

export function DataBackupControls({ onExport, onImport }: DataBackupControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="data-backup-controls">
      <button className="backup-button" onClick={onExport}><Icon name="download" size={13} /> Save JSON</button>
      <button className="backup-button" onClick={() => inputRef.current?.click()}><Icon name="upload" size={13} /> Load JSON</button>
      <input
        ref={inputRef}
        className="data-backup-controls__input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = (event.currentTarget as HTMLInputElement).files?.[0];
          if (file) onImport(file);
          (event.currentTarget as HTMLInputElement).value = "";
        }}
      />
    </div>
  );
}
