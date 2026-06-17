import { useCallback, useEffect, useMemo, useState } from 'react'
import { isStatementFile, parseBankFile } from './parseCsv'
import type { ClientHistoryEntry, ClientUnitType, RoomShopMapping, Transaction } from './types'
import {
  createCustomUnit,
  createEmptyClient,
  defaultClientDatabase,
  loadMappingFromStorage,
  saveMappingToStorage,
  CATEGORY_COLORS,
} from './types'
import { buildReport, type ReportGroup } from './reportLogic'
import './App.css'

function formatAmount(amount: number): string {
  const n = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
  return amount >= 0 ? `+${n.format(amount)}` : n.format(amount)
}

function formatCompactINR(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (abs >= 1000) return `₹${(amount / 1000).toFixed(0)}K`
  return `₹${Math.round(amount)}`
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

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const fiscalMonthOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]

function monthIndexFromDate(date: string): number | null {
  const match = date.match(/\d{1,2}\/(\d{1,2})\/\d{2,4}/)
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month - 1 : null
}

function parseTxDate(date: string): number | null {
  const m = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return new Date(year, Number(m[2]) - 1, Number(m[1])).getTime()
}

function formatTickDate(ts: number, includeYear: boolean): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: '2-digit' } : {}),
  }).format(new Date(ts))
}

type TsCategory = 'room' | 'shop' | 'house'
type TsPeriod = '1W' | '1M' | '3M' | '6M' | '1Y'

const TS_PERIOD_DAYS: Record<TsPeriod, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
}

const TS_CATEGORY_LABELS: Record<TsCategory, string> = {
  room: 'Rooms',
  shop: 'Shops',
  house: 'Houses',
}

const TS_PERIODS: TsPeriod[] = ['1W', '1M', '3M', '6M', '1Y']

type MonthlyEntityReport = {
  columns: string[]
  rows: { month: string; amounts: Record<string, number> }[]
  totals: Record<string, number>
}

function emptyMonthlyAmounts(columns: string[]): Record<string, number> {
  return Object.fromEntries(columns.map((column) => [column, 0]))
}

function buildMonthlyEntityReport(
  groups: ReportGroup[],
  includeGroup: (group: ReportGroup) => boolean,
  sortColumns: (a: string, b: string) => number
): MonthlyEntityReport {
  const columns = [...new Set(groups.filter(includeGroup).map((group) => group.label))].sort(sortColumns)
  const rows = fiscalMonthOrder.map((monthIndex) => ({
    month: monthNames[monthIndex],
    amounts: emptyMonthlyAmounts(columns),
  }))
  const byMonth = new Map(fiscalMonthOrder.map((monthIndex, index) => [monthIndex, rows[index]]))
  const totals = emptyMonthlyAmounts(columns)

  for (const group of groups) {
    if (!includeGroup(group)) continue
    for (const transaction of group.transactions) {
      if (transaction.amount <= 0) continue
      const monthIndex = monthIndexFromDate(transaction.date)
      if (monthIndex == null) continue
      const row = byMonth.get(monthIndex)
      if (!row) continue
      row.amounts[group.label] += transaction.amount
      totals[group.label] += transaction.amount
    }
  }

  return { columns, rows, totals }
}

function buildHouseMonthlyReport(groups: ReportGroup[]): MonthlyEntityReport {
  const columns = ['Neha Mittal House 1', 'Nealabh House 2']
  const rows = fiscalMonthOrder.map((monthIndex) => ({
    month: monthNames[monthIndex],
    amounts: emptyMonthlyAmounts(columns),
  }))
  const byMonth = new Map(fiscalMonthOrder.map((monthIndex, index) => [monthIndex, rows[index]]))
  const totals = emptyMonthlyAmounts(columns)

  for (const group of groups) {
    if (group.type !== 'house') continue
    for (const transaction of group.transactions) {
      if (transaction.amount <= 0) continue
      const monthIndex = monthIndexFromDate(transaction.date)
      if (monthIndex == null) continue
      const row = byMonth.get(monthIndex)
      if (!row) continue
      const desc = transaction.description.toLowerCase()
      const column = desc.includes('neha mittal')
        ? 'Neha Mittal House 1'
        : desc.includes('nealabh bhatia')
          ? 'Nealabh House 2'
          : null
      if (!column) continue
      row.amounts[column] += transaction.amount
      totals[column] += transaction.amount
    }
  }

  return { columns, rows, totals }
}

function roomColumnSort(a: string, b: string): number {
  if (a === 'Other Rooms') return 1
  if (b === 'Other Rooms') return -1
  const numA = Number(a.match(/Room\s+(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER)
  const numB = Number(b.match(/Room\s+(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER)
  return numA - numB || a.localeCompare(b)
}

function monthlyReportToCsv(report: MonthlyEntityReport): string[][] {
  const header = ['Month', ...report.columns, 'Total']
  const dataRows = report.rows.map((row) => {
    const values = report.columns.map((column) => (row.amounts[column] ?? 0).toFixed(2))
    const total = report.columns.reduce((sum, column) => sum + (row.amounts[column] ?? 0), 0)
    return [row.month, ...values, total.toFixed(2)]
  })
  const totalRow = [
    'Total',
    ...report.columns.map((column) => (report.totals[column] ?? 0).toFixed(2)),
    report.columns.reduce((sum, column) => sum + (report.totals[column] ?? 0), 0).toFixed(2),
  ]
  return [header, ...dataRows, totalRow]
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function MonthlyReportDownload({
  label,
  report,
  filename,
}: {
  label: string
  report: MonthlyEntityReport
  filename: string
}) {
  const handleDownload = useCallback(() => {
    downloadCsv(filename, monthlyReportToCsv(report))
  }, [filename, report])

  if (report.columns.length === 0) return null

  return (
    <button type="button" className="btn-secondary" onClick={handleDownload}>
      {label}
    </button>
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

type TabId = 'upload' | 'mapping' | 'report' | 'graphs'

function MappingTable({
  mapping,
  setMapping,
}: {
  mapping: RoomShopMapping[]
  setMapping: React.Dispatch<React.SetStateAction<RoomShopMapping[]>>
}) {
  const updateUnit = useCallback(
    (id: string, patch: Partial<RoomShopMapping>) => {
      setMapping((prev) =>
        prev.map((unit) => (unit.id === id ? { ...unit, ...patch } : unit))
      )
    },
    [setMapping]
  )

  const addUnit = useCallback(
    (type: ClientUnitType) => {
      setMapping((prev) => {
        const existingNumbers = prev
          .filter((unit) => unit.type === type)
          .map((unit) => Number(unit.unitName.match(/\d+/)?.[0] ?? 0))
          .filter((n) => n > 0)
        const nextNumber = Math.max(0, ...existingNumbers) + 1
        return [...prev, createCustomUnit(type, nextNumber)]
      })
    },
    [setMapping]
  )

  const removeUnit = useCallback(
    (id: string) => setMapping((prev) => prev.filter((unit) => unit.id !== id)),
    [setMapping]
  )

  const addClient = useCallback(
    (unitId: string) => {
      setMapping((prev) =>
        prev.map((unit) =>
          unit.id === unitId
            ? { ...unit, clients: [...unit.clients, createEmptyClient()] }
            : unit
        )
      )
    },
    [setMapping]
  )

  const updateClient = useCallback(
    (unitId: string, clientId: string, patch: Partial<ClientHistoryEntry>) => {
      setMapping((prev) =>
        prev.map((unit) =>
          unit.id === unitId
            ? {
                ...unit,
                clients: unit.clients.map((client) =>
                  client.id === clientId ? { ...client, ...patch } : client
                ),
              }
            : unit
        )
      )
    },
    [setMapping]
  )

  const removeClient = useCallback(
    (unitId: string, clientId: string) => {
      setMapping((prev) =>
        prev.map((unit) =>
          unit.id === unitId
            ? {
                ...unit,
                clients: unit.clients.filter((client) => client.id !== clientId),
              }
            : unit
        )
      )
    },
    [setMapping]
  )

  const resetDatabase = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the client database to the default shops and rooms? This will remove any custom clients you added.'
    )
    if (confirmed) setMapping(defaultClientDatabase())
  }, [setMapping])

  const renderUnits = (type: ClientUnitType) => {
    const units = mapping.filter((unit) => unit.type === type)
    return (
      <div className="client-unit-list">
        {units.map((unit) => {
          const isDefaultUnit = /^(shop|room)-\d+$/.test(unit.id)
          return (
            <article className="client-unit-card" key={unit.id}>
              <div className="client-unit-header">
                <label>
                  <span>{type === 'shop' ? 'Shop label' : 'Room label'}</span>
                  <input
                    type="text"
                    value={unit.unitName}
                    onChange={(e) => updateUnit(unit.id, { unitName: e.target.value })}
                    placeholder={type === 'shop' ? 'Shop 1' : 'Room 301'}
                  />
                </label>
                <label>
                  <span>Identifier</span>
                  <input
                    type="text"
                    value={unit.identifier}
                    onChange={(e) => updateUnit(unit.id, { identifier: e.target.value })}
                    placeholder={type === 'shop' ? 'shop 1' : '301'}
                  />
                </label>
                {!isDefaultUnit && (
                  <button type="button" className="btn-ghost" onClick={() => removeUnit(unit.id)}>
                    Remove unit
                  </button>
                )}
              </div>

              {unit.clients.length === 0 && (
                <p className="empty-client-note">No client saved yet.</p>
              )}

              <div className="client-history-list">
                {unit.clients.map((client) => (
                  <div className="client-history-row" key={client.id}>
                    <label>
                      <span>Client name</span>
                      <input
                        type="text"
                        value={client.name}
                        onChange={(e) =>
                          updateClient(unit.id, client.id, { name: e.target.value })
                        }
                        placeholder={type === 'shop' ? 'BRIYANIPALAYAM' : 'Tenant name'}
                      />
                    </label>
                    <label className="client-aliases-field">
                      <span>Aliases / narration matches</span>
                      <textarea
                        value={client.aliases}
                        onChange={(e) =>
                          updateClient(unit.id, client.id, { aliases: e.target.value })
                        }
                        placeholder="One per line: UPI name, business name, old spelling"
                        rows={3}
                      />
                    </label>
                    <label>
                      <span>From</span>
                      <input
                        type="date"
                        value={client.startDate}
                        onChange={(e) =>
                          updateClient(unit.id, client.id, { startDate: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>To</span>
                      <input
                        type="date"
                        value={client.endDate}
                        onChange={(e) =>
                          updateClient(unit.id, client.id, { endDate: e.target.value })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost client-remove-btn"
                      onClick={() => removeClient(unit.id, client.id)}
                    >
                      Remove client
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="btn-secondary" onClick={() => addClient(unit.id)}>
                + Add current/old client
              </button>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <section className="mapping-section">
      <h2>Room / Shop client database</h2>
      <p className="mapping-hint">
        Store current and old clients here. Add aliases from the bank narration, and use
        optional from/to dates when a shop or room changes occupants so yearly statements still
        classify old payments correctly.
      </p>
      <div className="database-actions">
        <button type="button" className="btn-primary" onClick={() => addUnit('shop')}>
          + Add shop
        </button>
        <button type="button" className="btn-secondary" onClick={() => addUnit('room')}>
          + Add room
        </button>
        <button type="button" className="btn-secondary" onClick={resetDatabase}>
          Reset to default shops/rooms
        </button>
      </div>

      <div className="database-section">
        <h3>Shops</h3>
        {renderUnits('shop')}
      </div>

      <div className="database-section">
        <h3>Rooms</h3>
        {renderUnits('room')}
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

  const houseMonthlyReport = useMemo(
    () => buildHouseMonthlyReport(displayGroups),
    [displayGroups]
  )
  const roomsMonthlyReport = useMemo(
    () =>
      buildMonthlyEntityReport(
        displayGroups,
        (group) => group.type === 'room' || group.type === 'other_rooms',
        roomColumnSort
      ),
    [displayGroups]
  )
  const shopsMonthlyReport = useMemo(
    () =>
      buildMonthlyEntityReport(
        displayGroups,
        (group) => group.type === 'shop',
        (a, b) => a.localeCompare(b)
      ),
    [displayGroups]
  )
  const reportDate = new Date().toISOString().slice(0, 10)

  const categorySummary = useMemo(() => {
    const defs: { type: ReportGroup['type']; label: string; color: string }[] = [
      { type: 'amma', label: 'Amma', color: CATEGORY_COLORS.Amma },
      { type: 'shop', label: 'Shops', color: CATEGORY_COLORS.Shop },
      { type: 'house', label: 'House', color: CATEGORY_COLORS.House },
      { type: 'house_tax', label: 'House Tax', color: CATEGORY_COLORS['House Tax'] },
      { type: 'ski_towers_maintenance', label: 'SKI Maintenance', color: CATEGORY_COLORS['SKI Towers Maintenance'] },
      { type: 'electricity_payment', label: 'Electricity', color: CATEGORY_COLORS['Electricity Payment'] },
      { type: 'indu', label: 'Indu', color: CATEGORY_COLORS.Indu },
      { type: 'mutual_fund_purchase', label: 'MF Purchase', color: CATEGORY_COLORS['Mutual Fund Purchase'] },
      { type: 'mutual_fund_sell', label: 'MF Sell', color: CATEGORY_COLORS['Mutual Fund Sell'] },
      { type: 'others', label: 'Others', color: CATEGORY_COLORS.Others },
      { type: 'hdfc', label: 'HDFC', color: CATEGORY_COLORS.HDFC },
      { type: 'bank_interest', label: 'Interest', color: CATEGORY_COLORS.Interest },
      { type: 'income_tax', label: 'Income Tax', color: CATEGORY_COLORS['Income Tax'] },
      { type: 'advertisement', label: 'Advertisement', color: CATEGORY_COLORS.Advertisement },
      { type: 'telephone', label: 'Telephone', color: CATEGORY_COLORS.Telephone },
      { type: 'bank_charges', label: 'Bank Charges', color: CATEGORY_COLORS['Bank Charges'] },
      { type: 'room', label: 'Rooms', color: CATEGORY_COLORS.Room },
      { type: 'other_rooms', label: 'Other Rooms', color: CATEGORY_COLORS.Room },
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

  return (
    <section className="report-section">
      <h2>Summary report</h2>
      <p className="report-hint">
        <strong>House Tax</strong>, <strong>SKI Towers Maintenance</strong>, <strong>Amma</strong>, <strong>Shops</strong>, <strong>House</strong>, <strong>Electricity</strong>, <strong>Indu</strong>, <strong>Mutual Fund Purchase (O-MF)</strong>, <strong>Mutual Fund Sell (redemption)</strong>, <strong>Others</strong>, <strong>HDFC</strong>, <strong>Interest</strong>, <strong>Income Tax</strong>, <strong>Advertisement</strong>, <strong>Telephone</strong>, <strong>Bank Charges</strong>, database-matched <strong>Rooms</strong>, then <strong>Other Rooms</strong>.
      </p>
      <div className="monthly-report-downloads">
        <MonthlyReportDownload
          label="Download houses monthly report (CSV)"
          report={houseMonthlyReport}
          filename={`houses-monthly-${reportDate}.csv`}
        />
        <MonthlyReportDownload
          label="Download rooms monthly report (CSV)"
          report={roomsMonthlyReport}
          filename={`rooms-monthly-${reportDate}.csv`}
        />
        <MonthlyReportDownload
          label="Download shops monthly report (CSV)"
          report={shopsMonthlyReport}
          filename={`shops-monthly-${reportDate}.csv`}
        />
      </div>
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
      <div className="report-groups">
        {displayGroups.map((group, idx) => (
          <div key={`${group.type}-${group.label}-${idx}`} className="report-group">
            <div className="report-group-header">
              <span className="report-group-title">
                {group.type === 'amma' && 'Amma · '}
                {group.type === 'shop' && 'Shop · '}
                {group.type === 'house' && 'House · '}
                {group.type === 'house_tax' && 'House Tax · '}
                {group.type === 'ski_towers_maintenance' && 'SKI Maintenance · '}
                {group.type === 'electricity_payment' && 'Electricity · '}
                {group.type === 'indu' && 'Indu · '}
                {group.type === 'mutual_fund_purchase' && 'MF Purchase · '}
                {group.type === 'mutual_fund_sell' && 'MF Sell · '}
                {group.type === 'others' && 'Others · '}
                {group.type === 'hdfc' && 'HDFC · '}
                {group.type === 'bank_interest' && 'Interest · '}
                {group.type === 'income_tax' && 'Income Tax · '}
                {group.type === 'advertisement' && 'Advertisement · '}
                {group.type === 'telephone' && 'Telephone · '}
                {group.type === 'bank_charges' && 'Bank Charges · '}
                {group.type === 'room' && 'Room · '}
                {group.type === 'other_rooms' && 'Other Rooms · '}
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

function RoomIncomeTrendChart({ monthly }: { monthly: { month: string; amount: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const maxAmount = Math.max(...monthly.map((m) => m.amount), 1)
  const niceMax = Math.pow(10, Math.floor(Math.log10(maxAmount)))
  const roundedMax = Math.ceil(maxAmount / niceMax) * niceMax
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * roundedMax)

  const width = 800
  const height = 360
  const padding = { top: 32, right: 24, bottom: 48, left: 72 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const slot = innerWidth / monthly.length
  const barWidth = slot * 0.6

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="trend-chart"
      role="img"
      aria-label="Total room income per fiscal month"
    >
      {yTicks.map((tick, i) => {
        const y = padding.top + innerHeight - (tick / roundedMax) * innerHeight
        return (
          <g key={i}>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={y}
              y2={y}
              className="trend-grid"
            />
            <text x={padding.left - 10} y={y} className="trend-axis-label trend-y-label">
              {formatCompactINR(tick)}
            </text>
          </g>
        )
      })}
      {monthly.map((entry, i) => {
        const barHeight = (entry.amount / roundedMax) * innerHeight
        const x = padding.left + slot * i + (slot - barWidth) / 2
        const y = padding.top + innerHeight - barHeight
        const isHovered = hoveredIndex === i
        const tooltipLabel = formatAmount(entry.amount).replace(/^\+/, '')
        const tooltipWidth = Math.max(88, tooltipLabel.length * 7.5 + 16)
        const tooltipX = x + barWidth / 2 - tooltipWidth / 2
        const tooltipY = Math.max(padding.top + 4, y - 34)
        return (
          <g key={entry.month}>
            <rect
              x={padding.left + slot * i}
              y={padding.top}
              width={slot}
              height={innerHeight}
              fill="transparent"
              className="trend-bar-hit"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 0)}
              rx={4}
              className={`trend-bar${isHovered ? ' trend-bar-hovered' : ''}`}
            />
            {isHovered && (
              <g className="trend-tooltip" pointerEvents="none">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={24}
                  rx={4}
                  className="trend-tooltip-bg"
                />
                <text
                  x={x + barWidth / 2}
                  y={tooltipY + 16}
                  className="trend-tooltip-text"
                >
                  {tooltipLabel}
                </text>
              </g>
            )}
            {entry.amount > 0 && (
              <text x={x + barWidth / 2} y={y - 6} className="trend-bar-label">
                {formatCompactINR(entry.amount)}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={padding.top + innerHeight + 20}
              className="trend-axis-label trend-x-label"
            >
              {entry.month.slice(0, 3)}
            </text>
          </g>
        )
      })}
      <line
        x1={padding.left}
        x2={padding.left + innerWidth}
        y1={padding.top + innerHeight}
        y2={padding.top + innerHeight}
        className="trend-axis"
      />
    </svg>
  )
}

function WinnersLosersChart({
  rooms,
}: {
  rooms: { label: string; amount: number }[]
}) {
  if (rooms.length === 0) {
    return <p className="empty-client-note">Not enough room data.</p>
  }

  const mean = rooms.reduce((s, r) => s + r.amount, 0) / rooms.length
  const winners = rooms.filter((r) => r.amount >= mean)
  const losers = rooms.filter((r) => r.amount < mean).reverse()

  const max = Math.max(
    ...winners.map((w) => w.amount),
    ...losers.map((l) => l.amount),
    1
  )

  const renderRow = (
    item: { label: string; amount: number },
    kind: 'winner' | 'loser'
  ) => (
    <div className="wl-row" key={`${kind}-${item.label}`}>
      <span className="wl-label" title={item.label}>
        {item.label}
      </span>
      <div className="wl-bar-track">
        <div
          className={`wl-bar wl-bar-${kind}`}
          style={{ width: `${Math.max(2, (item.amount / max) * 100)}%` }}
        />
      </div>
      <span className="wl-amount">{formatCompactINR(item.amount)}</span>
    </div>
  )

  return (
    <div className="winners-losers-grid">
      <div className="wl-col">
        <h3 className="wl-col-title wl-col-title-winner">
          Winners <span className="wl-col-meta">at or above mean {formatCompactINR(mean)}</span>
        </h3>
        <div className="wl-col-body">
          {winners.length === 0 ? (
            <p className="empty-client-note">No rooms above the mean.</p>
          ) : (
            winners.map((w) => renderRow(w, 'winner'))
          )}
        </div>
      </div>
      <div className="wl-col">
        <h3 className="wl-col-title wl-col-title-loser">
          Losers <span className="wl-col-meta">below mean {formatCompactINR(mean)}</span>
        </h3>
        <div className="wl-col-body">
          {losers.length === 0 ? (
            <p className="empty-client-note">No rooms below the mean.</p>
          ) : (
            losers.map((l) => renderRow(l, 'loser'))
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryTimeSeriesChart({
  groups,
  category,
  period,
}: {
  groups: ReportGroup[]
  category: TsCategory
  period: TsPeriod
}) {
  const series = useMemo(() => {
    const matchesCategory = (g: ReportGroup) => {
      if (category === 'room') return g.type === 'room' || g.type === 'other_rooms'
      if (category === 'shop') return g.type === 'shop'
      return g.type === 'house'
    }

    const txs: { time: number; amount: number }[] = []
    for (const g of groups) {
      if (!matchesCategory(g)) continue
      for (const t of g.transactions) {
        const time = parseTxDate(t.date)
        if (time == null) continue
        txs.push({ time, amount: t.amount })
      }
    }
    if (!txs.length) return null

    txs.sort((a, b) => a.time - b.time)
    const windowEnd = txs[txs.length - 1].time
    const windowStart = windowEnd - TS_PERIOD_DAYS[period] * 86400000
    const inWindow = txs.filter((t) => t.time >= windowStart)
    if (!inWindow.length) return null

    const byDay = new Map<number, number>()
    for (const t of inWindow) {
      const d = new Date(t.time)
      d.setHours(0, 0, 0, 0)
      const dayTs = d.getTime()
      byDay.set(dayTs, (byDay.get(dayTs) ?? 0) + t.amount)
    }

    const days = [...byDay.entries()].sort((a, b) => a[0] - b[0])
    let running = 0
    const points = days.map(([time, delta]) => {
      running += delta
      return { time, value: running }
    })

    return { points, windowStart, windowEnd }
  }, [groups, category, period])

  if (!series) {
    return (
      <p className="empty-client-note">
        No {TS_CATEGORY_LABELS[category].toLowerCase()} transactions in this window.
      </p>
    )
  }

  const { points, windowStart, windowEnd } = series
  const values = points.map((p) => p.value)
  const minY = Math.min(0, ...values)
  const maxY = Math.max(...values, 0)
  const yRange = maxY - minY || 1

  const width = 800
  const height = 320
  const padding = { top: 32, right: 24, bottom: 48, left: 80 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const xSpan = windowEnd - windowStart || 1

  const xScale = (t: number) => padding.left + ((t - windowStart) / xSpan) * innerW
  const yScale = (v: number) => padding.top + innerH - ((v - minY) / yRange) * innerH

  const pathD = points
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.time).toFixed(2)} ${yScale(p.value).toFixed(2)}`
    )
    .join(' ')

  const first = points[0]
  const last = points[points.length - 1]
  const baselineY = yScale(0)
  const areaD = `${pathD} L ${xScale(last.time).toFixed(2)} ${baselineY.toFixed(2)} L ${xScale(first.time).toFixed(2)} ${baselineY.toFixed(2)} Z`

  const isUp = last.value >= 0
  const lineClass = isUp ? 'ts-line-up' : 'ts-line-down'

  const yTicks = [0, 0.5, 1].map((t) => minY + t * yRange)
  const xTickCount = 5
  const xTicks = Array.from(
    { length: xTickCount },
    (_, i) => windowStart + (xSpan / (xTickCount - 1)) * i
  )
  const includeYear = period === '6M' || period === '1Y'

  return (
    <div className="ts-chart-wrap">
      <div className="ts-summary">
        <span className="ts-summary-label">Net change ({period})</span>
        <span className={`ts-summary-value ${isUp ? 'positive' : 'negative'}`}>
          {formatAmount(last.value)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="ts-chart"
        role="img"
        aria-label={`${TS_CATEGORY_LABELS[category]} cumulative net over ${period}`}
      >
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={padding.left + innerW}
              y1={yScale(tick)}
              y2={yScale(tick)}
              className="trend-grid"
            />
            <text
              x={padding.left - 10}
              y={yScale(tick)}
              className="trend-axis-label trend-y-label"
            >
              {formatCompactINR(tick)}
            </text>
          </g>
        ))}
        <path d={areaD} className={`ts-area ${lineClass}`} />
        <path d={pathD} className={`ts-line ${lineClass}`} />
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={xScale(tick)}
            y={padding.top + innerH + 20}
            className="trend-axis-label trend-x-label"
          >
            {formatTickDate(tick, includeYear)}
          </text>
        ))}
        <line
          x1={padding.left}
          x2={padding.left + innerW}
          y1={padding.top + innerH}
          y2={padding.top + innerH}
          className="trend-axis"
        />
      </svg>
    </div>
  )
}

function TimeSeriesSection({ groups }: { groups: ReportGroup[] }) {
  const [category, setCategory] = useState<TsCategory>('room')
  const [period, setPeriod] = useState<TsPeriod>('1M')

  return (
    <>
      <div className="ts-controls">
        <div className="ts-toggle-group" role="tablist">
          {(['room', 'shop', 'house'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`ts-toggle ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
              role="tab"
              aria-selected={category === c}
            >
              {TS_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="ts-period-group" role="tablist">
          {TS_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`ts-period ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
              role="tab"
              aria-selected={period === p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <CategoryTimeSeriesChart groups={groups} category={category} period={period} />
    </>
  )
}

function GraphsView({
  transactions,
  mapping,
}: {
  transactions: Transaction[]
  mapping: RoomShopMapping[]
}) {
  const groups = useMemo(() => buildReport(transactions, mapping), [transactions, mapping])

  const monthlyRoomIncome = useMemo(() => {
    const totals = fiscalMonthOrder.map(() => 0)
    for (const group of groups) {
      if (group.type !== 'room' && group.type !== 'other_rooms') continue
      for (const tx of group.transactions) {
        if (tx.amount <= 0) continue
        const monthIndex = monthIndexFromDate(tx.date)
        if (monthIndex == null) continue
        const fiscalIdx = fiscalMonthOrder.indexOf(monthIndex)
        if (fiscalIdx === -1) continue
        totals[fiscalIdx] += tx.amount
      }
    }
    return fiscalMonthOrder.map((monthIdx, i) => ({
      month: monthNames[monthIdx],
      amount: totals[i],
    }))
  }, [groups])

  const roomTotals = useMemo(() => {
    const list = groups
      .filter((g) => g.type === 'room')
      .map((g) => ({
        label: g.label,
        amount: g.transactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0),
      }))

    const occupiedUnits = new Set(
      groups
        .filter((g) => g.type === 'room')
        .map((g) => g.label.split(':')[0].trim())
    )

    for (const unit of mapping) {
      if (unit.type !== 'room') continue
      if (!occupiedUnits.has(unit.unitName)) {
        list.push({ label: `${unit.unitName} (vacant)`, amount: 0 })
      }
    }

    return list.sort((a, b) => b.amount - a.amount)
  }, [groups, mapping])

  return (
    <section className="report-section">
      <h2>Room income trend</h2>
      <div className="graph-card">
        <RoomIncomeTrendChart monthly={monthlyRoomIncome} />
      </div>

      <h2 className="graph-heading">Winners &amp; losers</h2>
      <div className="graph-card">
        <WinnersLosersChart rooms={roomTotals} />
      </div>

      <h2 className="graph-heading">Net trend</h2>
      <div className="graph-card">
        <TimeSeriesSection groups={groups} />
      </div>
    </section>
  )
}

type SavedStatement = {
  id: string
  name: string
  savedAt: string
  transactionCount: number
  transactions: Transaction[]
}

const SAVED_STATEMENTS_KEY = 'bank-statement-saved-files'

function loadSavedStatements(): SavedStatement[] {
  try {
    const raw = localStorage.getItem(SAVED_STATEMENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistSavedStatements(list: SavedStatement[]): string | null {
  try {
    localStorage.setItem(SAVED_STATEMENTS_KEY, JSON.stringify(list))
    return null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      return 'Storage full. Delete an old saved statement and try again.'
    }
    return e instanceof Error ? e.message : 'Failed to save'
  }
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
  const [savedStatements, setSavedStatements] = useState<SavedStatement[]>(() =>
    loadSavedStatements()
  )
  const [pendingName, setPendingName] = useState('')
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    saveMappingToStorage(mapping)
  }, [mapping])

  useEffect(() => {
    const err = persistSavedStatements(savedStatements)
    setSaveError(err)
  }, [savedStatements])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setSaveError(null)
    try {
      const parsed = await parseBankFile(file)
      setTransactions(parsed)
      setSelectedCategory(null)
      setPendingName(file.name.replace(/\.(csv|xls|xlsx)$/i, ''))
      setCurrentSavedId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse statement')
      setTransactions([])
    }
  }, [])

  const handleSaveCurrent = useCallback(() => {
    const name = pendingName.trim()
    if (!name || transactions.length === 0) return
    const entry: SavedStatement = {
      id: crypto.randomUUID(),
      name,
      savedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      transactions,
    }
    setSavedStatements((prev) => [entry, ...prev])
    setCurrentSavedId(entry.id)
    setPendingName('')
  }, [pendingName, transactions])

  const handleLoadSaved = useCallback((entry: SavedStatement) => {
    setError(null)
    setSaveError(null)
    setTransactions(entry.transactions)
    setSelectedCategory(null)
    setCurrentSavedId(entry.id)
    setPendingName('')
  }, [])

  const handleDeleteSaved = useCallback((id: string) => {
    setSavedStatements((prev) => prev.filter((s) => s.id !== id))
    setCurrentSavedId((prev) => (prev === id ? null : prev))
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
          Client database
        </button>
        <button
          type="button"
          className={tab === 'report' ? 'active' : ''}
          onClick={() => setTab('report')}
          disabled={transactions.length === 0}
        >
          Summary report
        </button>
        <button
          type="button"
          className={tab === 'graphs' ? 'active' : ''}
          onClick={() => setTab('graphs')}
          disabled={transactions.length === 0}
        >
          Graphs
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
          {saveError && <div className="error-banner">{saveError}</div>}

          {savedStatements.length > 0 && (
            <section className="saved-statements">
              <h2>Saved statements</h2>
              <ul className="saved-list">
                {savedStatements.map((s) => (
                  <li
                    key={s.id}
                    className={`saved-item ${currentSavedId === s.id ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="saved-item-main"
                      onClick={() => handleLoadSaved(s)}
                    >
                      <span className="saved-item-name">{s.name}</span>
                      <span className="saved-item-meta">
                        {new Date(s.savedAt).toLocaleDateString()} ·{' '}
                        {s.transactionCount} transactions
                      </span>
                    </button>
                    <button
                      type="button"
                      className="saved-item-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (
                          window.confirm(
                            `Delete saved statement "${s.name}"? This cannot be undone.`
                          )
                        ) {
                          handleDeleteSaved(s.id)
                        }
                      }}
                      title="Delete saved statement"
                      aria-label={`Delete ${s.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {transactions.length > 0 && currentSavedId == null && (
            <div className="save-card">
              <label className="save-card-field">
                <span>Save this statement as</span>
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  placeholder="e.g. HDFC FY 2024-25"
                />
              </label>
              <button
                type="button"
                className="btn-primary save-btn"
                onClick={handleSaveCurrent}
                disabled={!pendingName.trim()}
              >
                Save for later
              </button>
            </div>
          )}

          {currentSavedId != null &&
            (() => {
              const current = savedStatements.find((s) => s.id === currentSavedId)
              if (!current) return null
              return (
                <div className="current-saved-banner">
                  Showing saved statement: <strong>{current.name}</strong>
                  <span className="current-saved-meta">
                    {' '}
                    · saved {new Date(current.savedAt).toLocaleDateString()}
                  </span>
                </div>
              )
            })()}

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
        />
      )}

      {tab === 'report' && transactions.length > 0 && (
        <ReportView transactions={transactions} mapping={mapping} />
      )}

      {tab === 'graphs' && transactions.length > 0 && (
        <GraphsView transactions={transactions} mapping={mapping} />
      )}
    </div>
  )
}
