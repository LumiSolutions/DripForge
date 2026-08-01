/** Accept-String für iOS Safari/Chrome — Endungen + MIME + octet-stream. */
export const MODEL_FILE_ACCEPT =
  ".stl,.obj,.glb,.gltf,.3mf,model/stl,application/sla,application/vnd.ms-pki.stl,model/gltf-binary,model/gltf+json,application/octet-stream"

export const MODEL_FILE_EXTENSIONS = [
  "stl",
  "obj",
  "glb",
  "gltf",
  "3mf",
] as const

export type ModelFileExtension = (typeof MODEL_FILE_EXTENSIONS)[number]

export const MODEL_PREVIEW_EXTENSIONS = ["stl", "obj", "glb", "gltf"] as const

export function getFileExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.trim().toLowerCase()
  return ext || null
}

export function isAllowedModelFile(file: File): boolean {
  const ext = getFileExtension(file.name)
  if (!ext) return false
  return (MODEL_FILE_EXTENSIONS as readonly string[]).includes(ext)
}

export function isPreviewableModelFile(file: File): boolean {
  const ext = getFileExtension(file.name)
  if (!ext) return false
  return (MODEL_PREVIEW_EXTENSIONS as readonly string[]).includes(ext)
}
