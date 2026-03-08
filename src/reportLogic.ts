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

/** Money to/from mother — identified by her name Padmavathi only */
export function isMoneyToMother(description: string): boolean {
  return lower(description).includes('padmavathi')
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

/**
 * Match narration to a SHOP mapping only by strict identifier.
 * - No loose digit matching (so "2" never matches every line with 2 in it).
 * - Shop: identifier must appear as whole word or in "SHOP <id>" / "<id> SHOP".
 */
export function matchRoomShop(
  description: string,
  mapping: RoomShopMapping[]
): RoomShopMapping | null {
  const d = lower(description)
  for (const m of mapping) {
    const id = lower(m.identifier).trim()
    if (!id) continue
    if (m.type === 'shop') {
      const asWord = id.replace(/\s+/g, ' ')
      if (d.includes(asWord)) return m
      if (d.includes(`shop ${asWord}`) || d.includes(`${asWord} shop`)) return m
      const wordBoundary = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (wordBoundary.test(d)) return m
    }
  }
  return null
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
  type: 'amma' | 'mutual_funds' | 'room_shop' | 'by_client'
  label: string
  customerName?: string
  roomShopIdentifier?: string
  roomShopType?: 'room' | 'shop'
  transactions: Transaction[]
  total: number
}

export function buildReport(
  transactions: Transaction[],
  mapping: RoomShopMapping[]
): ReportGroup[] {
  const groups: ReportGroup[] = []

  const motherTx = transactions.filter((t) => isMoneyToMother(t.description))
  if (motherTx.length > 0) {
    groups.push({
      type: 'amma',
      label: 'Money to/from Mother (Padmavathi)',
      transactions: motherTx,
      total: motherTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const mfTx = transactions.filter((t) => isMutualFund(t.description))
  if (mfTx.length > 0) {
    groups.push({
      type: 'mutual_funds',
      label: 'Mutual Funds',
      transactions: mfTx,
      total: mfTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  // Only shop mappings (no room) — strict match only
  const shopMapping = mapping.filter((m) => m.type === 'shop')
  const byRoomShop: Record<string, { mapping: RoomShopMapping; tx: Transaction[] }> = {}
  const assignedIds = new Set<string>()
  for (const t of transactions) {
    const m = matchRoomShop(t.description, shopMapping)
    if (m) {
      const key = m.id
      if (!byRoomShop[key]) byRoomShop[key] = { mapping: m, tx: [] }
      byRoomShop[key].tx.push(t)
      assignedIds.add(t.id)
    }
  }
  for (const entry of Object.values(byRoomShop)) {
    const total = entry.tx.reduce((s, t) => s + t.amount, 0)
    groups.push({
      type: 'room_shop',
      label: entry.mapping.identifier,
      customerName: entry.mapping.customerName,
      roomShopIdentifier: entry.mapping.identifier,
      roomShopType: 'shop',
      transactions: entry.tx,
      total,
    })
  }

  // Non-shop transactions grouped by same person/account (stable key)
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
