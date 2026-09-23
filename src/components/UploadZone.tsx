import { useCallback, useRef, useState } from "react";
import { FileUp, Boxes, AlertCircle } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
}

export default function UploadZone({ onFile, onSample }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file?: File): boolean => {
    if (!file) return false;
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      setError("Only .ifc files are supported.");
      return false;
    }
    if (file.size === 0) {
      setError("The selected file is empty.");
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (validate(file)) onFile(file!);
    },
    [onFile]
  );

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-10 py-16 transition-colors ${
            dragging
              ? "border-accent bg-accent/10"
              : "border-border bg-surface hover:border-accent/60 hover:bg-surface2"
          }`}
        >
          <FileUp className="h-12 w-12 text-accent" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-lg font-medium">Drop an IFC file here</p>
            <p className="mt-1 text-sm text-muted">
              or click to browse — .ifc files only, processed 100% in your browser
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".ifc"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (validate(file)) onFile(file!);
              e.target.value = "";
            }}
          />
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={onSample}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-surface2"
        >
          <Boxes className="h-4 w-4 text-accent" />
          Load sample model
        </button>
        <p className="mt-4 text-center text-xs text-muted">
          No file ever leaves your device. All parsing happens locally via WebAssembly.
        </p>
      </div>
    </div>
  );
}
