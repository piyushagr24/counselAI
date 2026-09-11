import { useRef, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";

interface UploadZoneProps {
  onFileSelected?: (file: File) => void;
  compact?: boolean;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelected, compact = false, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (disabled) return;
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    onFileSelected?.(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed text-center transition-colors ${
        compact ? "p-6" : "p-12"
      } ${isDragging ? "border-accent-600 bg-accent-50" : "border-slate-200 bg-slate-25 hover:border-accent-100"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      {fileName ? (
        <>
          <FileText size={compact ? 24 : 32} className="text-accent-600" />
          <p className="mt-3 text-sm font-medium text-ink-900">{fileName}</p>
          <p className="mt-1 text-xs text-slate-500">Click to choose a different file</p>
        </>
      ) : (
        <>
          <UploadCloud size={compact ? 24 : 32} className="text-slate-400" />
          <p className="mt-3 text-sm font-medium text-ink-900">
            Drop a PDF or DOCX here, or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-500">Max 15MB per file</p>
        </>
      )}
    </div>
  );
}
