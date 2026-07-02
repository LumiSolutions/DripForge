"use client"

import { Fragment } from "react"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import type { SiteTextKey } from "@/lib/admin/site-texts"
import { cn } from "@/lib/utils"

export type SiteTextPhrasePart = {
  key: SiteTextKey
  className?: string
}

type SiteTextPhraseProps = {
  parts: SiteTextPhrasePart[]
  className?: string
  /** Word-boundary splits insert one space between parts. Syllable splits keep parts flush. */
  spaced?: boolean
}

export function SiteTextPhrase({
  parts,
  className,
  spaced = true,
}: SiteTextPhraseProps) {
  const { t } = useSiteTexts()
  const trimmed = parts.map((part) => t(part.key).trim())

  const content = parts.map((part, index) => (
    <Fragment key={part.key}>
      {spaced && index > 0 && trimmed[index - 1] && trimmed[index] ? (
        <span aria-hidden="true"> </span>
      ) : null}
      <SiteText k={part.key} className={part.className} trim />
    </Fragment>
  ))

  if (!className) {
    return <>{content}</>
  }

  return <span className={cn(className)}>{content}</span>
}
