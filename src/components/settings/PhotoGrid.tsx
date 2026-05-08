import { useRef } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadImage } from '@/services/api/imagesApi';
import { showApiError } from '@/lib/apiError';
import { useLanguage } from '@/contexts/LanguageContext';

interface PhotoGridProps {
  images: string[];
  maxPhotos: number;
  onChange: (next: string[]) => void;
}

interface SortableTileProps {
  url: string;
  onDelete: () => void;
}

function SortableTile({ url, onDelete }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-square rounded-lg overflow-hidden border touch-none ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
      {...listeners}
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center"
        aria-label="Delete photo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function PhotoGrid({ images, maxPhotos, onChange }: PhotoGridProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.indexOf(String(active.id));
    const newIndex = images.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  const handleFile = async (file: File) => {
    if (images.length >= maxPhotos) return;
    try {
      const { url } = await uploadImage(file);
      onChange([...images, url]);
    } catch (err) {
      showApiError(err, t('settings.photos.uploadFailed'));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-2">
          {images.map((url) => (
            <SortableTile
              key={url}
              url={url}
              onDelete={() => onChange(images.filter(u => u !== url))}
            />
          ))}
          {images.length < maxPhotos && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary"
              aria-label={t('settings.photos.add')}
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}
