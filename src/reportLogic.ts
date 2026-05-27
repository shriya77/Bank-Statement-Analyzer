import type { Transaction } from './types'
import type { RoomShopMapping } from './types'

const lower = (s: string) => s.toLowerCase()

// Explicit shop identifiers requested by user, filtered to those with at least
// one >= 9,000 deposit in the current statement. BRIYANIPALAYAM includes aliases.
const EXPLICIT_SHOPS = [
  '123dentistryemerald',
  'briyanipalayam',
  'nirmala devi',
  'welldevi1978',
  'nathiya',
  'vishali mahendran',
  'karthikeyan a',
  'advance',
  'saranya',
  'saridha',
  'rental',
] as const

function matchesExplicitShop(d: string, id: string): boolean {
  if (id === 'briyanipalayam') {
    return (
      d.includes('briyanipalayam') ||
      d.includes('biryanipalayam') ||
      d.includes('biryani palayam') ||
      d.includes('srs foods') ||
      d.includes('s r s foods') ||
      d.includes('shabana')
    )
  }
  if (id === 'nirmala devi') return d.includes('nirmala devi') || d.includes('welldevi1978')
  if (id === 'nathiya') return d.includes('nathiya')
  if (id === 'vishali mahendran') return d.includes('vishali mahendran') || d.includes('vishalirm')
  if (id === 'karthikeyan a') return d.includes('karthikeyan  a') || d.includes('karthikeyan a')
  if (id === 'saranya') return d.includes('saranya')
  if (id === 'saridha') return d.includes('saridha') || d.includes('sansarva')
  if (id === 'advance') return d.includes('shop') && d.includes('advance')
  if (id === 'rental') return d.includes('shop') && d.includes('rental')
  return d.includes(id)
}

function getExplicitShopLabel(d: string): string | null {
  const match = EXPLICIT_SHOPS.find((id) => matchesExplicitShop(d, id))
  if (!match) return null
  if (match === 'briyanipalayam') return 'BRIYANIPALAYAM'
  if (match === 'nirmala devi') return 'NIRMALA DEVI'
  if (match === 'welldevi1978') return 'NIRMALA DEVI'
  if (match === 'nathiya') return 'NATHIYA'
  if (match === 'vishali mahendran') return 'VISHALI MAHENDRAN'
  if (match === 'karthikeyan a') return 'KARTHIKEYAN A'
  if (match === 'saranya') return 'SARANYA'
  if (match === 'saridha') return 'SARIDHA'
  if (match === 'advance') return 'ADVANCE'
  if (match === 'rental') return 'RENTAL'
  return match.toUpperCase()
}

export type Bucket =
  | 'amma'
  | 'shop'
  | 'house'
  | 'house_tax'
  | 'ski_towers_maintenance'
  | 'electricity_payment'
  | 'indu'
  | 'mutual_fund_purchase'
  | 'mutual_fund_sell'
  | 'others'
  | 'hdfc'
  | 'bank_interest'
  | 'income_tax'
  | 'advertisement'
  | 'telephone'
  | 'bank_charges'
  | 'room'

/** Amma = transactions mentioning Amma or Padmavathi (maintenance is handled first). */
export function isAmma(description: string): boolean {
  const d = lower(description)
  return d.includes('amma') || d.includes('padmavathi')
}

/** SKI Towers maintenance payments */
export function isSkiTowersMaintenance(description: string): boolean {
  const d = lower(description)
  return d.includes('maintenance')
}

/** House tax payments */
export function isHouseTax(description: string): boolean {
  const d = lower(description)
  return d.includes('payubruhatbengalurum')
}

/** Indu — avoid matching "NIPPON IND" in O-MF lines */
export function isIndu(description: string): boolean {
  const d = lower(description)
  if (d.includes('o-mf')) return false
  if (/nippon\s+ind[-\s]/.test(d)) return false
  return /\bindu\b/.test(d) || d.includes('indu chandrasekar')
}

/** Mutual fund purchases (O-MF in narration) */
export function isMutualFundPurchase(description: string): boolean {
  const d = lower(description)
  return d.includes('o-mf')
}

/** Mutual fund sells/redemptions */
export function isMutualFundSell(description: string): boolean {
  const d = lower(description)
  return d.includes('redemption')
}

/** Electricity board payments */
export function isElectricityPayment(description: string): boolean {
  const d = lower(description)
  return d.includes('techtangedco') || d.includes('electricity')
}

/** Miscellaneous transactions that should not be counted as rooms. */
export function isOthers(description: string): boolean {
  const d = lower(description)
  return (
    d.includes('online') ||
    d.includes('arunava chatterjee') ||
    d.includes('nithiyanantham ganesh') ||
    d.includes('billdkflyscoot') ||
    d.includes('billdkcommissionerat') ||
    d.includes('tata motors ltd ordi div24 25') ||
    d.includes('ramraj cotton') ||
    d.includes('avenue supermart') ||
    d.includes('rajdhani phoenix') ||
    d.includes('life style') ||
    d.includes('adhoc') ||
    d.includes('chef bakers broo') ||
    d.includes('pazhamudir nilay') ||
    d.includes('imperial restaur') ||
    d.includes('sonata software') ||
    d.includes('trident limited') ||
    d.includes('confidence petroleum') ||
    (d.includes('tax') && d.includes('refund')) ||
    d.includes('itdtax refund')
  )
}

/** HDFC securities transfers */
export function isHdfc(description: string): boolean {
  const d = lower(description)
  return (
    d.includes('a2aint01-717834914-hdfc securities ltd-client dscnb a/c') ||
    (d.includes('hdfc securities') && d.includes('client dscnb'))
  )
}

/** Interest credits */
export function isInterest(description: string): boolean {
  const d = lower(description)
  return d.includes('interest')
}

/** Income tax deductions */
export function isIncomeTax(description: string): boolean {
  const d = lower(description)
  return d.includes('tax deducted')
}

/** Advertisement payments */
export function isAdvertisement(description: string): boolean {
  const d = lower(description)
  return d.includes('payuolxindiaprivatel')
}

/** Telephone/mobile payments */
export function isTelephone(description: string): boolean {
  const d = lower(description)
  return d.includes('payubhartiairtelimi') || d.includes('airtel')
}

/** Bank/depository charges */
export function isBankCharges(description: string): boolean {
  const d = lower(description)
  return d.includes('depository charges')
}

/** Known room tenants that should always stay under Rooms. */
export function isKnownRoomTenant(description: string): boolean {
  const d = lower(description)
  return (
    d.includes('stephen raj b') ||
    d.includes('siddappa senthil raj') ||
    d.includes('sathya s') ||
    d.includes('gobinath k') ||
    d.includes('saigopal182') ||
    d.includes('sunilkaringali') ||
    d.includes('arun99theboss') ||
    d.includes('nithishramachandran05') ||
    d.includes('saianbupolice') ||
    d.includes('rajaramvarma003')
  )
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
  if (getExplicitShopLabel(d)) return true
  // Anything with "shop" in the narration belongs to Shops, including TEA SHOP and TEASHOP.
  if (/\b[a-z0-9]*shop[a-z0-9]*\b/i.test(description)) return true
  if (/(?:MAINTENANCE\s+)?SHOP\s+[A-Za-z]+/i.test(description)) return true
  if (/\b[A-Za-z]{4,}\s+SHOP\b/i.test(description)) return true
  if (
    d.includes('srs foods') ||
    d.includes('s r s foods') ||
    d.includes('shabana parvin r') ||
    d.includes('briyanipalayam') ||
    d.includes('biryanipalayam') ||
    d.includes('biryani palayam')
  ) return true
  const beforeAt = description.match(/([A-Za-z0-9]{5,})@/g)
  if (beforeAt) {
    for (const m of beforeAt) {
      const id = m.slice(0, -1).toLowerCase()
      if (/[a-z]/.test(id) && (id.includes('dentistry') || id.includes('shop')))
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
  const explicitLabel = getExplicitShopLabel(d)
  if (explicitLabel) return explicitLabel
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
  if (isHouseTax(description)) return 'house_tax'
  if (isSkiTowersMaintenance(description)) return 'ski_towers_maintenance'
  if (isAmma(description)) return 'amma'
  if (isElectricityPayment(description)) return 'electricity_payment'
  if (isMutualFundSell(description)) return 'mutual_fund_sell'
  if (isMutualFundPurchase(description)) return 'mutual_fund_purchase'
  if (isHdfc(description)) return 'hdfc'
  if (isInterest(description)) return 'bank_interest'
  if (isIncomeTax(description)) return 'income_tax'
  if (isAdvertisement(description)) return 'advertisement'
  if (isTelephone(description)) return 'telephone'
  if (isBankCharges(description)) return 'bank_charges'
  if (isOthers(description)) return 'others'
  if (isKnownRoomTenant(description)) return 'room'
  if (isShop(description, mapping)) return 'shop'
  if (isHouse(description, mapping)) return 'house'
  if (isIndu(description)) return 'indu'
  return 'room'
}

export function getPersonAccountKey(description: string): string {
  const n = description.trim()
  if (!n) return 'other'
  const tptRent = n.match(/TPT-RENT-([^-]+(?:-[^-]+)*)$/i) || n.match(/TPT-[^-]+-([^-]+(?:-[^-]+)*)$/i)
  if (tptRent) return tptRent[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const upiName = n.match(/UPI-([^-@]+)-/)
  if (upiName) return upiName[1].replace(/\s+/g, ' ').trim().toLowerCase()
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
  type:
    | 'amma'
    | 'shop'
    | 'house'
    | 'house_tax'
    | 'ski_towers_maintenance'
    | 'electricity_payment'
    | 'indu'
    | 'mutual_fund_purchase'
    | 'mutual_fund_sell'
    | 'others'
    | 'hdfc'
    | 'bank_interest'
    | 'income_tax'
    | 'advertisement'
    | 'telephone'
    | 'bank_charges'
    | 'room'
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

  const houseTaxTx = transactions.filter((t) => isHouseTax(t.description))
  if (houseTaxTx.length > 0) {
    houseTaxTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'house_tax',
      label: 'House Tax',
      transactions: houseTaxTx,
      total: houseTaxTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const maintenanceTx = transactions.filter((t) => isSkiTowersMaintenance(t.description))
  if (maintenanceTx.length > 0) {
    maintenanceTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'ski_towers_maintenance',
      label: 'SKI Towers Maintenance',
      transactions: maintenanceTx,
      total: maintenanceTx.reduce((s, t) => s + t.amount, 0),
    })
  }

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

  const electricityTx = transactions.filter((t) => !assigned.has(t.id) && isElectricityPayment(t.description))
  if (electricityTx.length > 0) {
    electricityTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'electricity_payment',
      label: 'Electricity Payment',
      transactions: electricityTx,
      total: electricityTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const mfSellTx = transactions.filter((t) => !assigned.has(t.id) && isMutualFundSell(t.description))
  if (mfSellTx.length > 0) {
    mfSellTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'mutual_fund_sell',
      label: 'Mutual Fund Sell',
      transactions: mfSellTx,
      total: mfSellTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const shopBuckets: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (assigned.has(t.id)) continue
    if (isKnownRoomTenant(t.description)) continue
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

  const induTx = transactions.filter((t) => !assigned.has(t.id) && isIndu(t.description))
  if (induTx.length > 0) {
    induTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'indu',
      label: 'Indu',
      transactions: induTx,
      total: induTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const mfTx = transactions.filter((t) => !assigned.has(t.id) && isMutualFundPurchase(t.description))
  if (mfTx.length > 0) {
    mfTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'mutual_fund_purchase',
      label: 'Mutual Fund Purchase (O-MF)',
      transactions: mfTx,
      total: mfTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const hdfcTx = transactions.filter((t) => !assigned.has(t.id) && isHdfc(t.description))
  if (hdfcTx.length > 0) {
    hdfcTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'hdfc',
      label: 'HDFC',
      transactions: hdfcTx,
      total: hdfcTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const interestTx = transactions.filter((t) => !assigned.has(t.id) && isInterest(t.description))
  if (interestTx.length > 0) {
    interestTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'bank_interest',
      label: 'Interest',
      transactions: interestTx,
      total: interestTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const incomeTaxTx = transactions.filter((t) => !assigned.has(t.id) && isIncomeTax(t.description))
  if (incomeTaxTx.length > 0) {
    incomeTaxTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'income_tax',
      label: 'Income Tax',
      transactions: incomeTaxTx,
      total: incomeTaxTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const advertisementTx = transactions.filter((t) => !assigned.has(t.id) && isAdvertisement(t.description))
  if (advertisementTx.length > 0) {
    advertisementTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'advertisement',
      label: 'Advertisement',
      transactions: advertisementTx,
      total: advertisementTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const telephoneTx = transactions.filter((t) => !assigned.has(t.id) && isTelephone(t.description))
  if (telephoneTx.length > 0) {
    telephoneTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'telephone',
      label: 'Telephone',
      transactions: telephoneTx,
      total: telephoneTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const bankChargesTx = transactions.filter((t) => !assigned.has(t.id) && isBankCharges(t.description))
  if (bankChargesTx.length > 0) {
    bankChargesTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'bank_charges',
      label: 'Bank Charges',
      transactions: bankChargesTx,
      total: bankChargesTx.reduce((s, t) => s + t.amount, 0),
    })
  }

  const othersTx = transactions.filter((t) => !assigned.has(t.id) && isOthers(t.description))
  if (othersTx.length > 0) {
    othersTx.forEach((t) => assigned.add(t.id))
    groups.push({
      type: 'others',
      label: 'Others',
      transactions: othersTx,
      total: othersTx.reduce((s, t) => s + t.amount, 0),
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
