import type { Category } from './types'
import { classifyBucket } from './reportLogic'

export function categorizeDescription(description: string): Category {
  const bucket = classifyBucket(description, [])
  switch (bucket) {
    case 'amma':
      return 'Amma'
    case 'shop':
      return 'Shop'
    case 'house':
      return 'House'
    case 'house_tax':
      return 'House Tax'
    case 'ski_towers_maintenance':
      return 'SKI Towers Maintenance'
    case 'electricity_payment':
      return 'Electricity Payment'
    case 'indu':
      return 'Indu'
    case 'mutual_fund_purchase':
      return 'Mutual Fund Purchase'
    case 'mutual_fund_sell':
      return 'Mutual Fund Sell'
    case 'others':
      return 'Others'
    case 'hdfc':
      return 'HDFC'
    case 'bank_interest':
      return 'Interest'
    case 'income_tax':
      return 'Income Tax'
    case 'advertisement':
      return 'Advertisement'
    case 'telephone':
      return 'Telephone'
    case 'bank_charges':
      return 'Bank Charges'
    case 'room':
      return 'Room'
  }
}
