import { supabase } from './supabase'
import {
  defaultClientDatabase,
  mergeWithDefaults,
  type RoomShopMapping,
  type Transaction,
} from './types'

export type SavedStatement = {
  id: string
  name: string
  savedAt: string
  transactionCount: number
  transactions: Transaction[]
}

type ClientDatabaseRow = {
  id: string
  data: unknown
  updated_at?: string
}

type SavedStatementRow = {
  id: string
  name: string
  uploaded_at: string
  transactions: unknown
}

function isClientDatabase(value: unknown): value is RoomShopMapping[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        'unitName' in row &&
        'clients' in row &&
        Array.isArray((row as RoomShopMapping).clients)
    )
  )
}

function parseMapping(data: unknown): RoomShopMapping[] | null {
  if (!isClientDatabase(data)) return null
  if (data.length === 0) return null
  return mergeWithDefaults(data)
}

function rowToSavedStatement(row: SavedStatementRow): SavedStatement {
  const transactions = Array.isArray(row.transactions)
    ? (row.transactions as Transaction[])
    : []
  return {
    id: row.id,
    name: row.name,
    savedAt: row.uploaded_at,
    transactionCount: transactions.length,
    transactions,
  }
}

function savedStatementToRow(entry: SavedStatement) {
  return {
    id: entry.id,
    name: entry.name,
    uploaded_at: entry.savedAt,
    transactions: entry.transactions,
  }
}

/** Returns null when the cloud row is empty/unseeded. */
export async function fetchClientDatabase(): Promise<RoomShopMapping[] | null> {
  const { data, error } = await supabase
    .from('client_database')
    .select('id, data')
    .eq('id', 'default')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return parseMapping((data as ClientDatabaseRow).data)
}

export async function saveClientDatabase(mapping: RoomShopMapping[]): Promise<void> {
  const { error } = await supabase.from('client_database').upsert({
    id: 'default',
    data: mapping,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function fetchSavedStatements(): Promise<SavedStatement[]> {
  const { data, error } = await supabase
    .from('saved_statements')
    .select('id, name, uploaded_at, transactions')
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data as SavedStatementRow[] | null) ?? []).map(rowToSavedStatement)
}

export async function syncSavedStatements(list: SavedStatement[]): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('saved_statements')
    .select('id')

  if (readError) throw new Error(readError.message)

  const existingIds = new Set(
    ((existing as { id: string }[] | null) ?? []).map((row) => row.id)
  )
  const nextIds = new Set(list.map((entry) => entry.id))
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await supabase.from('saved_statements').delete().in('id', toDelete)
    if (error) throw new Error(error.message)
  }

  if (list.length > 0) {
    const { error } = await supabase
      .from('saved_statements')
      .upsert(list.map(savedStatementToRow))
    if (error) throw new Error(error.message)
  }
}

export async function seedClientDatabaseIfEmpty(
  fallback: RoomShopMapping[]
): Promise<RoomShopMapping[]> {
  const remote = await fetchClientDatabase()
  if (remote) return remote
  const seed = fallback.length > 0 ? fallback : defaultClientDatabase()
  await saveClientDatabase(seed)
  return seed
}
