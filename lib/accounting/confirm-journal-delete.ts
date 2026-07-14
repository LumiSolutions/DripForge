/**
 * Zweistufige Sicherheitsabfrage vor dem Löschen einer Journalbuchung.
 * @returns true nur wenn beide Bestätigungen akzeptiert wurden
 */
export function confirmJournalEntryDeletion(belegNummer?: string): boolean {
  const label = String(belegNummer ?? "").trim() || "ohne Belegnummer"
  const step1 = window.confirm(
    `Möchten Sie die Buchung ${label} wirklich löschen?`
  )
  if (!step1) return false

  return window.confirm(
    "Sind Sie absolut sicher? Diese Aktion kann nicht rückgängig gemacht werden und beeinflusst Ihre Kontosalden!"
  )
}
