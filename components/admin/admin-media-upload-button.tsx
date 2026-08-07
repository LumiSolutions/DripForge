"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AdminMediaUploadButtonProps = {
  label?: string
  onUploaded: (url: string) => void
  className?: string
  accept?: string
  productId?: string
  category?: string
}

export async function uploadCmsMediaFile(
  file: File,
  options?: { productId?: string; category?: string }
): Promise<string> {
  const formData = new FormData()
  formData.append("productId", options?.productId ?? "cms-pages")
  formData.append("category", options?.category ?? "site-images")
  formData.append("file", file)
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen")
  return data.url as string
}

export function AdminMediaUploadButton({
  label = "Upload Bild / Medien",
  onUploaded,
  className,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  productId = "cms-pages",
  category = "site-images",
}: AdminMediaUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadCmsMediaFile(file, { productId, category })
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="mr-2 h-3.5 w-3.5" />
        )}
        {label}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
