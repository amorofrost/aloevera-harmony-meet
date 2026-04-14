import React, { useState } from 'react';

interface ImageAttachmentDisplayProps {
  imageUrls: string[];
}

export function ImageAttachmentDisplay({ imageUrls }: ImageAttachmentDisplayProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!imageUrls || imageUrls.length === 0) return null;

  // 1 image → full width; 2+ → 2-column grid
  const gridCols = imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <>
      <div className={`grid ${gridCols} gap-1 mt-2 max-w-xs rounded overflow-hidden`}>
        {imageUrls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`вложение ${i + 1}`}
            className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightbox(url)}
          />
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="полный размер"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
