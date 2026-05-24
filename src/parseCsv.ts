import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { categorizeDescription } from './categorize'
import type { Transaction } from './types'

const commonDateKeys = ['date', 'transaction date', 'posting date', 'trans date', 'posted', 'value dt']
const commonDescKeys = ['description', 'memo', 'details', 'narration', 'payee', 'name', 'merchant']
const commonAmountKeys = ['amount', 'debit', 'credit', 'transaction amount', 'value']
const debitColumnKeys = ['debit', 'withdrawal amt.', 'withdrawal amt', 'withdrawal']
const creditColumnKeys = ['credit', 'deposit amt.', 'deposit amt', 'deposit']

function cellString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  return String(value).trim()
}

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

function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map((c) => cellString(c).toLowerCase()).join('|')
    if (
      lower.includes('date') &&
      (lower.includes('narration') || lower.includes('description') || lower.includes('memo'))
    ) {
      return i
    }
  }
  return -1
}

function rowsFromSheetArrays(data: string[][]): Record<string, string>[] {
  const headerIdx = findHeaderRowIndex(data)
  if (headerIdx === -1) {
    throw new Error(
      'Could not find transaction table. Expected a header row with Date and Narration (or Description).'
    )
  }
  const headers = data[headerIdx].map((h) => cellString(h))
  const out: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < data.length; i++) {
    const arr = data[i]
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      if (h) row[h] = cellString(arr[j])
    })
    if (Object.values(row).some((v) => v)) out.push(row)
  }
  return out
}

export function parseTransactionRows(rows: Record<string, string>[]): Transaction[] {
  if (!rows.length) return []

  const first = rows[0]
  const dateKey = findColumn(first, commonDateKeys)
  const descKey = findColumn(first, commonDescKeys)
  const amountKey = findColumn(first, commonAmountKeys)

  if (!dateKey || !descKey) {
    throw new Error(
      'Could not find date or description column. Expected headers like: Date, Narration, Withdrawal/Deposit.'
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

function findHeaderRowCsv(csvText: string): string {
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
  const normalized = findHeaderRowCsv(csvText)
  const parsed = Papa.parse<Record<string, string>>(normalized, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors.map((e) => e.message).join('; '))
  }

  return parseTransactionRows(parsed.data)
}

export function parseBankExcel(buffer: ArrayBuffer): Transaction[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Excel file has no sheets.')
  const sheet = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
  const stringRows = data.map((row) => (Array.isArray(row) ? row.map(cellString) : []))
  const records = rowsFromSheetArrays(stringRows)
  return parseTransactionRows(records)
}

const STATEMENT_EXT = /\.(csv|xls|xlsx)$/i

export function isStatementFile(file: File): boolean {
  return STATEMENT_EXT.test(file.name)
}

export async function parseBankFile(file: File): Promise<Transaction[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer()
    return parseBankExcel(buffer)
  }
  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseBankCsv(text)
  }
  throw new Error('Unsupported file type. Use CSV, XLS, or XLSX.')
}
