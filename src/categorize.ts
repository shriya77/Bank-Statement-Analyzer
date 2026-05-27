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
    case 'ski_towers_maintenance':
      return 'SKI Towers Maintenance'
    case 'electricity_payment':
      return 'Electricity Payment'
    case 'indu':
      return 'Indu'
    case 'mutual_funds':
      return 'Mutual Funds'
    case 'room':
      return 'Room'
  }
}
