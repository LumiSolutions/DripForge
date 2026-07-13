/** Client-seitiger CSV-Export für Excel. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escape = (value: string | number | null | undefined): string => {
    const raw = value == null ? "" : String(value)
    if (/[",;\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }

  const lines = [
    headers.map(escape).join(";"),
    ...rows.map((row) => row.map(escape).join(";")),
  ]

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
