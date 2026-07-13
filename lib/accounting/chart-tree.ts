import type { Account } from "@/lib/accounting/account-types"

export type ChartTreeItem = {
  account: Account
  level: 1 | 2 | 3 | 4
}

function sortAccounts(a: Account, b: Account): number {
  const na = Number(a.number)
  const nb = Number(b.number)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
  return a.number.localeCompare(b.number, "de")
}

export function buildChartTreeItems(accounts: Account[]): ChartTreeItem[] {
  const active = accounts.filter((account) => account.isActive !== false)
  const byNumber = new Map(active.map((account) => [account.number, account]))
  const childrenByGroup = new Map<string, Account[]>()

  for (const account of active) {
    const parent = account.group?.trim()
    if (!parent || !byNumber.has(parent)) continue
    const siblings = childrenByGroup.get(parent) ?? []
    siblings.push(account)
    childrenByGroup.set(parent, siblings)
  }

  const roots = active
    .filter((account) => {
      const parent = account.group?.trim()
      return !parent || !byNumber.has(parent)
    })
    .sort(sortAccounts)

  const items: ChartTreeItem[] = []

  function walk(account: Account, level: 1 | 2 | 3 | 4) {
    const isGroup = account.type === "Gruppe"
    const displayLevel: 1 | 2 | 3 | 4 = isGroup
      ? (Math.min(level, 3) as 1 | 2 | 3)
      : 4
    items.push({ account, level: displayLevel })

    const children = (childrenByGroup.get(account.number) ?? []).sort(sortAccounts)
    for (const child of children) {
      const nextLevel = isGroup
        ? (Math.min(displayLevel + 1, 4) as 1 | 2 | 3 | 4)
        : 4
      walk(child, nextLevel)
    }
  }

  for (const root of roots) {
    walk(root, 1)
  }

  return items
}

export function groupAccountsForSelect(accounts: Account[]): Account[] {
  return accounts
    .filter((account) => account.type === "Gruppe" && account.isActive !== false)
    .sort(sortAccounts)
}
