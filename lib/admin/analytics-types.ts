export type OrderAnalyticsRow = {
  orderId: string
  createdAt: string
  status: string
  totals: {
    total: number
    subtotal?: number
  }
  items: {
    name: string
    quantity: number
    price: number
    type?: string
    customDetails?: {
      filament?: string
      color?: string
      colorWishes?: string
      material?: string
      variant?: string
      materialVariant?: string
    }
  }[]
}

export type AdminAnalyticsSummary = {
  totalRevenueChf: number
  orderCount: number
  openOrderCount: number
  averageOrderValueChf: number
}

export type AdminAnalyticsTimePoint = {
  date: string
  orders: number
  revenueChf: number
}

export type AdminAnalyticsTopProduct = {
  name: string
  quantity: number
  revenueChf: number
}

export type AdminAnalyticsTopOption = {
  label: string
  category: string
  count: number
}

export type AdminAnalytics = {
  summary: AdminAnalyticsSummary
  timeSeries: AdminAnalyticsTimePoint[]
  topProducts: AdminAnalyticsTopProduct[]
  topOptions: AdminAnalyticsTopOption[]
  generatedAt: string
}
