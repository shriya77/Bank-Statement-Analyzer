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
  /** Optional yyyy-mm-dd range so old clients still classify correctly in yearly files. */
  startDate: string
  endDate: string
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
  Amma: '#a855f7',
  Shop: '#f59e0b',
  House: '#06b6d4',
  'House Tax': '#f97316',
  'SKI Towers Maintenance': '#14b8a6',
  'Electricity Payment': '#eab308',
  Indu: '#ec4899',
  'Mutual Fund Purchase': '#0ea5e9',
  'Mutual Fund Sell': '#38bdf8',
  Others: '#94a3b8',
  HDFC: '#2563eb',
  Interest: '#84cc16',
  'Income Tax': '#60a5fa',
  Advertisement: '#f43f5e',
  Telephone: '#22d3ee',
  'Bank Charges': '#64748b',
  Room: '#22c55e',
}

const MAPPING_STORAGE_KEY = 'bank-statement-client-database'
const LEGACY_MAPPING_STORAGE_KEY = 'bank-statement-room-shop-mapping'

const roomNumbers = [
  '301',
  '207',
  '204',
  '310',
  '305',
  '208',
  '205',
  '409',
  '302',
  '304',
  '306',
  '502',
  '203',
  '211',
  '303',
  '410',
  '212',
  '405',
  '403',
  '308',
  '210',
  '407',
  '209',
  '201',
  '406',
  '411',
] as const

function client(id: string, name: string, aliases = name): ClientHistoryEntry {
  return {
    id,
    name,
    aliases,
    startDate: '',
    endDate: '',
  }
}

export function defaultClientDatabase(): RoomShopMapping[] {
  const shops: RoomShopMapping[] = [
    {
      id: 'shop-1',
      type: 'shop',
      unitName: 'Shop 1',
      identifier: 'shop 1',
      clients: [
        client(
          'shop-1-briyanipalayam',
          'BRIYANIPALAYAM',
          'BRIYANIPALAYAM\nBIRYANIPALAYAM\nBIRYANI PALAYAM\nSRS FOODS\nS R S FOODS\nSHABANA\nSHABANA PARVIN R'
        ),
      ],
    },
    {
      id: 'shop-2',
      type: 'shop',
      unitName: 'Shop 2',
      identifier: 'shop 2',
      clients: [client('shop-2-123dentistryemerald', '123DENTISTRYEMERALD')],
    },
    {
      id: 'shop-3',
      type: 'shop',
      unitName: 'Shop 3',
      identifier: 'shop 3',
      clients: [client('shop-3-nirmala-devi', 'NIRMALA DEVI', 'NIRMALA DEVI\nWELLDEVI1978')],
    },
    {
      id: 'shop-4',
      type: 'shop',
      unitName: 'Shop 4',
      identifier: 'shop 4',
      clients: [client('shop-4-nathiya', 'NATHIYA')],
    },
    {
      id: 'shop-5',
      type: 'shop',
      unitName: 'Shop 5',
      identifier: 'shop 5',
      clients: [client('shop-5-saranya', 'SARANYA')],
    },
    {
      id: 'shop-6',
      type: 'shop',
      unitName: 'Shop 6',
      identifier: 'shop 6',
      clients: [client('shop-6-saridha', 'SARIDHA', 'SARIDHA\nSANSARVA')],
    },
    {
      id: 'shop-mahitha',
      type: 'shop',
      unitName: 'Shop Mahitha',
      identifier: 'mahitha',
      clients: [client('shop-mahitha-midhun', 'Mahitha Midhun', 'MAHITHA MIDHUN\nMAHITHA')],
    },
    {
      id: 'shop-advance',
      type: 'shop',
      unitName: 'Shop Advance',
      identifier: 'shop advance',
      clients: [client('shop-advance', 'ADVANCE', 'SHOP ADVANCE\nADVANCE')],
    },
    {
      id: 'shop-rental',
      type: 'shop',
      unitName: 'Shop Rental',
      identifier: 'shop rental',
      clients: [client('shop-rental', 'RENTAL', 'SHOP RENTAL\nRENTAL')],
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
      client('room-211-a-karunanithi', 'A Karunanithi', 'A KARUNANITHI\nKARUNAMADURAI.2015'),
    ],
    '303': [
      client('room-303-gobinath-k', 'Gobinath K', 'GOBINATH K'),
    ],
    '410': [
      client('room-410-punithakumari-ravi', 'Punithakumari Ravi', 'PUNITHAKUMARI RAVI\n12PUNITHAPUNITHA'),
    ],
    '212': [
      client('room-212-ashwin-balakumar-sum', 'Ashwin Balakumar Sum', 'ASHWIN BALAKUMAR SUM\nASHWINBSA'),
    ],
    '405': [
      client('room-405-subash-k', 'Subash K', 'SUBASH K\nSUBASHPTJ282'),
    ],
    '403': [
      client('room-403-gowtham-ak', 'Gowtham Ak', 'GOWTHAM AK\n9360642935'),
    ],
    '308': [
      client('room-308-suganya-s', 'Suganya S', 'SUGANYA S\nDHANAVASHA'),
    ],
    '210': [
      client('room-210-k-karthik', 'K Karthik', 'K KARTHIK'),
    ],
    '407': [
      client('room-407-s-k-arun', 'S K Arun', 'S K ARUN\nARUN99THEBOSS'),
    ],
    '209': [
      client('room-209-arunachalam', 'Arunachalam', 'ARUNACHALAM\n9486271797'),
    ],
    '201': [
      client('room-201-baskaran-r', 'Baskaran R', 'BASKARAN R'),
    ],
    '406': [
      client('room-406-leveil-godson-a', 'Leveil Godson A', 'LEVEIL GODSON A\nGODSONKURUVILA4'),
    ],
    '411': [
      client('room-411-moosa-fayaz-m-p', 'Moosa Fayaz M P', 'MOOSA FAYAZ M P\nMPMOOSA22'),
      client('room-411-mr-muhammed-yaseen-k', 'Mr Muhammed Yaseen K', 'MR MUHAMMED YASEEN K\nYASEENYASU'),
      client('room-411-haseena-mumthas-c', 'Haseena Mumthas C', 'HASEENA MUMTHAS C\nMSAHAD242'),
    ],
  }

  const rooms = roomNumbers.map((room) => ({
    id: `room-${room}`,
    type: 'room' as const,
    unitName: `Room ${room}`,
    identifier: room,
    clients: initialRoomClients[room] ?? [],
  }))

  return [...shops, ...rooms]
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

function mergeWithDefaults(stored: RoomShopMapping[]): RoomShopMapping[] {
  const defaults = defaultClientDatabase()
  const storedById = new Map(stored.map((unit) => [unit.id, unit]))
  const deprecatedSeedIds = new Set([
    'shop-5-vishali-mahendran',
    'shop-6-karthikeyan-a',
  ])
  const deprecatedUnitIds = new Set(['shop-7', 'shop-8', 'shop-9', 'shop-10'])
  const shouldReplaceDeprecatedSeed = (unit: RoomShopMapping) =>
    unit.clients.some((entry) => deprecatedSeedIds.has(entry.id))

  const merged = defaults.map((defaultUnit) => {
    const storedUnit = storedById.get(defaultUnit.id)
    if (!storedUnit || shouldReplaceDeprecatedSeed(storedUnit)) return defaultUnit
    const storedClientIds = new Set(storedUnit.clients.map((entry) => entry.id))
    const missingDefaultClients = defaultUnit.clients.filter(
      (entry) => !storedClientIds.has(entry.id)
    )
    return {
      ...defaultUnit,
      ...storedUnit,
      clients: [...storedUnit.clients, ...missingDefaultClients],
    }
  })
  const defaultIds = new Set(defaults.map((unit) => unit.id))
  const custom = stored.filter((unit) => !defaultIds.has(unit.id) && !deprecatedUnitIds.has(unit.id))
  return [...merged, ...custom]
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

export function createEmptyClient(): ClientHistoryEntry {
  return client(crypto.randomUUID(), '', '')
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
