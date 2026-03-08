import { useCallback, useEffect, useState } from 'react'
import { parseBankCsv } from './parseCsv'
import type { Transaction } from './types'
import type { RoomShopMapping } from './types'
import {
  loadMappingFromStorage,
  saveMappingToStorage,
  loadCustomTypesFromStorage,
  saveCustomTypesToStorage,
  BUILTIN_MAPPING_TYPES,
  CATEGORY_COLORS,
} from './types'
import { buildReport, extractRoomShopFromTransactions } from './reportLogic'
import './App.css'

function formatAmount(amount: number): string {
  const n = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
  return amount >= 0 ? `+${n.format(amount)}` : n.format(amount)
}

function CategoryPill({ category }: { category: Transaction['category'] }) {
  const color = CATEGORY_COLORS[category]
  return (
    <span
      className="category-pill"
      style={{ '--pill-color': color } as React.CSSProperties}
    >
      {category}
    </span>
  )
}

function UploadZone({
  onFile,
  isDragging,
  onDragState,
}: {
  onFile: (file: File) => void
  isDragging: boolean
  onDragState: (d: boolean) => void
}) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDragState(false)
      const file = e.dataTransfer.files[0]
      if (file?.name.toLowerCase().endsWith('.csv')) onFile(file)
    },
    [onFile, onDragState]
  )
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    onDragState(true)
  }, [onDragState])
  const handleDragLeave = useCallback(() => {
    onDragState(false)
  }, [onDragState])
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
      e.target.value = ''
    },
    [onFile]
  )

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleInput}
        id="csv-upload"
        className="upload-input"
      />
      <label htmlFor="csv-upload" className="upload-label">
        <span className="upload-icon">📄</span>
        <span>Drop your bank statement CSV here or click to browse</span>
      </label>
    </div>
  )
}

type TabId = 'upload' | 'mapping' | 'report'

function MappingTable({
  mapping,
  setMapping,
  transactions,
}: {
  mapping: RoomShopMapping[]
  setMapping: React.Dispatch<React.SetStateAction<RoomShopMapping[]>>
  transactions: Transaction[]
}) {
  const [customTypes, setCustomTypes] = useState<string[]>(() => loadCustomTypesFromStorage())
  const [newCustomType, setNewCustomType] = useState('')

  useEffect(() => {
    saveCustomTypesToStorage(customTypes)
  }, [customTypes])

  const addRow = useCallback(() => {
    setMapping((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'shop' as const,
        identifier: '',
        customerName: '',
      },
    ])
  }, [setMapping])

  const addCustomType = useCallback(() => {
    const v = newCustomType.trim().toLowerCase()
    if (!v || customTypes.includes(v)) return
    setCustomTypes((prev) => [...prev, v])
    setNewCustomType('')
  }, [newCustomType, customTypes])

  const autoPopulate = useCallback(() => {
    const extracted = extractRoomShopFromTransactions(transactions)
    const existingKeys = new Set(
      mapping.map((m) => `${m.type}:${m.identifier.toLowerCase().trim()}`)
    )
    const toAdd = extracted.filter(
      (e) => !existingKeys.has(`${e.type}:${e.identifier.toLowerCase().trim()}`)
    )
    if (toAdd.length === 0) return
    setMapping((prev) => [
      ...prev,
      ...toAdd.map((e) => ({
        id: crypto.randomUUID(),
        type: e.type,
        identifier: e.identifier,
        customerName: '',
      })),
    ])
  }, [transactions, mapping, setMapping])

  const updateRow = useCallback(
    (id: string, patch: Partial<RoomShopMapping>) => {
      setMapping((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      )
    },
    [setMapping]
  )
  const removeRow = useCallback(
    (id: string) => setMapping((prev) => prev.filter((r) => r.id !== id)),
    [setMapping]
  )
  useEffect(() => {
    saveMappingToStorage(mapping)
  }, [mapping])

  return (
    <section className="mapping-section">
      <h2>Mapping (Room / Shop / Home / Amma / Maintenance)</h2>
      <p className="mapping-hint">
        Choose type, set identifier (as it appears in the statement), and optional customer name. Auto-populate adds shops from the CSV. Add custom types below if needed.
      </p>
      {transactions.length > 0 && (
        <button
          type="button"
          className="btn-secondary"
          onClick={autoPopulate}
        >
          Auto-populate shops from statement
        </button>
      )}
      <div className="table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Identifier</th>
              <th>Customer name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((row) => (
              <tr key={row.id}>
                <td>
                  <select
                    value={row.type}
                    onChange={(e) =>
                      updateRow(row.id, {
                        type: e.target.value as RoomShopMapping['type'],
                      })
                    }
                  >
                    {BUILTIN_MAPPING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                    {customTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.identifier}
                    onChange={(e) =>
                      updateRow(row.id, { identifier: e.target.value.trim() })
                    }
                    placeholder="e.g. 123DENTISTRYEMERALD, BRIYANIPALAYAM, NEHA MITTAL"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.customerName}
                    onChange={(e) =>
                      updateRow(row.id, { customerName: e.target.value.trim() })
                    }
                    placeholder="Customer / tenant name"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove row"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mapping-actions">
        <button type="button" className="btn-primary" onClick={addRow}>
          + Add row
        </button>
        <div className="add-custom-type">
          <input
            type="text"
            value={newCustomType}
            onChange={(e) => setNewCustomType(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomType()}
            placeholder="Custom type name"
            className="custom-type-input"
          />
          <button type="button" className="btn-secondary" onClick={addCustomType}>
            Add custom type
          </button>
        </div>
      </div>
    </section>
  )
}

function ReportView({
  transactions,
  mapping,
}: {
  transactions: Transaction[]
  mapping: RoomShopMapping[]
}) {
  const groups = buildReport(transactions, mapping)
  const displayGroups = groups

  const downloadReport = useCallback(() => {
    const rows: string[][] = [['Client', 'Credit', 'Debit']]
    for (const g of displayGroups) {
      const credit = g.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const debit = g.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      const label = g.customerName?.trim() ? `${g.label} (${g.customerName})` : g.label
      rows.push([
        label,
        credit.toFixed(2),
        debit.toFixed(2),
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [displayGroups])

  return (
    <section className="report-section">
      <h2>Summary report</h2>
      <p className="report-hint">
        Shops (strict match), Mother (Padmavathi), Mutual funds, then all other
        transactions grouped by person/account.
      </p>
      <button type="button" className="btn-primary download-report-btn" onClick={downloadReport}>
        Download report (CSV)
      </button>
      <div className="report-groups">
        {displayGroups.map((group, idx) => (
          <div key={`${group.type}-${group.label}-${idx}`} className="report-group">
            <div className="report-group-header">
              <span className="report-group-title">{group.label}</span>
              {group.customerName != null && (
                <span className="report-group-customer">{group.customerName}</span>
              )}
              <span
                className={`report-group-total ${group.total >= 0 ? 'positive' : 'negative'}`}
              >
                {formatAmount(group.total)}
              </span>
            </div>
            <div className="table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th className="amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {group.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="date">{tx.date}</td>
                      <td className="description">{tx.description}</td>
                      <td
                        className={`amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}
                      >
                        {formatAmount(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('upload')
  const [mapping, setMapping] = useState<RoomShopMapping[]>(() =>
    loadMappingFromStorage()
  )

  // Auto-populate room/shop mapping from statement when CSV is loaded
  useEffect(() => {
    if (transactions.length === 0) return
    const extracted = extractRoomShopFromTransactions(transactions)
    setMapping((prev) => {
      const existingKeys = new Set(
        prev.map((m) => `${m.type}:${m.identifier.toLowerCase().trim()}`)
      )
      const toAdd = extracted.filter(
        (e) => !existingKeys.has(`${e.type}:${e.identifier.toLowerCase().trim()}`)
      )
      if (toAdd.length === 0) return prev
      return [
        ...prev,
        ...toAdd.map((e) => ({
          id: crypto.randomUUID(),
          type: e.type,
          identifier: e.identifier,
          customerName: '',
        })),
      ]
    })
  }, [transactions])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseBankCsv(text)
      setTransactions(parsed)
      setSelectedCategory(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV')
      setTransactions([])
    }
  }, [])

  const categories = Array.from(
    new Set(transactions.map((t) => t.category))
  ).sort()
  const filtered =
    selectedCategory == null
      ? transactions
      : transactions.filter((t) => t.category === selectedCategory)
  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount
    return acc
  }, {})
  const total = transactions.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="app">
      <header className="header">
        <h1>Bank Statement Analyzer</h1>
        <p className="tagline">
          Upload CSV → map shops/home to customers → see summary by customer,
          Amma, mutual funds.
        </p>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === 'upload' ? 'active' : ''}
          onClick={() => setTab('upload')}
        >
          Upload & Transactions
        </button>
        <button
          type="button"
          className={tab === 'mapping' ? 'active' : ''}
          onClick={() => setTab('mapping')}
        >
          Room / Shop mapping
        </button>
        <button
          type="button"
          className={tab === 'report' ? 'active' : ''}
          onClick={() => setTab('report')}
          disabled={transactions.length === 0}
        >
          Summary report
        </button>
      </nav>

      {tab === 'upload' && (
        <>
          <UploadZone
            onFile={handleFile}
            isDragging={isDragging}
            onDragState={setIsDragging}
          />
          {error && <div className="error-banner">{error}</div>}
          {transactions.length > 0 && (
            <div className="results">
              <section className="summary">
                <div className="summary-card total">
                  <span className="summary-label">Net total</span>
                  <span
                    className={`summary-value ${total >= 0 ? 'positive' : 'negative'}`}
                  >
                    {formatAmount(total)}
                  </span>
                </div>
                <div className="summary-categories">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`summary-cat ${selectedCategory === cat ? 'active' : ''}`}
                      style={
                        {
                          '--pill-color':
                            CATEGORY_COLORS[cat as Transaction['category']],
                        } as React.CSSProperties
                      }
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? null : cat)
                      }
                    >
                      <span className="summary-cat-name">{cat}</span>
                      <span className="summary-cat-amount">
                        {formatAmount(byCategory[cat] ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="table-section">
                <h2>
                  {selectedCategory == null
                    ? 'All transactions'
                    : `Category: ${selectedCategory}`}
                </h2>
                <div className="table-wrap">
                  <table className="tx-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="amount">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((tx) => (
                        <tr key={tx.id}>
                          <td className="date">{tx.date}</td>
                          <td className="description">{tx.description}</td>
                          <td>
                            <CategoryPill category={tx.category} />
                          </td>
                          <td
                            className={`amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}
                          >
                            {formatAmount(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {tab === 'mapping' && (
        <MappingTable
          mapping={mapping}
          setMapping={setMapping}
          transactions={transactions}
        />
      )}

      {tab === 'report' && transactions.length > 0 && (
        <ReportView transactions={transactions} mapping={mapping} />
      )}
    </div>
  )
}
