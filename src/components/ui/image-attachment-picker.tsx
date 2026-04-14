import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Camera, X } from 'lucide-react';

const MAX_FILES = 4;

interface ImageAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function ImageAttachmentPicker({ files, onChange }: ImageAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const combined = [...files, ...incoming];
    if (combined.length > MAX_FILES) {
      toast.error(`Максимум ${MAX_FILES} фото на сообщение`);
      onChange(combined.slice(0, MAX_FILES));
      return;
    }
    onChange(combined);
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {files.map((file, i) => (
        <div key={i} className="relative w-14 h-14 flex-shrink-0">
          <img
            src={URL.createObjectURL(file)}
            alt={`фото ${i + 1}`}
            className="w-full h-full object-cover rounded border border-border"
          />
          <button
            type="button"
            onClick={() => removeFile(i)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs leading-none"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}

      {files.length < MAX_FILES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded border border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Прикрепить фото"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          handleFiles(e.target.files);
          // Reset so the same file can be picked again
          e.target.value = '';
        }}
      />
    </div>
  );
}
