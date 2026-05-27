export type Category =
  | 'Amma'
  | 'Shop'
  | 'House'
  | 'House Tax'
  | 'SKI Towers Maintenance'
  | 'Electricity Payment'
  | 'Indu'
  | 'Mutual Fund Purchase'
  | 'Mutual Fund Sell'
  | 'Others'
  | 'HDFC'
  | 'Interest'
  | 'Income Tax'
  | 'Advertisement'
  | 'Telephone'
  | 'Bank Charges'
  | 'Room'

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: Category
  raw: Record<string, string>
}

export type RoomOrShopType = 'shop' | 'house' | 'room'

export interface RoomShopMapping {
  id: string
  type: RoomOrShopType
  /** e.g. "406", "308", "BRIYANIPALAYAM" - used to match in narration */
  identifier: string
  /** Customer / tenant / business name */
  customerName: string
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Amma: '#a855f7',
  Shop: '#f59e0b',
  House: '#06b6d4',
  'House Tax': '#f97316',
  'SKI Towers Maintenance': '#14b8a6',
  'Electricity Payment': '#eab308',
  Indu: '#ec4899',
  'Mutual Fund Purchase': '#0ea5e9',
  'Mutual Fund Sell': '#38bdf8',
  Others: '#94a3b8',
  HDFC: '#2563eb',
  Interest: '#84cc16',
  'Income Tax': '#60a5fa',
  Advertisement: '#f43f5e',
  Telephone: '#22d3ee',
  'Bank Charges': '#64748b',
  Room: '#22c55e',
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

export const BUILTIN_MAPPING_TYPES = ['shop', 'house', 'room'] as const
