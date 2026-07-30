import { useState, useMemo, useEffect } from 'react'
import api from '../../services/api'

const ICON_USER = "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z"
const ICON_PHONE = "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
const ICON_CALENDAR = "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z M16 2v4 M8 2v4 M3 10h18"
const ICON_MONEY = "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
const ICON_CLOSE = "M18 6L6 18M6 6l12 12"
const ICON_SEARCH = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
const ICON_TRASH = "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
const ICON_EDIT = "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"

const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const Customer = () => {
  const [customers, setCustomers] = useState([])
  const [activeTab, setActiveTab] = useState('registered')
  const [activeTokensMap, setActiveTokensMap] = useState(new Map())
  const [draftsList, setDraftsList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  // Edit / Delete states
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [customerToDelete, setCustomerToDelete] = useState(null)

  const isUnregistered = (c) => (c.phone || '').startsWith('WALK-') || c.phone === '9000000000' || /walk-in/i.test(c.name || '')
  const registeredCount = useMemo(() => customers.filter((c) => !isUnregistered(c)).length, [customers])
  const unregisteredCount = useMemo(() => customers.filter((c) => isUnregistered(c)).length, [customers])
  const allCount = customers.length

  // Load CRM customers from backend API
  const loadCRMData = async () => {
    try {
      const res = await api.get('/customers')
      const normalized = res.data.map((c) => ({
        id: c._id,
        _id: c._id,
        name: c.name,
        phone: c.phone,
        createdAt: new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        lifetimeSpend: Number(c.lifetimeSpend || 0),
        visits: Number(c.visits || c.lifetimeOrders || 0),
        orderHistory: Array.isArray(c.orderHistory) ? c.orderHistory : [],
      }))
      setCustomers(normalized)
    } catch (err) {
      console.error('Failed to fetch CRM customers from backend:', err)
    }
  }

  useEffect(() => {
    loadCRMData()
  }, [])

  useEffect(() => {
    if (editingCustomer) {
      setEditName(editingCustomer.name)
      setEditPhone(editingCustomer.phone)
    } else {
      setEditName('')
      setEditPhone('')
    }
  }, [editingCustomer])

  // Filter customers by active tab and query
  const filteredCustomers = useMemo(() => {
    let list = customers
    if (activeTab === 'registered') {
      list = customers.filter((c) => !isUnregistered(c))
    } else if (activeTab === 'unregistered') {
      list = customers.filter((c) => isUnregistered(c))
    }

    const query = searchQuery.toLowerCase().trim()
    if (!query) return list
    return list.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query)
    )
  }, [customers, activeTab, searchQuery])

  // Aggregate global CRM statistics
  const stats = useMemo(() => {
    const totalCount = customers.length
    let totalRevenue = 0
    let totalOrdersCount = 0
    let topSpender = { name: 'N/A', spend: 0 }

    customers.forEach((c) => {
      const history = Array.isArray(c.orderHistory) ? c.orderHistory : []
      const historySpend = history.reduce((sum, order) => sum + (Number(order.total || 0)), 0)
      const customerSpend = Math.max(Number(c.lifetimeSpend || 0), historySpend)
      const customerOrdersCount = Math.max(Number(c.visits || c.lifetimeOrders || 0), history.length)

      totalRevenue += customerSpend
      totalOrdersCount += customerOrdersCount

      if (customerSpend > topSpender.spend) {
        topSpender = { name: c.name, spend: customerSpend }
      }
    })

    const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : (totalCount > 0 ? totalRevenue / totalCount : 0)

    return {
      totalCount,
      totalRevenue,
      avgOrderValue,
      topSpender
    }
  }, [customers])

  // Check customer indicators
  const getCustomerStatus = (phone) => {
    const cleanPhone = phone.trim()
    if (!cleanPhone) return { hasActiveToken: false, hasDraft: false }

    let hasActiveToken = false
    let activeTokenNum = null
    for (const [tokenNum, slot] of activeTokensMap.entries()) {
      if ((slot.customerPhone ?? '').trim() === cleanPhone && (slot.cart ?? []).length > 0) {
        hasActiveToken = true
        activeTokenNum = tokenNum
        break
      }
    }

    const matchedDraft = draftsList.find((d) => (d.customerPhone ?? '').trim() === cleanPhone)
    const hasDraft = !!matchedDraft

    return { hasActiveToken, activeTokenNum, hasDraft, draftId: matchedDraft?.id }
  }

  // Deletion Confirm Handler (Backend + Frontend Sync)
  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return
    const targetId = customerToDelete._id || customerToDelete.id
    try {
      if (targetId && typeof targetId === 'string' && targetId.length === 24) {
        await api.delete(`/customers/${targetId}`)
      }
    } catch (err) {
      console.error('Failed to delete customer on backend:', err)
    }

    const updated = customers.filter((c) => (c._id || c.id) !== targetId)
    setCustomers(updated)
    localStorage.setItem('crm_customers', JSON.stringify(updated))
    setCustomerToDelete(null)
    
    // Close detail modal if the deleted customer was open
    if (selectedCustomer && (selectedCustomer._id || selectedCustomer.id) === targetId) {
      setSelectedCustomer(null)
    }
  }

  // Save profile changes (Backend + Frontend Sync)
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editName.trim() || !editPhone.trim() || !editingCustomer) {
      alert("Name and Phone number are required")
      return
    }

    const targetId = editingCustomer._id || editingCustomer.id
    const payload = {
      name: editName.trim(),
      phone: editPhone.trim(),
    }

    try {
      if (targetId && typeof targetId === 'string' && targetId.length === 24) {
        await api.put(`/customers/${targetId}`, payload)
      }
    } catch (err) {
      console.error('Failed to update customer on backend:', err)
    }

    const updated = customers.map((c) => {
      if ((c._id || c.id) === targetId) {
        return {
          ...c,
          name: payload.name,
          phone: payload.phone
        }
      }
      return c
    })

    setCustomers(updated)
    localStorage.setItem('crm_customers', JSON.stringify(updated))
    
    // Sync active views
    if (selectedCustomer && (selectedCustomer._id || selectedCustomer.id) === targetId) {
      setSelectedCustomer({
        ...selectedCustomer,
        name: payload.name,
        phone: payload.phone
      })
    }
    setEditingCustomer(null)
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-hidden">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Customer Directory (CRM)</h1>
        <p className="text-sm text-zinc-500">Track profiles, purchase frequency, and active POS billing statuses</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total CRM Profiles</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900">{allCount}</span>
              <span className="text-xs text-zinc-500 font-bold">Total</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold border-t border-zinc-100 pt-2">
            <span className="text-green-600 font-extrabold">{registeredCount} Registered</span>
            <span className="text-zinc-300">•</span>
            <span className="text-amber-600 font-extrabold">{unregisteredCount} Unregistered</span>
          </div>
        </div>

        {/* Lifetime Revenue */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">CRM Lifetime Spend</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">₹{stats.totalRevenue.toFixed(2)}</span>
            <span className="text-xs text-zinc-400 font-bold">from billing sync</span>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Avg. Order Value (AOV)</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">₹{stats.avgOrderValue.toFixed(2)}</span>
            <span className="text-xs text-zinc-400 font-bold">per ticket</span>
          </div>
        </div>

        {/* Top Spender */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Top CRM Customer</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="truncate text-lg font-bold text-zinc-900 max-w-[150px] inline-block">{stats.topSpender.name}</span>
            <span className="text-xs text-green-600 font-extrabold shrink-0">₹{stats.topSpender.spend.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Main Table Section Card */}
      <div className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-md overflow-hidden">
        
        {/* Search & Tab Navigation Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 border border-zinc-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('registered')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'registered' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Registered ({registeredCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unregistered')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'unregistered' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Unregistered ({unregisteredCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                All Profiles ({allCount})
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 w-full sm:w-64">
              <Icon d={ICON_SEARCH} size={15} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>
          <div className="text-xs font-semibold text-zinc-500">
            Showing {filteredCustomers.length} of {customers.length} profiles
          </div>
        </div>

        {/* Customers Table container */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredCustomers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 py-16 text-center">
              <span className="text-3xl">👥</span>
              <p className="text-sm font-bold text-zinc-500">No customers found</p>
              <p className="text-xs text-zinc-400 max-w-[280px]">Add order details with phone numbers inside the POS checkout panel to track customers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:contents md:space-y-0">
              
              {/* Desktop headers */}
              <div className="hidden md:grid md:grid-cols-[2fr_1.1fr_1fr_1.1fr_1.3fr_1.5fr] md:gap-4 md:border-b md:border-zinc-100 md:pb-3 md:text-xs md:font-bold md:uppercase md:tracking-wider md:text-zinc-400">
                <div>Customer Info</div>
                <div>Member Since</div>
                <div className="text-center">Total Orders</div>
                <div className="text-right">Lifetime Spend</div>
                <div className="text-center">Active POS Status</div>
                <div className="text-right">Actions</div>
              </div>

              {/* Customer rows */}
              {filteredCustomers.map((c) => {
                const history = c.orderHistory ?? []
                const totalSpend = history.length > 0
                  ? history.reduce((sum, order) => sum + (order.total || 0), 0)
                  : (c.lifetimeSpend || 0)
                const totalOrdersCount = c.lifetimeOrders !== undefined
                  ? c.lifetimeOrders
                  : (history.length || c.visits || 0)
                const status = getCustomerStatus(c.phone)

                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 md:grid md:grid-cols-[2fr_1.1fr_1fr_1.1fr_1.3fr_1.5fr] md:gap-4 md:items-center md:border-b md:border-zinc-100 md:border-t-0 md:border-l-0 md:border-r-0 md:bg-transparent md:px-0 md:py-3.5 hover:bg-zinc-50/40 transition"
                  >
                    {/* Customer info */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100 font-bold text-yellow-800 text-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                          <Icon d={ICON_PHONE} size={11} className="text-zinc-400" />
                          {c.phone && (c.phone === '9999990001' || c.phone === '9999990002') ? 'Online Aggregator' : c.phone}
                        </p>
                      </div>
                    </div>

                    {/* Member Since */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 md:contents">
                      <span className="font-semibold md:hidden text-zinc-400 uppercase text-[9px]">Joined:</span>
                      <span className="flex items-center gap-1 font-sans">
                        <Icon d={ICON_CALENDAR} size={11} className="text-zinc-400" />
                        {c.createdAt}
                      </span>
                    </div>

                    {/* Total Orders */}
                    <div className="flex items-center justify-between text-xs text-zinc-600 md:contents">
                      <span className="font-semibold md:hidden text-zinc-400 uppercase text-[9px]">Orders:</span>
                      <span className="md:text-center font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full text-xs">
                        {totalOrdersCount}
                      </span>
                    </div>

                    {/* Lifetime Spend */}
                    <div className="flex items-center justify-between text-xs text-zinc-900 md:contents">
                      <span className="font-semibold md:hidden text-zinc-400 uppercase text-[9px]">Spend:</span>
                      <span className="md:text-right font-extrabold text-green-600">
                        ₹{Number(totalSpend).toFixed(2)}
                      </span>
                    </div>

                    {/* Active POS statuses */}
                    <div className="flex items-center justify-between text-xs md:contents">
                      <span className="font-semibold md:hidden text-zinc-400 uppercase text-[9px]">POS Link:</span>
                      <div className="flex flex-wrap gap-1 md:justify-center">
                        {status.hasActiveToken && (
                          <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            🎫 Token #{status.activeTokenNum} Active
                          </span>
                        )}
                        {status.hasDraft && (
                          <span className="rounded bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                            ⏳ Pending Pickup (Draft #{status.draftId})
                          </span>
                        )}
                        {!status.hasActiveToken && !status.hasDraft && (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-2 md:mt-0 flex gap-2 md:justify-end">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="rounded-lg bg-zinc-900 hover:bg-black px-2.5 py-1.5 text-xs font-bold text-white transition active:scale-95 shadow-sm shrink-0"
                      >
                        History
                      </button>
                      <button
                        onClick={() => setEditingCustomer(c)}
                        className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition active:scale-95 shadow-sm shrink-0"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setCustomerToDelete(c)}
                        className="rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 p-1.5 text-red-600 transition active:scale-95 shadow-sm shrink-0"
                        title="Delete Profile"
                      >
                        <Icon d={ICON_TRASH} size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Customer Detail History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[85vh] rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Customer Transaction History</h3>
                <p className="text-xs text-gray-400">Detailed order history and spend log for {selectedCustomer.name}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600 transition text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
              
              {/* Profile Card details */}
              <div className="flex items-center gap-4 rounded-xl bg-gray-50 border border-gray-200 p-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-400 font-black text-zinc-900 text-base shadow-xs shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-gray-900">{selectedCustomer.name}</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">📞 {selectedCustomer.phone && (selectedCustomer.phone === '9999990001' || selectedCustomer.phone === '9999990002') ? 'Online Aggregator' : selectedCustomer.phone}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Member since: {selectedCustomer.createdAt}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Lifetime Spend</p>
                  <p className="text-base font-black text-green-600">
                    ₹{(selectedCustomer.orderHistory ?? []).reduce((s, o) => s + o.total, 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              <div>
                <h5 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2.5">Order History Log</h5>
                
                {(selectedCustomer.orderHistory ?? []).length === 0 ? (
                  <p className="text-center py-8 text-xs text-gray-400 font-semibold">No order logs registered.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedCustomer.orderHistory.map((order, oIdx) => (
                      <div key={order.orderId ?? oIdx} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div>
                            <span className="text-xs font-extrabold text-gray-900">{order.orderId ?? `Order #${oIdx + 1}`}</span>
                            <span className="ml-2 text-[10px] text-gray-400 font-mono">{order.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-yellow-100 border border-yellow-200 px-1.5 py-0.5 text-[9px] font-bold text-yellow-800">
                              {order.paymentMethod}
                            </span>
                            <span className="text-xs font-black text-gray-900">
                              ₹{order.total.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Items breakdown list */}
                        <div className="space-y-1">
                          {(order.items ?? []).map((it, itIdx) => (
                            <div key={itIdx} className="flex justify-between items-center text-xs text-gray-600">
                              <span>{it.name} <span className="font-bold text-gray-400">x{it.qty}</span></span>
                              <span className="font-mono text-gray-900 font-semibold">₹{(it.price * it.qty).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setEditingCustomer(selectedCustomer)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <Icon d={ICON_EDIT} size={13} />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => setCustomerToDelete(selectedCustomer)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-red-700 transition inline-flex items-center gap-1.5"
              >
                <Icon d={ICON_TRASH} size={13} />
                <span>Delete Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-extrabold text-gray-900">Edit Customer Profile</h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="text-gray-400 hover:text-gray-600 transition text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Update contact information for this guest profile</p>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter guest name..."
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400 focus:bg-white transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Enter 10-digit number..."
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400 focus:bg-white transition font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 text-center">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-base font-extrabold text-gray-900 mt-2 mb-1">Delete Customer Profile?</h3>
            <p className="text-xs text-gray-400 mb-3">This action cannot be undone.</p>

            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 mb-4 text-left">
              <p className="text-xs font-bold text-gray-900">{customerToDelete.name}</p>
              <p className="text-xs text-gray-500 font-mono">📞 {customerToDelete.phone}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Keep Profile
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customer
