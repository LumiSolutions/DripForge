const chf = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
})

export function formatChf(amount: number): string {
  return chf.format(amount)
}
