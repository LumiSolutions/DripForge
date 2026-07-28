/** Gemeinsame Tailwind-Klassen für das Admin-Dashboard (Light + Dark). */
export const adminUi = {
  page: "bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100",
  muted: "text-slate-500 dark:text-zinc-400",
  heading: "text-slate-900 dark:text-white",
  subheading: "text-slate-600 dark:text-zinc-400",
  sidebar:
    "border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900",
  sidebarBorder: "border-slate-200 dark:border-zinc-800",
  brandText: "text-slate-900 dark:text-white",
  navInactive:
    "text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white",
  navActive:
    "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30 dark:text-orange-400",
  footerBtn:
    "text-slate-500 hover:bg-slate-200/90 hover:text-slate-800 dark:text-zinc-500 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-300",
  card: "border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none",
  cardMuted: "border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/40",
  listItem:
    "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700",
  listItemActive: "border-orange-500/50 bg-orange-500/10",
  section: "rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/30",
  label: "text-slate-700 dark:text-zinc-300",
  labelMuted: "text-slate-500 dark:text-zinc-400",
  input:
    "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-600",
  select:
    "border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white",
  fileInput:
    "border-slate-300 bg-white text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-orange-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:file:bg-orange-500/20 dark:file:text-orange-300",
  tableWrap: "overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800",
  tableHead: "text-slate-500 dark:text-zinc-400",
  tableHeadRow: "border-slate-200 hover:bg-transparent dark:border-zinc-800",
  tableRow:
    "border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80",
  tableRowExpanded: "bg-slate-100 dark:bg-zinc-900/60",
  tableCell: "text-slate-800 dark:text-zinc-200",
  tableCellMuted: "text-slate-500 dark:text-zinc-500",
  detailPanel:
    "border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/60",
  bodyText: "text-slate-700 dark:text-zinc-300",
  accentTitle: "text-orange-600 dark:text-orange-400",
  empty:
    "rounded-xl border border-dashed border-slate-300 text-slate-500 dark:border-zinc-700 dark:text-zinc-500",
  loader: "text-slate-500 dark:text-zinc-400",
  error:
    "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  errorLg:
    "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  success:
    "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  outlineBtn:
    "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  primaryBtn: "bg-orange-500 hover:bg-orange-600",
  loginPage: "bg-slate-100 dark:bg-zinc-950",
  loginCard:
    "rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
  loginTitle: "text-slate-700 dark:text-zinc-300",
  thumbnail: "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-950",
  badgeInactive:
    "border-slate-300 text-slate-500 dark:border-zinc-600 dark:text-zinc-400",
  badgeOutline:
    "border-slate-300 text-slate-600 dark:border-zinc-700 dark:text-zinc-300",
  orderItemCard:
    "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50",
  dashedBox: "border-dashed border-slate-300 dark:border-zinc-700",
} as const
