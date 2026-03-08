import type { Category } from './types'

const lower = (s: string) => s.toLowerCase()

const rules: { category: Category; patterns: (string | RegExp)[] }[] = [
  {
    category: 'Amma',
    patterns: ['padmavathi'],
  },
  {
    category: 'Mutual Funds',
    patterns: ['mutual fund', 'sip', ' mf ', 'equity', 'fund house', ' amc '],
  },
  {
    category: 'Income',
    patterns: [
      'salary', 'payroll', 'direct dep', 'deposit', 'transfer from',
      'refund', 'reimbursement', 'interest', 'dividend', 'ach credit',
      'neft cr', 'imps-', 'room rent', 'rent-', 'payment from phone',
      'advance return', 'advance for shop', 'balnil', 'hyperband',
    ],
  },
  {
    category: 'Transfers',
    patterns: [
      'transfer', 'venmo', 'zelle', 'paypal', 'cash app', 'wire',
      'ach debit', 'internal transfer', 'mobile transfer',
      'tpt-', 'neft dr', 'upi-', 'upi ',
    ],
  },
  {
    category: 'Food & Dining',
    patterns: [
      'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'uber eats',
      'doordash', 'grubhub', 'instacart', 'pizza', 'bar ', 'pub',
      'dining', 'food', 'grocer', 'supermarket', 'trader joe', 'whole food',
      'safeway', 'kroger', 'albertsons', 'walmart', 'costco', 'target',
      'chipotle', 'panera', 'subway', 'srs foods', 'tea shop', 'foods trader',
    ],
  },
  {
    category: 'Subscriptions',
    patterns: [
      'netflix', 'spotify', 'amazon prime', 'apple.com/bill', 'youtube',
      'hulu', 'disney', 'hbo', 'patreon', 'dropbox', 'icloud',
      'adobe', 'microsoft', 'google one', 'audible', 'kindle',
      'subscription', 'monthly', 'recurring',
    ],
  },
  {
    category: 'Bills & Utilities',
    patterns: [
      'electric', 'gas', 'water', 'internet', 'phone', 'mobile',
      'verizon', 'att', 't-mobile', 'comcast', 'xfinity', 'utility',
      'insurance', 'mortgage', 'hoa', 'tax', 'prop tax', 'erode tax',
      'airtel', 'bharti', 'payu', 'maintenance', 'maintence', 'repairs',
    ],
  },
  {
    category: 'Transport',
    patterns: [
      'uber', 'lyft', 'gas station', 'shell', 'chevron', 'exxon',
      'parking', 'toll', 'transit', 'metro', 'bus ', 'train',
      'amtrak', 'flight', 'airline', 'rental car', 'hertz', 'enterprise',
      'motor repair',
    ],
  },
  {
    category: 'Entertainment',
    patterns: [
      'movie', 'cinema', 'theater', 'concert', 'ticket', 'event',
      'steam', 'playstation', 'xbox', 'nintendo', 'game',
      'booking.com', 'airbnb', 'expedia',
    ],
  },
  {
    category: 'Health',
    patterns: [
      'pharmacy', 'cvs', 'walgreens', 'hospital', 'doctor', 'clinic',
      'medical', 'health', 'dental', 'dentistry', 'vision', 'gym', 'fitness',
      'starhealth', 'emerald dentistry',
    ],
  },
  {
    category: 'Travel',
    patterns: [
      'hotel', 'airline', 'flight', 'airbnb', 'booking', 'expedia',
      'travel', 'vacation', 'resort',
    ],
  },
  {
    category: 'Shopping',
    patterns: [
      'amazon', 'ebay', 'etsy', 'shop', 'store', 'retail',
      'best buy', 'home depot', 'lowes', 'ikea', 'nordstrom',
    ],
  },
]

export function categorizeDescription(description: string): Category {
  const d = lower(description)
  for (const { category, patterns } of rules) {
    for (const p of patterns) {
      if (typeof p === 'string' && d.includes(p)) return category
      if (p instanceof RegExp && p.test(d)) return category
    }
  }
  return 'Other'
}
