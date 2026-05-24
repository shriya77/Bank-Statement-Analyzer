import type { Transaction } from './types'
import type { RoomShopMapping } from './types'

const lower = (s: string) => s.toLowerCase()

export type Bucket = 'amma' | 'shop' | 'house' | 'room'

/** Amma = Padmavathi only (not maintenance transfers) */
export function isAmma(description: string): boolean {
  const d = lower(description)
  return d.includes('padmavathi') && !d.includes('maintenance')
}

export function isHouse(description: string, mapping: RoomShopMapping[]): boolean {
  const d = lower(description)
  if (d.includes('neha mittal') || d.includes('nealabh bhatia')) return true
  return mapping.some((m) => m.type === 'house' && m.identifier.trim() && d.includes(lower(m.identifier)))
}

export function isShop(description: string, mapping: RoomShopMapping[]): boolean {
  const d = lower(description)
  for (const m of mapping) {
    if (m.type !== 'shop' || !m.identifier.trim()) continue
    if (matchShopIdentifier(d, lower(m.identifier))) return true
  }
  if (d.includes(' shop ') || /\bshop\s+[a-z]/i.test(description)) return true
  if (/(?:MAINTENANCE\s+)?SHOP\s+[A-Za-z]+/i.test(description)) return true
  if (/\b[A-Za-z]{4,}\s+SHOP\b/i.test(description)) return true
  if (
    d.includes('srs foods') ||
    d.includes('s r s foods') ||
    d.includes('shabana parvin r') ||
    d.includes('briyanipalayam') ||
    d.includes('biryanipalayam')
  ) return true
  const beforeAt = description.match(/([A-Za-z0-9]{5,})@/g)
  if (beforeAt) {
    for (const m of beforeAt) {
      const id = m.slice(0, -1).toLowerCase()
      if (/[a-z]/.test(id) && (id.includes('dentistry') || id.includes('shop') || id.length >= 10))
        return true
    }
  }
  return false
}

function matchShopIdentifier(d: string, id: string): boolean {
  const asWord = id.replace(/\s+/g, ' ')
  if (d.includes(asWord)) return true
  if (d.includes(`shop ${asWord}`) || d.includes(`${asWord} shop`)) return true
  if (
    (id.includes('briyan') || id.includes('biryan')) &&
    (d.includes('srs foods') || d.includes('s r s foods') || d.includes('shabana parvin r'))
  )
    return true
  return false
}

/** Shop label for grouping (one row per shop in report) */
export function getShopGroupKey(description: string, mapping: RoomShopMapping[]): string {
  const d = lower(description)
  for (const m of mapping) {
    if (m.type === 'shop' && m.identifier.trim() && matchShopIdentifier(d, lower(m.identifier)))
      return m.customerName?.trim() || m.identifier
  }
  if (d.includes('briyanipalayam') || d.includes('biryanipalayam') || d.includes('srs foods') || d.includes('shabana parvin r'))
    return 'BRIYANIPALAYAM'
  const shopBefore = description.match(/(?:MAINTENANCE\s+)?SHOP\s+([A-Za-z]+)/i)
  if (shopBefore) return shopBefore[1]
  const shopAfter = description.match(/\b([A-Za-z]{4,})\s+SHOP/i)
  if (shopAfter) return shopAfter[1]
  const upiId = description.match(/-([A-Za-z0-9]{5,})@/)
  if (upiId) return upiId[1]
  return 'Shop (other)'
}

export function classifyBucket(
  description: string,
  mapping: RoomShopMapping[]
): Bucket {
  if (isAmma(description)) return 'amma'
  if (isShop(description, mapping)) return 'shop'
  if (isHouse(description, mapping)) return 'house'
  return 'room'
}

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

export function getPersonAccountLabel(description: string): string {
  const key = getPersonAccountKey(description)
  if (key === 'other') return 'Other'
  return key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface ReportGroup {
  type: 'amma' | 'shop' | 'house' | 'room'
  label: string
  transactions: Transaction[]
  total: number
}

export function buildReport(
  transactions: Transaction[],
  mapping: RoomShopMapping[]
): ReportGroup[] {
  const groups: ReportGroup[] = []
  const assigned = new Set<string>()

  const ammaTx = transactions.filter((t) => isAmma(t.description))
  if (ammaTx.length > 0) {
    ammaTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'amma',
      label: 'Amma (Padmavathi)',
      transactions: ammaTx,
      total: ammaTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const shopBuckets: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (assigned.has(t.id)) continue
    if (!isShop(t.description, mapping)) continue
    const key = getShopGroupKey(t.description, mapping)
    if (!shopBuckets[key]) shopBuckets[key] = []
    shopBuckets[key].push(t)
    assigned.add(t.id)
  }
  for (const [label, tx] of Object.entries(shopBuckets).sort((a, b) => a[0].localeCompare(b[0]))) {
    groups.push({
      type: 'shop',
      label,
      transactions: tx,
      total: tx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const houseTx = transactions.filter((t) => !assigned.has(t.id) && isHouse(t.description, mapping))
  if (houseTx.length > 0) {
    houseTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'house',
      label: 'House',
      transactions: houseTx,
      total: houseTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const roomByKey: Record<string, { label: string; tx: Transaction[] }> = {}
  for (const t of transactions) {
    if (assigned.has(t.id)) continue
    const key = getPersonAccountKey(t.description)
    const label = getPersonAccountLabel(t.description)
    if (!roomByKey[key]) roomByKey[key] = { label, tx: [] }
    roomByKey[key].tx.push(t)
  }
  const roomEntries = Object.entries(roomByKey).sort(
    (a, b) => Math.abs(b[1].tx.reduce((s, t) => s + t.amount, 0)) -
      Math.abs(a[1].tx.reduce((s, t) => s + t.amount, 0))
  )
  for (const [, { label, tx }] of roomEntries) {
    groups.push({
      type: 'room',
      label,
      transactions: tx,
      total: tx.reduce((s, t) => s + t.amount, 0),
    })
  }

  return groups
}

/** For auto-populate mapping table: shop identifiers only */
export function extractRoomShopFromTransactions(transactions: Transaction[]): {
  type: 'shop'
  identifier: string
}[] {
  const seen = new Set<string>()
  const out: { type: 'shop'; identifier: string }[] = []
  const add = (id: string) => {
    const k = id.toLowerCase()
    if (k.length < 4 || seen.has(k)) return
    seen.add(k)
    out.push({ type: 'shop', identifier: id.trim() })
  }
  for (const t of transactions) {
    if (!isShop(t.description, [])) continue
    add(getShopGroupKey(t.description, []))
  }
  return out.sort((a, b) => a.identifier.localeCompare(b.identifier))
}
