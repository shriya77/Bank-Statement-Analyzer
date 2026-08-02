export type Category =
  | 'Amma'
  | 'Shop'
  | 'House'
  | 'House Tax'
  | 'SKI Towers Maintenance'
  | 'Electricity Payment'
  | 'Indu'
  | 'Mutual Fund Purchase'
  | 'Mutual Fund Sell'
  | 'Others'
  | 'HDFC'
  | 'Interest'
  | 'Income Tax'
  | 'Advertisement'
  | 'Telephone'
  | 'Bank Charges'
  | 'Room'
  | 'One Day Room'

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: Category
  raw: Record<string, string>
}

export type ClientUnitType = 'shop' | 'room'

export interface ClientHistoryEntry {
  id: string
  name: string
  /** Extra names, UPI handles, or narration fragments that identify this client. */
  aliases: string
  /** True for former occupants — still used to classify old statements. */
  isEx?: boolean
  /** @deprecated Dates are no longer used; kept for older saved data. */
  startDate?: string
  /** @deprecated Dates are no longer used; kept for older saved data. */
  endDate?: string
}

export interface ClientUnit {
  id: string
  type: ClientUnitType
  /** e.g. "Shop 1" or "Room 301" */
  unitName: string
  /** e.g. "shop 1" or "301" - used to match room/shop references in narration */
  identifier: string
  clients: ClientHistoryEntry[]
}

export type RoomShopMapping = ClientUnit

export const CATEGORY_COLORS: Record<Category, string> = {
  Amma: '#8b5cf6',
  Shop: '#d97706',
  House: '#0891b2',
  'House Tax': '#ea580c',
  'SKI Towers Maintenance': '#0d9488',
  'Electricity Payment': '#ca8a04',
  Indu: '#db2777',
  'Mutual Fund Purchase': '#0284c7',
  'Mutual Fund Sell': '#0ea5e9',
  Others: '#64748b',
  HDFC: '#1d4ed8',
  Interest: '#65a30d',
  'Income Tax': '#2563eb',
  Advertisement: '#e11d48',
  Telephone: '#0891b2',
  'Bank Charges': '#475569',
  Room: '#059669',
  'One Day Room': '#34d399',
}

const MAPPING_STORAGE_KEY = 'bank-statement-client-database'
const LEGACY_MAPPING_STORAGE_KEY = 'bank-statement-room-shop-mapping'

function roomRange(start: number, end: number): string[] {
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
}

/** Full building inventory: 201–212, 301–311, 401–411, 501–502 */
const roomNumbers = [
  ...roomRange(201, 212),
  ...roomRange(301, 311),
  ...roomRange(401, 411),
  '501',
  '502',
] as const

function client(
  id: string,
  name: string,
  aliases = name,
  isEx = false
): ClientHistoryEntry {
  return {
    id,
    name,
    aliases,
    isEx,
  }
}

export function defaultClientDatabase(): RoomShopMapping[] {
  const shops: RoomShopMapping[] = [
    {
      id: 'shop-1',
      type: 'shop',
      unitName: 'Shop 1',
      // 3 combined physical shops (incl. former Nirmala Devi)
      identifier: 'shop 1\nshop 3',
      clients: [
        client(
          'shop-1-briyanipalayam',
          'BRIYANIPALAYAM',
          'BRIYANIPALAYAM\nBIRYANIPALAYAM\nBIRYANI PALAYAM\nSABEER BAI\nSABEER BAI BIRYANI\nSABEER\nSRS FOODS\nS R S FOODS\nSHABANA\nSHABANA PARVIN R'
        ),
        client('shop-1-nirmala-devi-ex', 'NIRMALA DEVI', 'NIRMALA DEVI\nWELLDEVI1978', true),
      ],
    },
    {
      id: 'shop-2',
      type: 'shop',
      unitName: 'Shop 2',
      // Dance class — 3 combined shops (Saranya, Mahitha, former Emerald)
      identifier: 'shop 2\nshop 5\nmahitha',
      clients: [
        client('shop-2-saranya', 'SARANYA', 'SARANYA\nDANCE\nDANCE CLASS'),
        client(
          'shop-2-mahitha',
          'Mahitha Midhun',
          'MAHITHA MIDHUN\nMAHITHA'
        ),
        client(
          'shop-2-emerald-ex',
          '123DENTISTRYEMERALD',
          '123DENTISTRYEMERALD\nEMERALD\nDENTISTRY',
          true
        ),
      ],
    },
    {
      id: 'shop-3',
      type: 'shop',
      unitName: 'Shop 3',
      identifier: 'shop 4',
      clients: [client('shop-3-nathiya', 'NATHIYA', 'NATHIYA')],
    },
    {
      id: 'shop-4',
      type: 'shop',
      unitName: 'Shop 4',
      identifier: 'shop 6',
      clients: [client('shop-4-saridha', 'SARIDHA', 'SARIDHA\nSANSARVA')],
    },
    {
      id: 'shop-5',
      type: 'shop',
      unitName: 'Shop 5',
      identifier: 'chandrasekar',
      clients: [
        client(
          'shop-5-chandrasekar-divya',
          'Chandrasekar / Divya',
          'CHANDRASEKAR\nCHANDRA SEKAR\nDIVYA'
        ),
      ],
    },
  ]

  const initialRoomClients: Record<string, ClientHistoryEntry[]> = {
    '301': [
      client('room-301-siddappa-senthil-raj', 'Siddappa Senthil Raj', 'SIDDAPPA SENTHIL RAJ'),
    ],
    '207': [
      client('room-207-hyperband', 'Hyperband', 'HYPERBAND'),
    ],
    '204': [
      client('room-204-gokulnath-p', 'Gokulnath P', 'GOKULNATH P\nGOKULNATH463'),
    ],
    '310': [
      client('room-310-rajagopalan-v', 'Rajagopalan V', 'RAJAGOPALAN V'),
    ],
    '305': [
      client('room-305-sathya-s', 'Sathya S', 'SATHYA S\n9965688093'),
    ],
    '208': [
      client('room-208-chakravarthy-m', 'Chakravarthy M', 'CHAKRAVARTHY M\nMCHAKRAVARTHY777'),
    ],
    '205': [
      client('room-205-sai-gopal-majumdar', 'Sai Gopal Majumdar', 'SAI GOPAL MAJUMDAR\nSAIGOPAL182'),
    ],
    '409': [
      client('room-409-benjamin-stephen-g', 'Benjamin Stephen G', 'BENJAMIN STEPHEN G\nGBS002003'),
    ],
    '302': [
      client('room-302-m-amirullah', 'M Amirullah', 'M AMIRULLAH'),
    ],
    '304': [
      client('room-304-vijayavarman-a', 'Vijayavarman A', 'VIJAYAVARMAN A\nVIJAY.VIJAY6'),
    ],
    '306': [
      client('room-306-sunil-kumar-karinga', 'Sunil Kumar Karinga', 'SUNIL KUMAR KARINGA\nSUNILKARINGALI'),
    ],
    '502': [
      client('room-502-sampath-k', 'Sampath K', 'SAMPATH K'),
    ],
    '203': [
      client('room-203-pugalethi-sorapoji', 'Pugalethi Sorapoji', 'PUGALETHI SORAPOJI\nPUGALENDHISARABOJI'),
    ],
    '211': [
      client('room-211-agash', 'Agash', 'AGASH'),
      client(
        'room-211-a-karunanithi',
        'A Karunanithi',
        'A KARUNANITHI\nKARUNAMADURAI.2015',
        true
      ),
    ],
    '303': [
      client('room-303-gobinath-k', 'Gobinath K', 'GOBINATH K'),
    ],
    '410': [
      client(
        'room-410-punithakumari-ravi',
        'Punithakumari Ravi',
        'PUNITHAKUMARI RAVI\n12PUNITHAPUNITHA',
        true
      ),
    ],
    '212': [
      client(
        'room-212-ashwin-balakumar-sum',
        'Ashwin Balakumar Sum',
        'ASHWIN BALAKUMAR SUM\nASHWINBSA',
        true
      ),
    ],
    '405': [
      client('room-405-subash-k', 'Subash K', 'SUBASH K\nSUBASHPTJ282'),
    ],
    '403': [
      client('room-403-senthil', 'Senthil', 'SENTHIL'),
      client('room-403-gowtham-ak', 'Gowtham Ak', 'GOWTHAM AK\n9360642935', true),
    ],
    '308': [
      client(
        'room-308-suganya-chellapandian',
        'Suganya Chellapandian',
        'SUGANYA CHELLAPANDIAN\nSELLAPANDIAN\nCHELLAPANDIAN\nSUGANYA S\nSUGANYA\nDHANAVASHA'
      ),
    ],
    '309': [
      client('room-309-thukkaram', 'Thukkaram', 'THUKKARAM\nUPI-THUKKARAM'),
    ],
    '401': [
      client('room-401-stephen-raj', 'Stephen Raj', 'STEPHEN RAJ'),
    ],
    '210': [
      client('room-210-k-karthik', 'K Karthik', 'K KARTHIK'),
    ],
    '407': [
      client('room-407-s-k-arun', 'S K Arun', 'S K ARUN\nARUN99THEBOSS'),
    ],
    '209': [
      client('room-209-vijayakumar', 'Vijayakumar', 'VIJAYAKUMAR'),
      client('room-209-arunachalam', 'Arunachalam', 'ARUNACHALAM\n9486271797', true),
    ],
    '201': [
      client('room-201-baskaran-r', 'Baskaran R', 'BASKARAN R'),
    ],
    '406': [
      client('room-406-leveil-godson-a', 'Leveil Godson A', 'LEVEIL GODSON A\nGODSONKURUVILA4'),
    ],
    '411': [
      client('room-411-saravanan', 'Saravanan', 'SARAVANAN'),
      client('room-411-moosa-fayaz-m-p', 'Moosa Fayaz M P', 'MOOSA FAYAZ M P\nMPMOOSA22', true),
      client(
        'room-411-mr-muhammed-yaseen-k',
        'Mr Muhammed Yaseen K',
        'MR MUHAMMED YASEEN K\nYASEENYASU',
        true
      ),
      client(
        'room-411-haseena-mumthas-c',
        'Haseena Mumthas C',
        'HASEENA MUMTHAS C\nMSAHAD242',
        true
      ),
    ],
  }

  const rooms = roomNumbers.map((room) => ({
    id: `room-${room}`,
    type: 'room' as const,
    unitName: `Room ${room}`,
    identifier: room,
    clients: sortClients(initialRoomClients[room] ?? []),
  }))

  return [...shops, ...rooms]
}

export function unitSortKey(unit: RoomShopMapping): number {
  if (unit.type === 'shop') {
    const fromName = Number(unit.unitName.match(/\d+/)?.[0] ?? NaN)
    if (!Number.isNaN(fromName)) return fromName
  }
  const fromIdentifier = Number(
    unit.identifier.split(/[\n,]/)[0]?.match(/\d+/)?.[0] ?? NaN
  )
  if (!Number.isNaN(fromIdentifier)) return fromIdentifier
  const fromName = Number(unit.unitName.match(/\d+/)?.[0] ?? NaN)
  return Number.isNaN(fromName) ? Number.POSITIVE_INFINITY : fromName
}

export function sortClients(clients: ClientHistoryEntry[]): ClientHistoryEntry[] {
  return [...clients].sort((a, b) => {
    const exDiff = Number(!!a.isEx) - Number(!!b.isEx)
    if (exDiff !== 0) return exDiff
    return a.name.localeCompare(b.name)
  })
}

export function sortMapping(mapping: RoomShopMapping[]): RoomShopMapping[] {
  const shops = mapping
    .filter((unit) => unit.type === 'shop')
    .sort((a, b) => unitSortKey(a) - unitSortKey(b))
  const rooms = mapping
    .filter((unit) => unit.type === 'room')
    .sort((a, b) => unitSortKey(a) - unitSortKey(b))
  const other = mapping.filter((unit) => unit.type !== 'shop' && unit.type !== 'room')
  return [...shops, ...rooms, ...other]
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

export function mergeWithDefaults(stored: RoomShopMapping[]): RoomShopMapping[] {
  const defaults = defaultClientDatabase()
  const storedById = new Map(stored.map((unit) => [unit.id, unit]))
  const deprecatedSeedIds = new Set([
    'shop-5-vishali-mahendran',
    'shop-6-karthikeyan-a',
    'shop-2-123dentistryemerald',
    'shop-3-nirmala-devi',
    'shop-4-nathiya',
    'shop-5-saranya',
    'shop-6-saridha',
    'shop-mahitha-midhun',
    'room-308-suganya-s',
  ])
  const deprecatedUnitIds = new Set([
    'shop-6',
    'shop-7',
    'shop-8',
    'shop-9',
    'shop-10',
    'shop-mahitha',
    'shop-advance',
    'shop-rental',
    ...Array.from({ length: 10 }, (_, i) => `room-${503 + i}`),
  ])
  const shouldReplaceDeprecatedSeed = (unit: RoomShopMapping) =>
    unit.clients.some((entry) => deprecatedSeedIds.has(entry.id))

  const merged = defaults.map((defaultUnit) => {
    const storedUnit = storedById.get(defaultUnit.id)
    if (!storedUnit) return defaultUnit

    if (shouldReplaceDeprecatedSeed(storedUnit)) {
      const defaultClientIds = new Set(defaultUnit.clients.map((entry) => entry.id))
      const extras = storedUnit.clients.filter(
        (entry) =>
          !defaultClientIds.has(entry.id) && !deprecatedSeedIds.has(entry.id)
      )
      return { ...defaultUnit, clients: [...defaultUnit.clients, ...extras] }
    }

    const storedClientIds = new Set(storedUnit.clients.map((entry) => entry.id))
    const missingDefaultClients = defaultUnit.clients.filter(
      (entry) => !storedClientIds.has(entry.id)
    )
    return {
      ...defaultUnit,
      ...storedUnit,
      unitName: storedUnit.unitName || defaultUnit.unitName,
      identifier: storedUnit.identifier || defaultUnit.identifier,
      clients: [...storedUnit.clients, ...missingDefaultClients],
    }
  })
  const defaultIds = new Set(defaults.map((unit) => unit.id))
  const custom = stored.filter((unit) => !defaultIds.has(unit.id) && !deprecatedUnitIds.has(unit.id))
  return sortMapping([...merged, ...custom])
}

function migrateLegacyMapping(rows: unknown[]): RoomShopMapping[] {
  const migrated = defaultClientDatabase()

  for (const [index, raw] of rows.entries()) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as {
      type?: string
      identifier?: string
      customerName?: string
    }
    if (row.type !== 'shop' && row.type !== 'room') continue
    const identifier = String(row.identifier ?? '').trim()
    const name = String(row.customerName ?? '').trim()
    if (!identifier && !name) continue

    const existing = migrated.find(
      (unit) =>
        unit.type === row.type &&
        (unit.identifier.toLowerCase() === identifier.toLowerCase() ||
          unit.unitName.toLowerCase() === identifier.toLowerCase())
    )

    const entry = client(`legacy-${index}`, name || identifier, identifier || name)
    if (existing) {
      existing.clients = [...existing.clients, entry]
      continue
    }

    migrated.push({
      id: `legacy-${row.type}-${index}`,
      type: row.type,
      unitName:
        row.type === 'shop'
          ? `Shop ${migrated.filter((u) => u.type === 'shop').length + 1}`
          : `Room ${identifier}`,
      identifier,
      clients: [entry],
    })
  }

  return migrated
}

export function loadMappingFromStorage(): RoomShopMapping[] {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isClientDatabase(parsed)) return mergeWithDefaults(parsed)
    }

    const legacyRaw = localStorage.getItem(LEGACY_MAPPING_STORAGE_KEY)
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw)
      if (Array.isArray(legacyParsed)) return migrateLegacyMapping(legacyParsed)
    }

    return defaultClientDatabase()
  } catch {
    return defaultClientDatabase()
  }
}

export function saveMappingToStorage(mapping: RoomShopMapping[]) {
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping))
}

export function createEmptyClient(isEx = false): ClientHistoryEntry {
  return client(crypto.randomUUID(), '', '', isEx)
}

export function createCustomUnit(type: ClientUnitType, nextNumber: number): RoomShopMapping {
  return {
    id: crypto.randomUUID(),
    type,
    unitName: type === 'shop' ? `Shop ${nextNumber}` : `Room ${nextNumber}`,
    identifier: type === 'shop' ? `shop ${nextNumber}` : String(nextNumber),
    clients: [],
  }
}
