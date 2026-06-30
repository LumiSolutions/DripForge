import { FileText } from "lucide-react"
import { isImageAttachment } from "@/lib/tawk/tawk-attachments"
import type { TawkUiMessage } from "@/lib/tawk/tawk-types"
import { cn } from "@/lib/utils"

type ChatMessageContentProps = {
  message: TawkUiMessage
  isVisitor: boolean
}

export function ChatMessageContent({ message, isVisitor }: ChatMessageContentProps) {
  const attachments = message.attachments ?? []
  const showText =
    Boolean(message.content) &&
    !attachments.some((item) => item.name && item.name === message.content)

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const key = `${message.id}-${attachment.url}`
        if (isImageAttachment(attachment)) {
          return (
            <a
              key={key}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={attachment.name ?? "Bild"}
                className="max-h-40 max-w-full rounded-lg object-cover"
                loading="lazy"
              />
            </a>
          )
        }

        return (
          <a
            key={key}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs underline-offset-2 hover:underline",
              isVisitor ? "border-primary-foreground/20" : "border-border"
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{attachment.name ?? "Datei öffnen"}</span>
          </a>
        )
      })}
      {showText && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
    </div>
  )
}
