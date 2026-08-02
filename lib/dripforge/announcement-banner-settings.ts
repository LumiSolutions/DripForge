export type AnnouncementBannerStyle = "unicolor" | "animated-gradient"

export type AnnouncementBannerSettings = {
  active: boolean
  text: string
  discountCode: string
  linkUrl: string
  style: AnnouncementBannerStyle
  /** Hintergrundfarbe für Unicolor (CSS-Farbe) */
  backgroundColor: string
}

export const DEFAULT_ANNOUNCEMENT_BANNER: AnnouncementBannerSettings = {
  active: false,
  text: "",
  discountCode: "",
  linkUrl: "",
  style: "unicolor",
  backgroundColor: "#ea580c",
}

export function normalizeAnnouncementBanner(
  input?: Partial<AnnouncementBannerSettings> | null
): AnnouncementBannerSettings {
  const style =
    input?.style === "animated-gradient" ? "animated-gradient" : "unicolor"
  return {
    active: input?.active === true,
    text: typeof input?.text === "string" ? input.text.trim().slice(0, 240) : "",
    discountCode:
      typeof input?.discountCode === "string"
        ? input.discountCode.trim().slice(0, 64)
        : "",
    linkUrl:
      typeof input?.linkUrl === "string" ? input.linkUrl.trim().slice(0, 500) : "",
    style,
    backgroundColor:
      typeof input?.backgroundColor === "string" &&
      input.backgroundColor.trim().length > 0
        ? input.backgroundColor.trim().slice(0, 40)
        : DEFAULT_ANNOUNCEMENT_BANNER.backgroundColor,
  }
}
