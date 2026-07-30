import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'

const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const IC = {
  table:       'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  plus:        'M12 5v14M5 12h14',
  calendar:    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clock:       'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2',
  users:       'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  check:       'M20 6L9 17l-5-5',
  trash:       'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  search:      'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  filter:      'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
}

const HOURS_LIST = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const PERIODS_LIST = ['AM', 'PM']
const MONTHS_LIST = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS_LIST = ['2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035']

const isMonthInPast = (yearStr, monthIdx) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const y = parseInt(yearStr)
  if (y < currentYear) return true
  if (y === currentYear && monthIdx < currentMonth) return true
  return false
}

const isDayInPast = (yearStr, monthIdx, dayStr) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()

  const y = parseInt(yearStr)
  const d = parseInt(dayStr)

  if (y < currentYear) return true
  if (y === currentYear && monthIdx < currentMonth) return true
  if (y === currentYear && monthIdx === currentMonth && d < currentDay) return true
  return false
}

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

const DEFAULT_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Table ${String(i + 1).padStart(2, '0')}`,
  capacity: 4,
  status: 'Available',
  currentBooking: null
}))

const Reservations = () => {
  const dateBtnRef = useRef(null)
  const timeBtnRef = useRef(null)
  const dayScrollRef = useRef(null)
  const monthScrollRef = useRef(null)
  const yearScrollRef = useRef(null)
  const hourScrollRef = useRef(null)
  const minuteScrollRef = useRef(null)

  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [datePopoverUpward, setDatePopoverUpward] = useState(false)
  const [tempDay, setTempDay] = useState(() => String(new Date().getDate()).padStart(2, '0'))
  const [tempMonth, setTempMonth] = useState(() => new Date().getMonth())
  const [tempYear, setTempYear] = useState(() => String(new Date().getFullYear()))

  const [popoverUpward, setPopoverUpward] = useState(false)

  const [tables, setTables] = useState(() => {
    const saved = localStorage.getItem('pos_tables_list')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((t) => ({ ...t }))
      } catch (e) {
        console.error(e)
      }
    }
    return DEFAULT_TABLES
  })

  const [reservations, setReservations] = useState(() => {
    const saved = localStorage.getItem('pos_reservations')
    return saved ? JSON.parse(saved) : []
  })

  const [showModal, setShowModal] = useState(false)
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false)
  const [tempHour, setTempHour] = useState('07')
  const [tempMinute, setTempMinute] = useState('00')
  const [tempPeriod, setTempPeriod] = useState('PM')
  const [selectedHour, setSelectedHour] = useState(null)
  const [selectedMinute, setSelectedMinute] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  const [selectedTable, setSelectedTable] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(0)
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    localStorage.setItem('pos_tables_list', JSON.stringify(tables))
  }, [tables])

  useEffect(() => {
    localStorage.setItem('pos_reservations', JSON.stringify(reservations))
  }, [reservations])

  useEffect(() => {
    const loadBackendReservations = async () => {
      try {
        const [tablesRes, resRes] = await Promise.allSettled([
          api.get('/tables'),
          api.get('/reservations'),
        ])
        if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value?.data) && tablesRes.value.data.length > 0) {
          const mappedTables = tablesRes.value.data.map((t, i) => {
            const rawNum = t && t.tableNumber ? String(t.tableNumber).trim() : `Table ${String(i + 1).padStart(2, '0')}`
            const safeName = rawNum.startsWith('Table') ? rawNum : `Table ${rawNum.padStart(2, '0')}`
            return {
              id: t._id || t.id || i + 1,
              name: safeName,
              capacity: 4,
              status: t.status === 'occupied' ? 'Occupied' : t.status === 'reserved' ? 'Reserved' : 'Available',
              dbId: t._id,
            }
          })
          setTables(mappedTables)
        }
        if (resRes.status === 'fulfilled' && Array.isArray(resRes.value?.data)) {
          const mappedRes = resRes.value.data.map((r) => ({
            id: r._id || r.id,
            _id: r._id,
            tableName: r.tableName || 'Table 01',
            guestName: r.guestName || 'Guest',
            phone: r.phone || '',
            date: r.date || '',
            time: r.time || '',
            partySize: r.partySize || 1,
            tablesCount: r.tablesCount || 1,
            status: r.status || 'Confirmed',
          }))
          setReservations(mappedRes)
        }
      } catch (err) {
        console.error('Failed to load reservations from backend:', err)
      }
    }
    loadBackendReservations()
  }, [])

  useEffect(() => {
    if (showCustomDatePicker) {
      setTimeout(() => {
        ;[dayScrollRef, monthScrollRef, yearScrollRef].forEach((ref) => {
          if (ref.current) {
            const activeChild = ref.current.querySelector('.bg-yellow-400, .bg-zinc-900')
            if (activeChild) {
              activeChild.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          }
        })
      }, 60)
    }
  }, [showCustomDatePicker])

  useEffect(() => {
    if (showCustomTimePicker) {
      setTimeout(() => {
        ;[hourScrollRef, minuteScrollRef].forEach((ref) => {
          if (ref.current) {
            const activeChild = ref.current.querySelector('.bg-yellow-400')
            if (activeChild) {
              activeChild.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          }
        })
      }, 60)
    }
  }, [showCustomTimePicker])

  const totalTables = tables.length
  const availableCount = tables.filter((t) => t.status === 'Available').length
  const reservedCount = tables.filter((t) => t.status === 'Reserved').length
  const occupiedCount = tables.filter((t) => t.status === 'Occupied').length

  const resetForm = () => {
    const now = new Date()
    const todayDay = String(now.getDate()).padStart(2, '0')
    const todayMonth = now.getMonth()
    const todayYear = String(now.getFullYear())

    setSelectedTable('')
    setGuestName('')
    setGuestPhone('')
    setDate('')
    setTime('')
    setPartySize(0)
    setShowCustomDatePicker(false)
    setShowCustomTimePicker(false)
    setDatePopoverUpward(false)
    setPopoverUpward(false)
    setTempDay(todayDay)
    setTempMonth(todayMonth)
    setTempYear(todayYear)
    setTempHour('07')
    setTempMinute('00')
    setTempPeriod('PM')
    setSelectedHour(null)
    setSelectedMinute(null)
    setSelectedPeriod(null)
  }

  const updateDateAndApply = (y, mIdx, d) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()

    let finalYear = y
    let finalMonthIdx = mIdx
    let finalDay = d

    if (parseInt(finalYear) === currentYear && finalMonthIdx < currentMonth) {
      finalMonthIdx = currentMonth
    }

    if (parseInt(finalYear) === currentYear && finalMonthIdx === currentMonth && parseInt(finalDay) < currentDay) {
      finalDay = String(currentDay).padStart(2, '0')
    }

    setTempYear(finalYear)
    setTempMonth(finalMonthIdx)
    setTempDay(finalDay)

    const formattedMonth = String(finalMonthIdx + 1).padStart(2, '0')
    const dateStr = `${finalYear}-${formattedMonth}-${finalDay}`
    setDate(dateStr)
  }

  const handleSelectHour = (h) => {
    setTempHour(h)
    setSelectedHour(h)
    if (selectedMinute !== null && selectedPeriod !== null) {
      const formatted = `${h}:${selectedMinute} ${selectedPeriod}`
      setTime(formatted)
      setShowCustomTimePicker(false)
    }
  }

  const handleSelectMinute = (m) => {
    setTempMinute(m)
    setSelectedMinute(m)
    if (selectedHour !== null && selectedPeriod !== null) {
      const formatted = `${selectedHour}:${m} ${selectedPeriod}`
      setTime(formatted)
      setShowCustomTimePicker(false)
    }
  }

  const handleSelectPeriod = (p) => {
    setTempPeriod(p)
    setSelectedPeriod(p)
    if (selectedHour !== null && selectedMinute !== null) {
      const formatted = `${selectedHour}:${selectedMinute} ${p}`
      setTime(formatted)
      setShowCustomTimePicker(false)
    }
  }

  const toggleDatePicker = () => {
    if (!showCustomDatePicker) {
      setShowCustomTimePicker(false)
      if (dateBtnRef.current) {
        const rect = dateBtnRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < 250) {
          setDatePopoverUpward(true)
        } else {
          setDatePopoverUpward(false)
        }
      }
      const now = new Date()
      const todayDay = String(now.getDate()).padStart(2, '0')
      const todayMonth = now.getMonth()
      const todayYear = String(now.getFullYear())

      if (date && date.includes('-')) {
        const [y, m, d] = date.split('-')
        if (y && m && d) {
          setTempYear(y)
          setTempMonth(parseInt(m) - 1)
          setTempDay(d)
        }
      } else {
        setTempDay(todayDay)
        setTempMonth(todayMonth)
        setTempYear(todayYear)
      }
    }
    setShowCustomDatePicker((prev) => !prev)
  }

  const toggleTimePicker = () => {
    if (!showCustomTimePicker) {
      setShowCustomDatePicker(false)
      if (timeBtnRef.current) {
        const rect = timeBtnRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < 250) {
          setPopoverUpward(true)
        } else {
          setPopoverUpward(false)
        }
      }
      if (time && time.includes(':') && (time.includes('AM') || time.includes('PM'))) {
        const [hMin, p] = time.split(' ')
        const [h, m] = hMin.split(':')
        if (h && m && p) {
          const hPadded = h.padStart(2, '0')
          const mPadded = m.padStart(2, '0')
          setTempHour(hPadded)
          setTempMinute(mPadded)
          setTempPeriod(p)
          setSelectedHour(hPadded)
          setSelectedMinute(mPadded)
          setSelectedPeriod(p)
        }
      } else {
        setSelectedHour(null)
        setSelectedMinute(null)
        setSelectedPeriod(null)
      }
    }
    setShowCustomTimePicker((prev) => !prev)
  }

  const handleOpenModal = (tableName = '') => {
    resetForm()
    if (tableName) {
      setSelectedTable(tableName)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleCreateReservation = async (e) => {
    e.preventDefault()
    const numGuests = parseInt(partySize) || 0
    if (!guestName.trim() || !guestPhone.trim() || !selectedTable || !time || !date) return

    if (numGuests <= 0) {
      alert('Please enter a valid guest count (at least 1 guest).')
      return
    }

    const reqTablesCount = Math.ceil(numGuests / 4)

    const startIdx = tables.findIndex((t) => t.name === selectedTable)
    if (startIdx === -1) return

    // Find N available tables starting from selectedTable
    const availableTablesList = []
    for (let i = startIdx; i < tables.length && availableTablesList.length < reqTablesCount; i++) {
      if (tables[i].status === 'Available') {
        availableTablesList.push(tables[i].name)
      }
    }
    for (let i = 0; i < startIdx && availableTablesList.length < reqTablesCount; i++) {
      if (tables[i].status === 'Available') {
        availableTablesList.push(tables[i].name)
      }
    }

    if (availableTablesList.length < reqTablesCount) {
      alert(`Cannot book party of ${numGuests} guests: requires ${reqTablesCount} available tables (4 seats each), but only ${availableTablesList.length} free tables are available.`)
      return
    }

    const allocatedNamesStr = availableTablesList.join(', ')

    try {
      const payload = {
        tableName: allocatedNamesStr,
        guestName: guestName.trim(),
        phone: guestPhone.trim(),
        date,
        time,
        partySize: numGuests,
        tablesCount: reqTablesCount,
      }
      const res = await api.post('/reservations', payload)

      const newRes = {
        id: res.data._id || `RES-${Date.now().toString().slice(-4)}`,
        _id: res.data._id,
        tableName: allocatedNamesStr,
        tableNames: availableTablesList,
        guestName: guestName.trim(),
        phone: guestPhone.trim(),
        date,
        time,
        partySize: numGuests,
        tablesCount: reqTablesCount,
        status: 'Confirmed',
      }

      setReservations((prev) => [newRes, ...prev])

      setTables((prev) =>
        prev.map((t) =>
          availableTablesList.includes(t.name)
            ? {
                ...t,
                status: 'Reserved',
                currentBooking: {
                  guest: guestName.trim(),
                  phone: guestPhone.trim(),
                  time,
                  guests: numGuests,
                  resId: newRes.id,
                  tableNames: availableTablesList,
                },
              }
            : t
        )
      )
    } catch (err) {
      console.error('Failed to create reservation on backend:', err)
    }

    handleCloseModal()
  }

  const updateTableStatus = async (tableId, newStatus) => {
    const targetTable = tables.find(
      (t) => t.id === tableId || t.dbId === tableId || t._id === tableId || t.name === tableId || t.tableNumber === tableId
    )

    const rawId = targetTable?.dbId || targetTable?._id || (typeof tableId === 'string' && /^[0-9a-fA-F]{24}$/.test(tableId) ? tableId : null) || targetTable?.name || targetTable?.tableNumber || tableId
    const apiStatus = newStatus === 'Occupied' ? 'occupied' : newStatus === 'Reserved' ? 'reserved' : 'available'

    if (rawId) {
      const cleanId = String(rawId).trim()
      try {
        await api.patch(`/tables/${encodeURIComponent(cleanId)}/status`, { status: apiStatus })
      } catch (err) {
        try {
          await api.put(`/tables/${encodeURIComponent(cleanId)}/status`, { status: apiStatus })
        } catch (err2) {
          console.error('Failed to update table status on backend:', err2)
        }
      }
    }

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId || t.dbId === tableId || t._id === tableId || t.name === tableId || t.tableNumber === tableId
          ? { ...t, status: newStatus, currentBooking: newStatus === 'Available' ? null : t.currentBooking }
          : t
      )
    )

    window.dispatchEvent(new Event('pos:table-updated'))
    window.dispatchEvent(new Event('pos:data-updated'))
  }

  const handleMarkArrived = async (resId) => {
    const targetRes = reservations.find((r) => r.id === resId || r._id === resId)
    if (!targetRes) return

    const dbId = targetRes._id || targetRes.id
    if (dbId && typeof dbId === 'string' && dbId.length === 24) {
      try {
        await api.patch(`/reservations/${dbId}/status`, { status: 'Arrived' })
      } catch (err) {
        console.error('Failed to update reservation status on backend:', err)
      }
    }

    const names = targetRes.tableNames || (targetRes.tableName ? targetRes.tableName.split(', ').map((s) => s.trim()) : [])

    for (const name of names) {
      if (name) {
        try {
          await api.patch(`/tables/${encodeURIComponent(name)}/status`, { status: 'occupied' })
        } catch (e) {
          console.warn('Table arrival patch warning:', e)
        }
      }
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === resId || r._id === resId ? { ...r, status: 'Arrived' } : r))
    )

    setTables((prev) =>
      prev.map((t) =>
        names.includes(t.name) || t.name === targetRes.tableName
          ? {
              ...t,
              status: 'Occupied',
              currentBooking: {
                guest: targetRes.guestName,
                phone: targetRes.phone,
                time: targetRes.time,
                guests: targetRes.partySize,
                resId: targetRes.id,
                tableNames: names,
              },
            }
          : t
      )
    )

    window.dispatchEvent(new Event('pos:table-updated'))
    window.dispatchEvent(new Event('pos:data-updated'))
  }

  const handleCancelReservation = async (resId) => {
    const targetRes = reservations.find((r) => r.id === resId || r._id === resId)
    if (!targetRes) return

    const dbId = targetRes._id || targetRes.id
    if (dbId && typeof dbId === 'string' && dbId.length === 24) {
      try {
        await api.patch(`/reservations/${dbId}/status`, { status: 'Cancelled' })
      } catch (err) {
        console.error('Failed to cancel reservation on backend:', err)
      }
    }

    const names = targetRes.tableNames || (targetRes.tableName ? targetRes.tableName.split(', ').map((s) => s.trim()) : [])

    for (const name of names) {
      if (name) {
        try {
          await api.patch(`/tables/${encodeURIComponent(name)}/status`, { status: 'available' })
        } catch (e) {
          console.warn('Table cancel patch warning:', e)
        }
      }
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === resId || r._id === resId ? { ...r, status: 'Cancelled' } : r))
    )

    setTables((prev) =>
      prev.map((t) => {
        if (names.includes(t.name) || t.name === targetRes.tableName || t.currentBooking?.resId === resId) {
          return { ...t, status: 'Available', currentBooking: null }
        }
        return t
      })
    )

    window.dispatchEvent(new Event('pos:table-updated'))
    window.dispatchEvent(new Event('pos:data-updated'))
  }

  const handleMarkCompleted = async (resId) => {
    const targetRes = reservations.find((r) => r.id === resId || r._id === resId)
    if (!targetRes) return

    const dbId = targetRes._id || targetRes.id
    if (dbId && typeof dbId === 'string' && dbId.length === 24) {
      try {
        await api.patch(`/reservations/${dbId}/status`, { status: 'Completed' })
      } catch (err) {
        console.error('Failed to complete reservation on backend:', err)
      }
    }

    const names = targetRes.tableNames || (targetRes.tableName ? targetRes.tableName.split(', ').map((s) => s.trim()) : [])

    for (const name of names) {
      if (name) {
        try {
          await api.patch(`/tables/${encodeURIComponent(name)}/status`, { status: 'available' })
        } catch (e) {
          console.warn('Table complete patch warning:', e)
        }
      }
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === resId || r._id === resId ? { ...r, status: 'Completed' } : r))
    )

    setTables((prev) =>
      prev.map((t) => {
        if (names.includes(t.name) || t.name === targetRes.tableName || t.currentBooking?.resId === resId) {
          return { ...t, status: 'Available', currentBooking: null }
        }
        return t
      })
    )

    window.dispatchEvent(new Event('pos:table-updated'))
    window.dispatchEvent(new Event('pos:data-updated'))
  }

  const filteredReservations = reservations.filter((r) => {
    const isUpcoming = r.status === 'Confirmed' || r.status === 'Pending'
    const matchesSearch =
      r.guestName.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      r.tableName.toLowerCase().includes(search.toLowerCase())
    return isUpcoming && matchesSearch
  })

  return (
    <div className="flex flex-1 flex-col overflow-y-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Table &amp; Reservations</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">Manage café table layout, live floor occupancy &amp; advance bookings</p>
        </div>
        <button
          onClick={() => handleOpenModal('')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition active:scale-95 shrink-0 cursor-pointer"
        >
          <Icon d={IC.plus} size={15} />
          <span>New Reservation</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tables</span>
            <Icon d={IC.table} size={18} className="text-yellow-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{totalTables}</p>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Seating capacity ready</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-green-700">
            <span className="text-xs font-bold uppercase tracking-wider">Available</span>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
          <p className="text-2xl font-black text-green-900 mt-2">{availableCount}</p>
          <p className="text-[10px] font-semibold text-green-700 mt-0.5">Open for walk-ins</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Reserved</span>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2">{reservedCount}</p>
          <p className="text-[10px] font-semibold text-amber-700 mt-0.5">Booked for today</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-xs font-bold uppercase tracking-wider">Occupied</span>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
          <p className="text-2xl font-black text-red-900 mt-2">{occupiedCount}</p>
          <p className="text-[10px] font-semibold text-red-700 mt-0.5">Guests dining now</p>
        </div>
      </div>

      {/* Floor Table Grid View */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <span>🪑</span>
          <span>Live Floor Seating Grid</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition ${
                t.status === 'Available'
                  ? 'border-green-200 bg-green-50/30'
                  : t.status === 'Reserved'
                  ? 'border-amber-200 bg-amber-50/40'
                  : 'border-red-200 bg-red-50/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900">{t.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    t.status === 'Available' ? 'bg-green-100 text-green-800' : t.status === 'Reserved' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-gray-400 mt-1">👥 {t.capacity} Seats</p>
                {t.currentBooking && (
                  <div className="mt-2 text-[10px] text-gray-600 bg-white p-1.5 rounded border border-gray-100 shadow-xs">
                    <p className="font-bold truncate">{t.currentBooking.guest}</p>
                    {t.currentBooking.tableNames && t.currentBooking.tableNames.length > 1 && (
                      <span className="inline-block my-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[8px] px-1 py-0.2 border border-purple-100">
                        Party Group ({t.currentBooking.tableNames.length} Tables)
                      </span>
                    )}
                    <p className="text-gray-400">🕒 {t.currentBooking.time}</p>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1 pt-2 border-t border-gray-200/50">
                {t.status === 'Available' ? (
                  <>
                    <button
                      onClick={() => updateTableStatus(t.id, 'Occupied')}
                      className="rounded bg-zinc-900 py-1 text-[9px] font-bold text-white hover:bg-black transition cursor-pointer"
                    >
                      Sit Guest
                    </button>
                    <button
                      onClick={() => handleOpenModal(t.name)}
                      className="rounded bg-yellow-400 py-1 text-[9px] font-extrabold text-zinc-900 hover:bg-yellow-500 transition cursor-pointer"
                    >
                      Reserve
                    </button>
                  </>
                ) : t.status === 'Reserved' ? (
                  <>
                    <button
                      onClick={() => {
                        const res = reservations.find(
                          (r) =>
                            (r.tableNames ? r.tableNames.includes(t.name) : r.tableName?.includes(t.name)) &&
                            (r.status === 'Confirmed' || r.status === 'Pending')
                        )
                        if (res) handleMarkArrived(res.id)
                        else updateTableStatus(t.id, 'Occupied')
                      }}
                      className="rounded bg-emerald-600 py-1 text-[9px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Arrived
                    </button>
                    <button
                      onClick={() => {
                        const res = reservations.find(
                          (r) =>
                            (r.tableNames ? r.tableNames.includes(t.name) : r.tableName?.includes(t.name)) &&
                            (r.status === 'Confirmed' || r.status === 'Pending')
                        )
                        if (res) handleCancelReservation(res.id)
                        else updateTableStatus(t.id, 'Available')
                      }}
                      className="rounded border border-red-200 bg-red-50 py-1 text-[9px] font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  (() => {
                    const linkedRes = reservations.find(
                      (r) =>
                        (r.tableNames ? r.tableNames.includes(t.name) : r.tableName?.includes(t.name)) &&
                        (r.status === 'Arrived' || r.status === 'Confirmed')
                    )
                    if (linkedRes) {
                      return (
                        <button
                          onClick={() => handleMarkCompleted(linkedRes.id)}
                          className="col-span-2 rounded bg-blue-600 py-1 text-[9px] font-bold text-white hover:bg-blue-700 transition cursor-pointer"
                        >
                          Complete
                        </button>
                      )
                    }
                    return (
                      <button
                        onClick={() => updateTableStatus(t.id, 'Available')}
                        className="col-span-2 rounded border border-gray-300 bg-white py-1 text-[9px] font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                      >
                        Clear Table
                      </button>
                    )
                  })()
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reservation Log Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <span>📅</span>
              <span>Upcoming Active Reservations</span>
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 ml-1">
                {filteredReservations.length} Active
              </span>
            </h2>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5">
              Showing active &amp; pending bookings. Arrived, completed &amp; cancelled entries are archived in Reports.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs">
              <Icon d={IC.search} size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search guest or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-xs text-gray-800"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-2.5 px-3">Table</th>
                <th className="py-2.5 px-3">Guest Name</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Party Size</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
              {filteredReservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-2.5 px-3 font-bold text-yellow-700">{r.tableName}</td>
                  <td className="py-2.5 px-3 font-bold text-gray-900">{r.guestName}</td>
                  <td className="py-2.5 px-3 text-gray-500">{r.phone}</td>
                  <td className="py-2.5 px-3 text-gray-600">{formatDateDDMMYYYY(r.date)} • {r.time}</td>
                  <td className="py-2.5 px-3 text-gray-700">👥 {r.partySize} Guests</td>
                  <td className="py-2.5 px-3">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                      r.status === 'Confirmed'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : r.status === 'Arrived'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-gray-400 text-xs">
                    No reservations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto min-h-screen py-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal()
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 relative my-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-extrabold text-gray-900">Create Table Reservation</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 font-extrabold text-sm p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Book a table slot for advance dining</p>

            <form onSubmit={handleCreateReservation} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">Select Table</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400 cursor-pointer"
                  required
                >
                  <option value="">-- Pick Table --</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.name}>{t.name} ({t.capacity} Seats - {t.status})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">
                    Date <span className="text-[9px] font-semibold text-gray-400 font-mono">(DD/MM/YYYY)</span>
                  </label>
                  <button
                    ref={dateBtnRef}
                    type="button"
                    onClick={toggleDatePicker}
                    className="w-full text-left rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-yellow-400 cursor-pointer select-none flex items-center justify-between transition hover:bg-gray-100/80"
                  >
                    <span className={date ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}>
                      {date ? formatDateDDMMYYYY(date) : 'DD/MM/YYYY'}
                    </span>
                    <span className="text-gray-400 text-xs">📅</span>
                  </button>

                  {showCustomDatePicker && (
                    <div className={`absolute left-0 right-0 sm:right-auto sm:w-72 z-[100] rounded-2xl bg-white p-3 shadow-2xl border border-gray-100 space-y-3 animate-in fade-in zoom-in-95 duration-150 ${datePopoverUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                          <span>📅</span>
                          <span>Select Date</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCustomDatePicker(false)}
                          className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center select-none">
                        {/* Day Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Day</span>
                          <div ref={dayScrollRef} className="h-40 overflow-y-auto space-y-1 rounded-xl bg-gray-50/80 p-1 border border-gray-100 scrollbar-thin">
                            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => {
                              const isPast = isDayInPast(tempYear, tempMonth, d)
                              const isSelected = tempDay === d
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  disabled={isPast}
                                  onClick={() => {
                                    updateDateAndApply(tempYear, tempMonth, d)
                                    setShowCustomDatePicker(false)
                                  }}
                                  className={`w-full py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                    isPast
                                      ? 'opacity-30 cursor-not-allowed text-gray-400 bg-gray-100/50'
                                      : isSelected
                                      ? 'bg-yellow-400 text-zinc-900 shadow-xs scale-105'
                                      : 'text-gray-600 hover:bg-gray-200/60'
                                  }`}
                                >
                                  {d}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Month Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Month</span>
                          <div ref={monthScrollRef} className="h-40 overflow-y-auto space-y-1 rounded-xl bg-gray-50/80 p-1 border border-gray-100 scrollbar-thin">
                            {MONTHS_LIST.map((mName, mIdx) => {
                              const isPast = isMonthInPast(tempYear, mIdx)
                              const isSelected = tempMonth === mIdx
                              return (
                                <button
                                  key={mName}
                                  type="button"
                                  disabled={isPast}
                                  onClick={() => {
                                    updateDateAndApply(tempYear, mIdx, tempDay)
                                  }}
                                  className={`w-full py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                    isPast
                                      ? 'opacity-30 cursor-not-allowed text-gray-400 bg-gray-100/50'
                                      : isSelected
                                      ? 'bg-yellow-400 text-zinc-900 shadow-xs scale-105'
                                      : 'text-gray-600 hover:bg-gray-200/60'
                                  }`}
                                >
                                  {mName}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Year Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Year</span>
                          <div ref={yearScrollRef} className="h-40 overflow-y-auto space-y-1 rounded-xl bg-gray-50/80 p-1 border border-gray-100 scrollbar-thin">
                            {YEARS_LIST.map((y) => (
                              <button
                                key={y}
                                type="button"
                                onClick={() => {
                                  updateDateAndApply(y, tempMonth, tempDay)
                                }}
                                className={`w-full py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                  tempYear === y
                                    ? 'bg-zinc-900 text-white shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200/60'
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">
                    Time <span className="text-[9px] font-semibold text-gray-400 font-mono">(12h AM/PM)</span>
                  </label>
                  <button
                    ref={timeBtnRef}
                    type="button"
                    onClick={toggleTimePicker}
                    className="w-full text-left rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-yellow-400 cursor-pointer select-none flex items-center justify-between transition hover:bg-gray-100/80"
                  >
                    <span className={time ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}>
                      {time || '00:00 AM/PM'}
                    </span>
                    <span className="text-gray-400 text-xs">🕒</span>
                  </button>

                  {showCustomTimePicker && (
                    <div className={`absolute left-0 sm:-left-12 right-0 sm:right-auto sm:w-72 z-50 rounded-2xl bg-white p-3 shadow-2xl border border-gray-100 space-y-3 animate-in fade-in zoom-in-95 duration-150 ${popoverUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                          <span>🕒</span>
                          <span>Select Time</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCustomTimePicker(false)}
                          className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center select-none">
                        {/* Hours Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Hour</span>
                          <div ref={hourScrollRef} className="h-40 overflow-y-auto space-y-1 rounded-xl bg-gray-50/80 p-1 border border-gray-100 scrollbar-thin">
                            {HOURS_LIST.map((h) => (
                              <button
                                key={h}
                                type="button"
                                onClick={() => handleSelectHour(h)}
                                className={`w-full py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                  tempHour === h
                                    ? 'bg-yellow-400 text-zinc-900 shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200/60'
                                }`}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Minutes Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Minute</span>
                          <div ref={minuteScrollRef} className="h-40 overflow-y-auto space-y-1 rounded-xl bg-gray-50/80 p-1 border border-gray-100 scrollbar-thin">
                            {MINUTES_LIST.map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleSelectMinute(m)}
                                className={`w-full py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                  tempMinute === m
                                    ? 'bg-yellow-400 text-zinc-900 shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200/60'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* AM/PM Column */}
                        <div>
                          <span className="block text-[9px] font-extrabold uppercase text-gray-400 mb-1">Period</span>
                          <div className="flex flex-col gap-1.5 rounded-xl bg-gray-50/80 p-1 border border-gray-100">
                            {PERIODS_LIST.map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleSelectPeriod(p)}
                                className={`w-full py-3 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                                  tempPeriod === p
                                    ? 'bg-zinc-900 text-white shadow-xs'
                                    : 'text-gray-600 hover:bg-gray-200/60'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1">Guests</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={partySize === 0 ? '' : partySize}
                    onChange={(e) => setPartySize(e.target.value === '' ? 0 : parseInt(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400"
                    required
                  />
                </div>
              </div>

              {parseInt(partySize) > 4 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] font-semibold text-amber-900 flex items-start gap-2">
                  <span className="text-sm shrink-0">💡</span>
                  <div>
                    <p className="font-bold">Multi-Table Auto-Allocation</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">
                      A party of {partySize} guests requires <strong className="font-extrabold text-amber-900">{Math.ceil(parseInt(partySize) / 4)} tables</strong> (4 seats per table). The system will automatically allocate {Math.ceil(parseInt(partySize) / 4)} available tables starting from {selectedTable || 'the selected table'}.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 hover:bg-yellow-500 shadow-md transition active:scale-95 cursor-pointer"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default Reservations
