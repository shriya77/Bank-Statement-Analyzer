import Papa from 'papaparse'
import { categorizeDescription } from './categorize'
import type { Transaction } from './types'

const commonDateKeys = ['date', 'transaction date', 'posting date', 'trans date', 'posted']
const commonDescKeys = ['description', 'memo', 'details', 'narration', 'payee', 'name', 'merchant']
const commonAmountKeys = ['amount', 'debit', 'credit', 'transaction amount', 'value']
const debitColumnKeys = ['debit', 'withdrawal amt.', 'withdrawal amt', 'withdrawal']
const creditColumnKeys = ['credit', 'deposit amt.', 'deposit amt', 'deposit']

function findColumn(row: Record<string, string>, keys: string[]): string | null {
  const keyList = Object.keys(row)
  const lower = keyList.map((k) => k.toLowerCase())
  for (const key of keys) {
    const exact = lower.indexOf(key.toLowerCase())
    if (exact !== -1) return keyList[exact]
    const partial = lower.findIndex((k) => k.includes(key.toLowerCase()))
    if (partial !== -1) return keyList[partial]
  }
  return null
}

function parseAmount(value: string): number {
  const cleaned = String(value).replace(/[$,]/g, '').trim()
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return 0
  return num
}

function isCreditRow(row: Record<string, string>, amountKey: string): boolean {
  const raw = (row[amountKey] ?? '').trim()
  return raw.startsWith('+') || raw.includes('CR') || raw.includes('credit')
}

function findHeaderRow(csvText: string): string {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const headerLine = lines.find((line) => {
    const lower = line.toLowerCase()
    return lower.includes('date') && (lower.includes('narration') || lower.includes('description') || lower.includes('memo'))
  })
  if (headerLine != null) {
    const idx = lines.indexOf(headerLine)
    return lines.slice(idx).join('\n')
  }
  return csvText
}

export function parseBankCsv(csvText: string): Transaction[] {
  const normalized = findHeaderRow(csvText)
  const parsed = Papa.parse<Record<string, string>>(normalized, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors.map((e) => e.message).join('; '))
  }

  const rows = parsed.data
  if (!rows.length) return []

  const first = rows[0]
  const dateKey = findColumn(first, commonDateKeys)
  const descKey = findColumn(first, commonDescKeys)
  const amountKey = findColumn(first, commonAmountKeys)

  if (!dateKey || !descKey) {
    throw new Error(
      'Could not find date or description column. Expected headers like: Date, Description, Amount (or Debit/Credit).'
    )
  }

  const debitKey = findColumn(first, debitColumnKeys)
  const creditKey = findColumn(first, creditColumnKeys)
  const hasSeparateDebitCredit = !!debitKey && !!creditKey
  const amountColumn = amountKey ?? (hasSeparateDebitCredit ? null : findColumn(first, ['debit', 'credit']))

  const transactions: Transaction[] = []
  const seen = new Set<string>()

  const looksLikeDate = (s: string) => /[\d/.-]/.test(s) && !/^\*+$/.test(s.trim())

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const date = (row[dateKey] ?? '').trim()
    const description = (row[descKey] ?? '').trim()
    if (!description || !date || !looksLikeDate(date)) continue

    let amount = 0
    if (hasSeparateDebitCredit && debitKey && creditKey) {
      const debit = parseAmount(row[debitKey] ?? '0')
      const credit = parseAmount(row[creditKey] ?? '0')
      amount = credit - debit
    } else if (amountColumn) {
      amount = parseAmount(row[amountColumn] ?? '0')
      if (!isCreditRow(row, amountColumn)) amount = -Math.abs(amount)
    }

    const id = `${date}-${description}-${amount}-${i}`
    if (seen.has(id)) continue
    seen.add(id)

    transactions.push({
      id,
      date,
      description,
      amount,
      category: categorizeDescription(description),
      raw: row,
    })
  }

  return transactions.sort((a, b) => {
    const dA = new Date(a.date).getTime()
    const dB = new Date(b.date).getTime()
    return isNaN(dA) ? 1 : isNaN(dB) ? -1 : dB - dA
  })
}
