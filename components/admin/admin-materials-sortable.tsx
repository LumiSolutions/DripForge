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
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"

function SortableMaterialShell({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "relative",
        isDragging && "z-20 opacity-90 ring-2 ring-orange-500/50"
      )}
    >
      {!disabled && (
        <button
          type="button"
          className={cn(
            "absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm",
            adminUi.outlineBtn
          )}
          aria-label="Ziehen zum Sortieren"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
}

export function AdminMaterialsSortableGrid({
  ids,
  disabled,
  onReorder,
  children,
}: {
  ids: string[]
  disabled?: boolean
  onReorder: (orderedIds: string[]) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export { SortableMaterialShell }
