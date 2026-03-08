import type { Transaction } from './types'
import type { RoomShopMapping } from './types'

const lower = (s: string) => s.toLowerCase()

export interface ExtractedRoomShop {
  type: 'room' | 'shop'
  identifier: string
}

/**
 * Extract SHOP identifiers only from narrations.
 * - Business/UPI handles: e.g. 123DENTISTRYEMERALD (the id before @ in UPI-...-ID@BANK)
 * - Explicit shop names: BRIYANIPALAYAM when seen with "SHOP" (e.g. SHOP BRIYANIPALAYAM, BRIYANIPALAYAM SHOP)
 * No room extraction (was matching "2" everywhere).
 */
export function extractRoomShopFromTransactions(
  transactions: Transaction[]
): ExtractedRoomShop[] {
  const seen = new Map<string, ExtractedRoomShop>()
  const addShop = (id: string) => {
    const key = id.toLowerCase().trim()
    if (key.length < 4) return
    if (!seen.has(key)) seen.set(key, { type: 'shop', identifier: id.trim() })
  }

  for (const t of transactions) {
    const d = t.description

    // UPI/business handle: part immediately before @ (e.g. 123DENTISTRYEMERALD@OKICICI)
    const beforeAt = d.match(/([A-Za-z0-9]{5,})@/g)
    if (beforeAt) {
      for (const m of beforeAt) {
        const id = m.slice(0, -1) // drop the @
        if (/[A-Za-z]/.test(id)) addShop(id)
      }
    }

    // Explicit "SHOP <name>": e.g. SHOP BRIYANIPALAYAM, MAINTENANCE SHOP BRIYANIPALAYAM
    const shopBefore = d.match(/(?:MAINTENANCE\s+)?SHOP\s+([A-Za-z]+)/gi)
    if (shopBefore) {
      for (const m of shopBefore) {
        const cap = m.match(/SHOP\s+([A-Za-z]+)/i)
        if (cap && cap[1].length >= 4) addShop(cap[1])
      }
    }

    // Explicit "<name> SHOP": e.g. BRIYANIPALAYAM SHOP, BRIYANIPALAYAM SHOP REPAIRS
    const shopAfter = d.match(/\b([A-Za-z]{4,})\s+SHOP(?:\s+(?:REPAIRS|MAINTENANCE|SHUTTER))?\b/gi)
    if (shopAfter) {
      for (const m of shopAfter) {
        const cap = m.match(/^([A-Za-z]+)\s+SHOP/i)
        if (cap) addShop(cap[1])
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.identifier.localeCompare(b.identifier)
  )
}

/** Money to/from mother — identified by her name Padmavathi only (excluding maintenance lines) */
export function isMoneyToMother(description: string): boolean {
  const d = lower(description)
  return d.includes('padmavathi') && !d.includes('maintenance')
}

export function isMutualFund(description: string): boolean {
  const d = lower(description)
  return (
    d.includes('mutual fund') ||
    d.includes('sip') ||
    d.includes('mf ') ||
    d.includes('equity') ||
    d.includes('fund house') ||
    d.includes('amc ') ||
    /\bsip\b/.test(d)
  )
}

/** Returns true if description matches this mapping row (by type and identifier). */
export function matchMappingRow(description: string, row: RoomShopMapping): boolean {
  const d = lower(description)
  const id = lower(row.identifier).trim()
  if (!id) return false
  const asWord = id.replace(/\s+/g, ' ')
  switch (row.type) {
    case 'room':
      if (d.includes(`room no ${asWord}`) || d.includes(`room no. ${asWord}`)) return true
      if (d.includes(`room ${asWord}`) && /^\d{2,4}$/.test(id.replace(/\s/g, ''))) return true
      const numPart = id.replace(/\D/g, '')
      if (numPart.length >= 2 && new RegExp(`\\b${numPart}\\s+advance\\b`).test(d)) return true
      return false
    case 'shop':
      if (d.includes(asWord)) return true
      if (d.includes(`shop ${asWord}`) || d.includes(`${asWord} shop`)) return true
      try {
        const wb = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        if (wb.test(d)) return true
      } catch {}
      if (
        (id.includes('briyan') || id.includes('biryan')) &&
        (d.includes('srs foods') || d.includes('s r s foods') || d.includes('shabana parvin r'))
      ) return true
      return false
    case 'home':
    case 'amma':
    case 'maintenance':
      return d.includes(asWord)
    default:
      return d.includes(asWord)
  }
}

/** Match narration to a SHOP mapping only (for backward compat / auto-populate). */
export function matchRoomShop(
  description: string,
  mapping: RoomShopMapping[]
): RoomShopMapping | null {
  return mapping.find((m) => m.type === 'shop' && matchMappingRow(description, m)) ?? null
}

/**
 * Stable key for grouping: same person or account => same key.
 * Used to group all non-shop transactions from the same person/account.
 */
export function getPersonAccountKey(description: string): string {
  const n = description.trim()
  if (!n) return 'other'
  const tptRent = n.match(/TPT-RENT-([^-]+(?:-[^-]+)*)$/i) || n.match(/TPT-[^-]+-([^-]+(?:-[^-]+)*)$/i)
  if (tptRent) return tptRent[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const upi = n.match(/UPI-([A-Za-z0-9\s.]+?)(?:-\d{10,}|@)/)
  if (upi) return upi[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const imps = n.match(/IMPS-\d+-([A-Za-z0-9\s.]+?)(?:-[A-Z]+-|$)/)
  if (imps) return imps[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const neft = n.match(/NEFT (?:CR|DR)-[^-]+-([A-Za-z0-9\s.,]+?)(?:-|$)/)
  if (neft) return neft[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const lastPart = n.split(/[-/]/).map((s) => s.trim()).filter(Boolean).pop()
  if (lastPart && lastPart.length < 50) return lastPart.toLowerCase().trim()
  return n.slice(0, 50).toLowerCase().trim() || 'other'
}

/** Display name for a person/account (for report labels) */
export function getPersonAccountLabel(description: string): string {
  const n = description.trim()
  if (!n) return 'Other'
  const tptRent = n.match(/TPT-RENT-([^-]+(?:-[^-]+)*)$/i) || n.match(/TPT-[^-]+-([^-]+(?:-[^-]+)*)$/i)
  if (tptRent) return tptRent[1].replace(/\s+/g, ' ').trim()
  const upi = n.match(/UPI-([A-Za-z0-9\s.]+?)(?:-\d{10,}|@)/)
  if (upi) return upi[1].replace(/\s+/g, ' ').trim()
  const imps = n.match(/IMPS-\d+-([A-Za-z0-9\s.]+?)(?:-[A-Z]+-|$)/)
  if (imps) return imps[1].replace(/\s+/g, ' ').trim()
  const neft = n.match(/NEFT (?:CR|DR)-[^-]+-([A-Za-z0-9\s.,]+?)(?:-|$)/)
  if (neft) return neft[1].replace(/\s+/g, ' ').trim()
  const lastPart = n.split(/[-/]/).map((s) => s.trim()).filter(Boolean).pop()
  if (lastPart && lastPart.length < 50) return lastPart
  return n.slice(0, 40) + (n.length > 40 ? '…' : '')
}

export interface ReportGroup {
  type: 'amma' | 'mutual_funds' | 'home' | 'room_shop' | 'room' | 'maintenance' | 'by_client' | (string & {})
  label: string
  customerName?: string
  roomShopIdentifier?: string
  roomShopType?: 'room' | 'shop' | 'home'
  transactions: Transaction[]
  total: number
}

const TYPE_ORDER = ['room', 'shop', 'home', 'amma', 'maintenance']

export function buildReport(
  transactions: Transaction[],
  mapping: RoomShopMapping[]
): ReportGroup[] {
  const groups: ReportGroup[] = []
  const assignedIds = new Set<string>()

  // 1. Groups from mapping rows (each row = one group), sorted by type order
  const sortedMapping = [...mapping].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type as (typeof TYPE_ORDER)[number])
    const bi = TYPE_ORDER.indexOf(b.type as (typeof TYPE_ORDER)[number])
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return String(a.type).localeCompare(String(b.type))
  })
  for (const row of sortedMapping) {
    const id = lower(row.identifier).trim()
    if (!id) continue
    const tx = transactions.filter((t) => !assignedIds.has(t.id) && matchMappingRow(t.description, row))
    if (tx.length === 0) continue
    for (const t of tx) assignedIds.add(t.id)
    const total = tx.reduce((s, t) => s + t.amount, 0)
    const label = row.customerName?.trim() || row.identifier
    const reportType = row.type === 'shop' ? 'room_shop' : row.type
    groups.push({
      type: reportType as ReportGroup['type'],
      label: row.type === 'shop' ? row.identifier : label,
      customerName: row.customerName?.trim() ? row.customerName : undefined,
      roomShopIdentifier: row.identifier,
      roomShopType: row.type === 'room' ? 'room' : row.type === 'shop' ? 'shop' : row.type === 'home' ? 'home' : undefined,
      transactions: tx,
      total,
    })
  }

  // 2. Built-in Amma (Padmavathi, excluding maintenance)
  const motherTx = transactions.filter((t) => !assignedIds.has(t.id) && isMoneyToMother(t.description))
  if (motherTx.length > 0) {
    for (const t of motherTx) assignedIds.add(t.id)
    groups.push({
      type: 'amma',
      label: 'Money to/from Mother (Padmavathi)',
      transactions: motherTx,
      total: motherTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  // 3. Mutual funds
  const mfTx = transactions.filter((t) => !assignedIds.has(t.id) && isMutualFund(t.description))
  if (mfTx.length > 0) {
    for (const t of mfTx) assignedIds.add(t.id)
    groups.push({
      type: 'mutual_funds',
      label: 'Mutual Funds',
      transactions: mfTx,
      total: mfTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  // 4. Built-in Home (Neha Mittal, Nealabh Bhatia)
  const homeTx = transactions.filter((t) => {
    if (assignedIds.has(t.id)) return false
    const d = lower(t.description)
    return d.includes('neha mittal') || d.includes('nealabh bhatia')
  })
  if (homeTx.length > 0) {
    for (const t of homeTx) assignedIds.add(t.id)
    groups.push({
      type: 'home',
      label: 'Home',
      customerName: 'Home',
      roomShopType: 'home',
      transactions: homeTx,
      total: homeTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  // 5. By person/account (rest)
  const byClient: Record<string, { tx: Transaction[]; label: string }> = {}
  for (const t of transactions) {
    if (assignedIds.has(t.id)) continue
    const key = getPersonAccountKey(t.description)
    const label = getPersonAccountLabel(t.description)
    if (!byClient[key]) byClient[key] = { tx: [], label }
    byClient[key].tx.push(t)
    if (label.length > byClient[key].label.length) byClient[key].label = label
  }
  const clientEntries = Object.entries(byClient)
    .map(([key, { tx, label }]) => ({
      key,
      label: label || 'Other',
      tx,
      total: tx.reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  for (const { label, tx, total } of clientEntries) {
    groups.push({
      type: 'by_client',
      label,
      customerName: label,
      transactions: tx,
      total,
    })
  }
  return groups
}
