import { useCallback, useEffect, useMemo, useState } from 'react'
import { isStatementFile, parseBankFile } from './parseCsv'
import type { Transaction } from './types'
import type { RoomShopMapping } from './types'
import {
  loadMappingFromStorage,
  saveMappingToStorage,
  BUILTIN_MAPPING_TYPES,
  CATEGORY_COLORS,
} from './types'
import { buildReport, extractRoomShopFromTransactions, type ReportGroup } from './reportLogic'
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
      if (file && isStatementFile(file)) onFile(file)
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
        accept=".csv,.xls,.xlsx"
        onChange={handleInput}
        id="statement-upload"
        className="upload-input"
      />
      <label htmlFor="statement-upload" className="upload-label">
        <span className="upload-icon">📄</span>
        <span>Drop bank statement (CSV or Excel .xls / .xlsx) or click to browse</span>
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
      <h2>Optional overrides (Shop / House / Room)</h2>
      <p className="mapping-hint">
        Automatic split: <strong>Amma</strong>, <strong>Shops</strong>, <strong>House</strong>, <strong>Indu</strong>, <strong>Mutual funds (O-MF)</strong>, and <strong>Rooms</strong>. Use overrides only to tweak shop/house identifiers.
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
      <button type="button" className="btn-primary mapping-add-row" onClick={addRow}>
        + Add override row
      </button>
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

  const categorySummary = useMemo(() => {
    const defs: { type: ReportGroup['type']; label: string; color: string }[] = [
      { type: 'amma', label: 'Amma', color: CATEGORY_COLORS.Amma },
      { type: 'shop', label: 'Shops', color: CATEGORY_COLORS.Shop },
      { type: 'house', label: 'House', color: CATEGORY_COLORS.House },
      { type: 'ski_towers_maintenance', label: 'SKI Maintenance', color: CATEGORY_COLORS['SKI Towers Maintenance'] },
      { type: 'electricity_payment', label: 'Electricity', color: CATEGORY_COLORS['Electricity Payment'] },
      { type: 'indu', label: 'Indu', color: CATEGORY_COLORS.Indu },
      { type: 'mutual_funds', label: 'Mutual funds', color: CATEGORY_COLORS['Mutual Funds'] },
      { type: 'room', label: 'Rooms', color: CATEGORY_COLORS.Room },
    ]
    return defs.map(({ type, label, color }) => {
      const matching = displayGroups.filter((g) => g.type === type)
      let credit = 0
      let debit = 0
      let net = 0
      for (const g of matching) {
        for (const t of g.transactions) {
          if (t.amount > 0) credit += t.amount
          else debit += Math.abs(t.amount)
          net += t.amount
        }
      }
      return { type, label, color, credit, debit, net }
    })
  }, [displayGroups])

  const downloadReport = useCallback(() => {
    const rows: string[][] = [['Client', 'Credit', 'Debit']]
    for (const g of displayGroups) {
      const credit = g.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const debit = g.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      rows.push([
        g.label,
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
        <strong>SKI Towers Maintenance</strong>, <strong>Amma</strong>, <strong>Shops</strong>, <strong>House</strong>, <strong>Electricity</strong>, <strong>Indu</strong>, <strong>Mutual funds (O-MF)</strong>, then <strong>Rooms</strong> (everyone else).
      </p>
      <div className="category-summary-grid">
        {categorySummary.map((cat) => (
          <div
            key={cat.type}
            className="category-summary-box"
            style={{ '--cat-color': cat.color } as React.CSSProperties}
          >
            <span className="category-summary-label">{cat.label}</span>
            <div className="category-summary-rows">
              <div className="category-summary-row">
                <span>Credit</span>
                <span className="positive">{formatAmount(cat.credit)}</span>
              </div>
              <div className="category-summary-row">
                <span>Debit</span>
                <span className="negative">{formatAmount(-cat.debit)}</span>
              </div>
              <div className="category-summary-row net">
                <span>Net</span>
                <span className={cat.net >= 0 ? 'positive' : 'negative'}>
                  {formatAmount(cat.net)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-primary download-report-btn" onClick={downloadReport}>
        Download report (CSV)
      </button>
      <div className="report-groups">
        {displayGroups.map((group, idx) => (
          <div key={`${group.type}-${group.label}-${idx}`} className="report-group">
            <div className="report-group-header">
              <span className="report-group-title">
                {group.type === 'amma' && 'Amma · '}
                {group.type === 'shop' && 'Shop · '}
                {group.type === 'house' && 'House · '}
                {group.type === 'ski_towers_maintenance' && 'SKI Maintenance · '}
                {group.type === 'electricity_payment' && 'Electricity · '}
                {group.type === 'indu' && 'Indu · '}
                {group.type === 'mutual_funds' && 'Mutual funds · '}
                {group.type === 'room' && 'Room · '}
                {group.label}
              </span>
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
      const parsed = await parseBankFile(file)
      setTransactions(parsed)
      setSelectedCategory(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse statement')
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
