import { useCallback, useEffect, useState } from 'react'
import { parseBankCsv } from './parseCsv'
import type { Transaction } from './types'
import type { RoomShopMapping } from './types'
import {
  loadMappingFromStorage,
  saveMappingToStorage,
  CATEGORY_COLORS,
} from './types'
import { buildReport } from './reportLogic'
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
}: {
  mapping: RoomShopMapping[]
  setMapping: React.Dispatch<React.SetStateAction<RoomShopMapping[]>>
}) {
  const addRow = useCallback(() => {
    setMapping((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'room' as const,
        identifier: '',
        customerName: '',
      },
    ])
  }, [setMapping])
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
      <h2>Room / Shop → Customer mapping</h2>
      <p className="mapping-hint">
        Add rows to map room numbers or shop names (as they appear in the
        statement) to customer names. The report will group transactions by
        these.
      </p>
      <div className="table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Room no / Shop identifier</th>
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
                    <option value="room">Room</option>
                    <option value="shop">Shop</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.identifier}
                    onChange={(e) =>
                      updateRow(row.id, { identifier: e.target.value.trim() })
                    }
                    placeholder="e.g. 406, 308, BRIYANIPALAYAM"
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
      <button type="button" className="btn-primary" onClick={addRow}>
        + Add Room / Shop
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
  const roomShopGroups = groups
    .filter((g) => g.type === 'room_shop')
    .sort((a, b) => {
      if (a.roomShopType !== b.roomShopType)
        return (a.roomShopType === 'room' ? 0 : 1) - (b.roomShopType === 'room' ? 0 : 1)
      return (a.roomShopIdentifier ?? '').localeCompare(b.roomShopIdentifier ?? '')
    })
  const roomShopFirst = [
    ...roomShopGroups,
    ...groups.filter((g) => g.type === 'amma'),
    ...groups.filter((g) => g.type === 'mutual_funds'),
    ...groups.filter((g) => g.type === 'by_client'),
  ]

  return (
    <section className="report-section">
      <h2>Summary report</h2>
      <p className="report-hint">
        By room no / shop no, then customer name. Plus Amma, Mutual funds, and
        by client.
      </p>
      <div className="report-groups">
        {roomShopFirst.map((group, idx) => (
          <div key={`${group.type}-${group.label}-${idx}`} className="report-group">
            <div className="report-group-header">
              <span className="report-group-title">{group.label}</span>
              {group.customerName != null && group.type === 'room_shop' && (
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
          Upload CSV → map room/shop to customers → see summary by customer &
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
        <MappingTable mapping={mapping} setMapping={setMapping} />
      )}

      {tab === 'report' && transactions.length > 0 && (
        <ReportView transactions={transactions} mapping={mapping} />
      )}
    </div>
  )
}
