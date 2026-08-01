export type FaqBotReply = {
  answer: string
  handoffSuggested: boolean
}

const FAQ_RULES: Array<{
  patterns: RegExp[]
  answer: string
}> = [
  {
    patterns: [/versand|lieferzeit|lieferung|shipping|paket/i],
    answer:
      "Wir versenden aus der Schweiz. Die Lieferzeit hängt vom Produkt ab (typisch 3–10 Werktage nach Produktion). Sobald deine Bestellung versendet ist, erhältst du eine Tracking-Mail.",
  },
  {
    patterns: [/filament|pla|petg|asa|material/i],
    answer:
      "Im 3D-Druck-Konfigurator und Shop kannst du verfügbare Filamente (z. B. PLA, PETG, ASA) und Farben wählen — nur Lagerartikel mit Bestand sind auswählbar.",
  },
  {
    patterns: [/zahlung|twint|apple.?pay|google.?pay|rechnung|vorkasse|stripe/i],
    answer:
      "Du kannst per Karte (inkl. Apple Pay / Google Pay im Stripe-Checkout), TWINT oder Rechnung/Vorkasse bezahlen — je nach aktiver Shop-Einstellung.",
  },
  {
    patterns: [/storno|rückgabe|retoure|widerruf/i],
    answer:
      "Individuelle Aufträge (3D/Laser) sind oft massgefertigt. Schreib uns bitte deine Bestell-ID — unser Team prüft Storno/Retoure persönlich.",
  },
  {
    patterns: [/mensch|mitarbeiter|agent|live.?chat|support|hilfe/i],
    answer:
      "Alles klar — ich verbinde dich mit dem Live-Support. Bitte kurz dein Anliegen stehen lassen, unser Team meldet sich so schnell wie möglich.",
  },
]

/**
 * Einfacher FAQ-Bot für häufige Shop-Fragen.
 * Bei Unsicherheit oder explizitem Menschenwunsch → Handover.
 */
export function answerFaqBot(message: string): FaqBotReply {
  const text = message.trim()
  if (!text) {
    return {
      answer: "Schreib uns gerne deine Frage zu Versand, Materialien oder Zahlung.",
      handoffSuggested: false,
    }
  }

  for (const rule of FAQ_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      const handoffSuggested = /mensch|mitarbeiter|agent|live/i.test(text)
      return { answer: rule.answer, handoffSuggested }
    }
  }

  return {
    answer:
      "Dazu habe ich keine sichere Standardantwort. Möchtest du mit einem Mitarbeitenden sprechen? Schreib «Mensch» oder warte auf den Live-Chat.",
    handoffSuggested: true,
  }
}
