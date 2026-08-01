"use client"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"

function SortableThumb({
  id,
  url,
  index,
  onRemove,
}: {
  id: string
  url: string
  index: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border",
        adminUi.thumbnail,
        isDragging && "z-10 ring-2 ring-primary"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Galerie ${index + 1}`}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <button
        type="button"
        className="absolute left-0.5 top-0.5 rounded bg-black/70 p-0.5 text-zinc-200"
        aria-label="Ziehen zum Sortieren"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 z-10 rounded bg-black/80 p-1 text-white shadow-sm ring-1 ring-white/30"
        aria-label="Bild entfernen"
      >
        <X className="h-3 w-3" />
      </button>
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
        {index + 1}
      </span>
    </div>
  )
}

type AdminGallerySortableProps = {
  images: string[]
  onChange: (next: string[]) => void
}

export function AdminGallerySortable({
  images,
  onChange,
}: AdminGallerySortableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const ids = images.map((url, index) => `${index}:${url.slice(-24)}`)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(images, oldIndex, newIndex))
  }

  if (images.length === 0) return null

  return (
    <div className="space-y-1.5 pt-1">
      <p className={cn("text-xs", adminUi.muted)}>
        Reihenfolge per Drag & Drop ändern — erstes Bild = Shop-Cover.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {images.map((url, index) => (
              <SortableThumb
                key={ids[index]}
                id={ids[index]!}
                url={url}
                index={index}
                onRemove={() =>
                  onChange(images.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
