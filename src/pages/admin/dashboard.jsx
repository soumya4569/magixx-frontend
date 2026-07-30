import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

/* ── Inline SVG icon primitives ── */
const Icon = ({ d, size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

/* ── Icon paths ── */
const IC = {
  revenue:   'M12 2v20 M17 5H9.5 a3.5 3.5 0 0 0 0 7h5 a3.5 3.5 0 0 1 0 7H6',
  orders:    'M9 5H7 a2 2 0 0 0 -2 2v12 a2 2 0 0 0 2 2h10 a2 2 0 0 0 2 -2V7 a2 2 0 0 0 -2 -2h-2 M9 5 a2 2 0 0 0 2 2h2 a2 2 0 0 0 2 -2 M9 5 a2 2 0 0 1 2 -2h2 a2 2 0 0 1 2 2',
  table:     'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  token:     'M15 5v2 m0 4v2 m0 4v2 M5 5h14 a2 2 0 0 1 2 2v3 a2 2 0 0 0 0 4v3 a2 2 0 0 1 -2 2H5 a2 2 0 0 1 -2 -2v-3 a2 2 0 0 0 0 -4V7 a2 2 0 0 1 2 -2z',
  trendUp:   'M23 6l-9.5 9.5-5-5L1 18',
  refresh:   'M23 4v6h-6 M1 20v-6h6 M3.51 9 a9 9 0 0 1 14.85 -3.36L23 10 M1 14l4.64 4.36 A9 9 0 0 0 20.49 15',
  customer:  'M17 21v-2 a4 4 0 0 0 -4 -4H5 a4 4 0 0 0 -4 4v2 M9 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8z',
}

const Dashboard = () => {
  const navigate = useNavigate()
  const [dbOrders, setDbOrders] = useState([])
  const [dbPaymentStats, setDbPaymentStats] = useState({ totalRevenue: 0, breakdown: [] })
  const [dbTables, setDbTables] = useState([])
  const [crmCustomers, setCrmCustomers] = useState([])
  const [lastUpdated, setLastUpdated] = useState('')

  const [metricsData, setMetricsData] = useState(null)

  const loadData = async () => {
    try {
      const [dashRes, ordersRes, summaryRes, tablesRes, customersRes] = await Promise.allSettled([
        api.get('/dashboard/metrics'),
        api.get('/orders'),
        api.get('/payments/summary'),
        api.get('/tables'),
        api.get('/customers'),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value?.data) setMetricsData(dashRes.value.data)
      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value?.data)) setDbOrders(ordersRes.value.data)
      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) setDbPaymentStats(summaryRes.value.data)
      if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value?.data)) setDbTables(tablesRes.value.data)
      if (customersRes.status === 'fulfilled' && Array.isArray(customersRes.value?.data)) setCrmCustomers(customersRes.value.data)
    } catch (err) {
      console.error('Failed to load live dashboard data:', err)
    } finally {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
  }

  useEffect(() => {
    loadData()
    const handleSync = () => loadData()

    window.addEventListener('pos:table-updated', handleSync)
    window.addEventListener('pos:data-updated', handleSync)
    window.addEventListener('focus', handleSync)
    const interval = setInterval(loadData, 3000)

    return () => {
      window.removeEventListener('pos:table-updated', handleSync)
      window.removeEventListener('pos:data-updated', handleSync)
      window.removeEventListener('focus', handleSync)
      clearInterval(interval)
    }
  }, [])

  // Aggregate stats strictly from live backend data
  const dashboardStats = useMemo(() => {
    if (metricsData) {
      return {
        totalSales: metricsData.formattedTotalSales || `₹${(metricsData.totalSales || 0).toLocaleString('en-IN')}`,
        totalOrders: String(metricsData.totalOrders || 0),
        activeTableCount: metricsData.activeTableCount || `${metricsData.availableTables || 12} / ${metricsData.totalTables || 12}`,
        availableTableText: metricsData.availableTableText || `${metricsData.availableTables || 12} available`,
        dailyTokenNumber: metricsData.formattedTokenNumber || (metricsData.dailyTokenNumber > 0 ? `#${metricsData.dailyTokenNumber}` : '#0'),
      }
    }

    const totalSalesNum = dbPaymentStats.totalRevenue || (Array.isArray(dbOrders) ? dbOrders.reduce((s, o) => s + (o.total || 0), 0) : 0)
    const completedOrders = Array.isArray(dbOrders) ? dbOrders.length : 0
    
    const totalTables = Array.isArray(dbTables) && dbTables.length > 0 ? dbTables.length : 12
    const availableTables = Array.isArray(dbTables) && dbTables.length > 0
      ? dbTables.filter((t) => !t.status || t.status === 'available' || String(t.status).toLowerCase() === 'available').length
      : 12

    const validTokens = Array.isArray(dbOrders) ? dbOrders.map((o) => o.tokenNumber).filter(Boolean) : []
    const latestTokenNum = validTokens.length > 0 ? Math.max(...validTokens) : 0

    return {
      totalSales: `₹${totalSalesNum.toLocaleString('en-IN')}`,
      totalOrders: completedOrders.toString(),
      activeTableCount: `${availableTables} / ${totalTables}`,
      availableTableText: `${availableTables} available`,
      dailyTokenNumber: latestTokenNum > 0 ? `#${latestTokenNum}` : '#0',
    }
  }, [metricsData, dbOrders, dbPaymentStats, dbTables])

  // Aggregate top-selling items strictly from completed orders
  const popularItems = useMemo(() => {
    const itemSummary = {}
    
    ;(dbOrders || []).forEach((o) => {
      if (!o || !Array.isArray(o.items)) return
      o.items.forEach((it) => {
        if (!it || !it.name) return
        const dishName = it.name.trim()
        if (!itemSummary[dishName]) {
          itemSummary[dishName] = { count: 0, revenue: 0 }
        }
        const qty = Number(it.quantity || it.qty || 1)
        const price = Number(it.price || 0)
        itemSummary[dishName].count += qty
        itemSummary[dishName].revenue += price * qty
      })
    })

    const sorted = Object.entries(itemSummary)
      .map(([name, data]) => ({
        name,
        orders: `${data.count} order(s)`,
        rating: '4.9',
        revenue: `₹${data.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        rawCount: data.count,
        rawRevenue: data.revenue,
      }))
      .sort((a, b) => b.rawCount - a.rawCount || b.rawRevenue - a.rawRevenue)

    return sorted.slice(0, 5)
  }, [dbOrders])

  // Recent guest registrations directly from CRM customer collection
  const recentCustomers = useMemo(() => {
    const list = [...(crmCustomers || [])].sort((a, b) => {
      const bDate = new Date(b.createdAt || 0).getTime()
      const aDate = new Date(a.createdAt || 0).getTime()
      return bDate - aDate
    })

    return list.slice(0, 5).map((c) => {
      const spend = c.lifetimeSpend || 0
      const dateStr = c.createdAt
        ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Recently'
      return {
        name: c.name || 'Walk-in Guest',
        phone: c.phone || 'N/A',
        createdAt: dateStr,
        totalSpend: `₹${Number(spend).toLocaleString('en-IN')}`,
      }
    })
  }, [crmCustomers])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="flex h-full w-full max-w-full flex-col gap-5 overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 font-sans">Sweets &amp; Cafe Executive Dashboard</h1>
          <p className="mt-0.5 text-xs text-zinc-400">{dateStr} • Live updates synced ({lastUpdated})</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live Sync
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 cursor-pointer"
          >
            <Icon d={IC.refresh} size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Total Sales */}
        <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm border border-zinc-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-yellow-400 transition-transform duration-300 group-hover:scale-x-100" />
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cafe Net Sales</span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-400 shadow-sm">
              <Icon d={IC.revenue} size={14} className="text-zinc-900" />
            </div>
          </div>
          <div>
            <p className="truncate text-lg sm:text-xl font-extrabold leading-none tracking-tight text-zinc-900">
              {dashboardStats.totalSales}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                Live
              </span>
              <span className="text-[10px] text-zinc-400">Billing records sync</span>
            </div>
          </div>
        </div>

        {/* Total Completed Orders */}
        <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm border border-zinc-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-yellow-400 transition-transform duration-300 group-hover:scale-x-100" />
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Completed Orders</span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-400 shadow-sm">
              <Icon d={IC.orders} size={14} className="text-zinc-900" />
            </div>
          </div>
          <div>
            <p className="truncate text-lg sm:text-xl font-extrabold leading-none tracking-tight text-zinc-900">
              {dashboardStats.totalOrders}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">Total checkouts</span>
            </div>
          </div>
        </div>

        {/* Active Table Occupancy */}
        <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm border border-zinc-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-yellow-400 transition-transform duration-300 group-hover:scale-x-100" />
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Active Table Count</span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-400 shadow-sm">
              <Icon d={IC.table} size={14} className="text-white" />
            </div>
          </div>
          <div>
            <p className="truncate text-lg sm:text-xl font-extrabold leading-none tracking-tight text-zinc-900">
              {dashboardStats.activeTableCount}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-blue-600 font-semibold">{dashboardStats.availableTableText}</span>
            </div>
          </div>
        </div>

        {/* Daily Token Counter */}
        <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm border border-zinc-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-yellow-400 transition-transform duration-300 group-hover:scale-x-100" />
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Daily Token Counter</span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-400 shadow-sm">
              <Icon d={IC.token} size={14} className="text-white" />
            </div>
          </div>
          <div>
            <p className="truncate text-lg sm:text-xl font-extrabold leading-none tracking-tight text-purple-700">
              {dashboardStats.dailyTokenNumber}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">Latest token issued today</span>
            </div>
          </div>
        </div>

      </div>

      {/* Grid Layout: Top Selling Leaderboard vs Recent CRM Activity Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Top-Rated & Favorite Items Leaderboard */}
        <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm border border-zinc-200">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-5 py-4">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Top-Selling Menu Leaderboard</h2>
              <p className="text-[11px] text-zinc-400 font-medium">Most requested dishes by order volume and revenue</p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100 overflow-y-auto max-h-[300px] scrollbar-thin">
            {popularItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white">
                <span className="text-3xl mb-1.5">🧁</span>
                <p className="text-xs font-bold text-zinc-500">No items sold yet</p>
                <p className="text-[10px] text-zinc-400">Leaderboard updates automatically on POS checkout</p>
              </div>
            ) : (
              popularItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-zinc-50/50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-extrabold text-zinc-900">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-800">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{item.orders} • <span className="font-bold text-green-600">{item.revenue}</span></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-xs font-bold text-zinc-700">{item.rating}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent CRM Activity Log (Guest check-ins) */}
        <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm border border-zinc-200">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-yellow-100">
              <Icon d={IC.customer} size={11} className="text-yellow-800" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Recent Guest Registrations (CRM)</h2>
              <p className="text-[11px] text-zinc-400">Audit logs of new customer check-ins and lifetime spend</p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100 overflow-y-auto max-h-[300px] scrollbar-thin">
            {recentCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white">
                <span className="text-3xl mb-1.5">👥</span>
                <p className="text-xs font-bold text-zinc-500">No guests checked in yet</p>
                <p className="text-[10px] text-zinc-400">Newly registered profiles will appear here in real-time</p>
              </div>
            ) : (
              recentCustomers.map((cust, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-zinc-50/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-800">{cust.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">📞 {cust.phone} • Joined: {cust.createdAt}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Lifetime spend</p>
                    <p className="text-xs font-extrabold text-green-600">{cust.totalSpend}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Quick Action Navigation Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-5 py-3.5 shadow-sm border border-zinc-200">
        <span className="mr-1 text-xs font-bold uppercase tracking-widest text-zinc-400 shrink-0">
          Operational Toolbar
        </span>
        <div className="hidden sm:block h-4 w-px bg-zinc-200 shrink-0" />
        <button
          onClick={() => navigate('/order')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-zinc-900"
        >
          <Icon d={IC.orders} size={13} className="text-zinc-400" />
          POS Checkout
        </button>
        <button
          onClick={() => navigate('/admin/customer')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-zinc-900"
        >
          <Icon d={IC.customer} size={13} className="text-zinc-400" />
          CRM Profiles
        </button>
        <button
          onClick={() => navigate('/admin/reports')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-zinc-900"
        >
          <Icon d={IC.trendUp} size={13} className="text-zinc-400" />
          Auditing &amp; Reports
        </button>
      </div>

    </div>
  )
}

export default Dashboard
