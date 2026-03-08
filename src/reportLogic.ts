import type { Transaction } from './types'
import type { RoomShopMapping } from './types'

const lower = (s: string) => s.toLowerCase()

/** Money to/from mother — identified by her name Padmavathi only (not MUM or Amma) */
export function isMoneyToMother(description: string): boolean {
  const d = lower(description)
  return d.includes('padmavathi')
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

/** Match narration to a room/shop mapping by identifier (e.g. "406", "308", "briyanipalayam") */
export function matchRoomShop(
  description: string,
  mapping: RoomShopMapping[]
): RoomShopMapping | null {
  const d = lower(description)
  for (const m of mapping) {
    const id = lower(m.identifier)
    if (!id) continue
    const asWord = id.replace(/\s+/g, ' ')
    if (d.includes(asWord)) return m
    const roomPrefix = `room ${id}`.trim()
    const shopPrefix = `shop ${id}`.trim()
    if (d.includes(roomPrefix) || d.includes(shopPrefix)) return m
    if (d.includes(`room no ${id}`) || d.includes(`room no. ${id}`)) return m
    const numOnly = id.replace(/\D/g, '')
    if (numOnly && new RegExp(`\\b${numOnly}\\b`).test(d)) return m
  }
  return null
}

/** Extract a short client/person name from narration for "by client" summary */
export function extractClientName(description: string): string {
  const n = description.trim()
  if (!n) return 'Unknown'
  const tptRent = n.match(/TPT-RENT-([^-]+(?:-[^-]+)*)$/i) || n.match(/TPT-[^-]+-([^-]+(?:-[^-]+)*)$/i)
  if (tptRent) return tptRent[1].replace(/\s+/g, ' ').trim()
  const upi = n.match(/UPI-([A-Za-z0-9\s.]+?)(?:-\d|@|$)/)
  if (upi) return upi[1].replace(/\s+/g, ' ').trim()
  const imps = n.match(/IMPS-\d+-([A-Za-z0-9\s.]+?)(?:-|$)/)
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
  const byRoomShop: Record<string, { mapping: RoomShopMapping; tx: Transaction[] }> = {}
  const assignedIds = new Set<string>()
  for (const t of transactions) {
    const m = matchRoomShop(t.description, mapping)
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
      label: `${entry.mapping.type === 'room' ? 'Room' : 'Shop'} ${entry.mapping.identifier}`,
      customerName: entry.mapping.customerName,
      roomShopIdentifier: entry.mapping.identifier,
      roomShopType: entry.mapping.type,
      transactions: entry.tx,
      total,
    })
  }
  const byClient: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (assignedIds.has(t.id)) continue
    const name = extractClientName(t.description)
    const key = name.toLowerCase().replace(/\s+/g, ' ').trim() || 'Other'
    if (!byClient[key]) byClient[key] = []
    byClient[key].push(t)
  }
  const clientEntries = Object.entries(byClient)
    .map(([name, tx]) => ({
      name: name === 'other' ? 'Other' : name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
      tx,
      total: tx.reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  for (const { name, tx, total } of clientEntries) {
    groups.push({
      type: 'by_client',
      label: name,
      customerName: name,
      transactions: tx,
      total,
    })
  }
  return groups
}
