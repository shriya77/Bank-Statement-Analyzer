export type Category =
  | 'Food & Dining'
  | 'Shopping'
  | 'Transport'
  | 'Bills & Utilities'
  | 'Entertainment'
  | 'Health'
  | 'Travel'
  | 'Transfers'
  | 'Subscriptions'
  | 'Income'
  | 'Mutual Funds'
  | 'Amma'
  | 'Other'

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: Category
  raw: Record<string, string>
}

export type RoomOrShopType = 'room' | 'shop'

export interface RoomShopMapping {
  id: string
  type: RoomOrShopType
  /** e.g. "406", "308", "BRIYANIPALAYAM" - used to match in narration */
  identifier: string
  /** Customer / tenant / business name */
  customerName: string
}

export const CATEGORY_COLORS: Record<Category, string> = {
  'Food & Dining': '#f59e0b',
  'Shopping': '#8b5cf6',
  'Transport': '#06b6d4',
  'Bills & Utilities': '#3b82f6',
  'Entertainment': '#ec4899',
  'Health': '#10b981',
  'Travel': '#6366f1',
  'Transfers': '#64748b',
  'Subscriptions': '#f97316',
  'Income': '#22c55e',
  'Mutual Funds': '#0ea5e9',
  'Amma': '#a855f7',
  'Other': '#6b7280',
}

const MAPPING_STORAGE_KEY = 'bank-statement-room-shop-mapping'

export function loadMappingFromStorage(): RoomShopMapping[] {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMappingToStorage(mapping: RoomShopMapping[]) {
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping))
}
