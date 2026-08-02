export type ThanksPageAnimationMode = "text" | "interactive" | "media"

export type ThanksPageSettings = {
  /** a) Standard-Text | b) Interaktive Code-Animation | c) Eigene Medien */
  animationMode: ThanksPageAnimationMode
  /** MP4 / GIF / Lottie-JSON URL (nur bei mode=media) */
  mediaUrl: string | null
  mediaKind: "mp4" | "gif" | "lottie" | null
}

export const DEFAULT_THANKS_PAGE_SETTINGS: ThanksPageSettings = {
  animationMode: "interactive",
  mediaUrl: null,
  mediaKind: null,
}

export function normalizeThanksPageSettings(
  input?: Partial<ThanksPageSettings> | null
): ThanksPageSettings {
  const mode =
    input?.animationMode === "text" ||
    input?.animationMode === "interactive" ||
    input?.animationMode === "media"
      ? input.animationMode
      : DEFAULT_THANKS_PAGE_SETTINGS.animationMode

  const mediaUrl =
    typeof input?.mediaUrl === "string" && input.mediaUrl.trim()
      ? input.mediaUrl.trim().slice(0, 2000)
      : null

  const mediaKind =
    input?.mediaKind === "mp4" ||
    input?.mediaKind === "gif" ||
    input?.mediaKind === "lottie"
      ? input.mediaKind
      : mediaUrl?.endsWith(".json")
        ? "lottie"
        : mediaUrl?.match(/\.(gif)(\?|$)/i)
          ? "gif"
          : mediaUrl?.match(/\.(mp4|webm)(\?|$)/i)
            ? "mp4"
            : null

  return {
    animationMode: mode,
    mediaUrl,
    mediaKind,
  }
}
