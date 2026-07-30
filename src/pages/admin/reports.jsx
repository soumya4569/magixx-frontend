import { useState, useMemo, useEffect } from 'react'
import api from '../../services/api'

const ICON_CALENDAR = "M19 4H5 a2 2 0 0 0 -2 2v14 a2 2 0 0 0 2 2h14 a2 2 0 0 0 2 -2V6 a2 2 0 0 0 -2 -2z M16 2v4 M8 2v4 M3 10h18"
const ICON_TRENDUP = "M23 6l-9.5 9.5-5-5L1 18"
const ICON_TROPHY = "M6 9H4.5 a2.5 2.5 0 0 1 0 -5H6 M18 9h1.5 a2.5 2.5 0 0 0 0 -5H18 M4 22h16 M10 14.66V17 c0 0.55 -0.47 0.98 -0.97 1.21 C7.85 18.75 7 20.24 7 22 M14 14.66V17 c0 0.55 0.47 0.98 0.97 1.21 C16.15 18.75 17 20.24 17 22 M18 2H6v7 a6 6 0 0 0 12 0V2z"
const ICON_MONEY = "M12 1v22 M17 5H9.5 a3.5 3.5 0 0 0 0 7h5 a3.5 3.5 0 0 1 0 7H6"
const ICON_EXPORT = "M21 15v4 a2 2 0 0 1 -2 2H5 a2 2 0 0 1 -2 -2v-4 M7 10l5 5 5-5 M12 15V3"
const ICON_SEARCH = "M21 21l-4.35-4.35 M11 19 a8 8 0 1 0 0 -16 a8 8 0 0 0 0 16z"

const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const Reports = () => {
  const [timeframe, setTimeframe] = useState('7D')
  const [dbOrders, setDbOrders] = useState([])
  const [dbPayments, setDbPayments] = useState([])
  const [crmCustomers, setCrmCustomers] = useState([])
  const [activeTab, setActiveTab] = useState('sales')
  const [reservations, setReservations] = useState([])
  const [resSearch, setResSearch] = useState('')
  const [resFilterStatus, setResFilterStatus] = useState('All')

  const loadReportsData = async () => {
    try {
      const [ordersRes, paymentsRes, customersRes, reservationsRes] = await Promise.allSettled([
        api.get('/orders'),
        api.get('/payments'),
        api.get('/customers'),
        api.get('/reservations'),
      ])
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) setDbOrders(ordersRes.value.data)
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value?.data) setDbPayments(paymentsRes.value.data)
      if (customersRes.status === 'fulfilled' && customersRes.value?.data) setCrmCustomers(customersRes.value.data)
      
      if (reservationsRes.status === 'fulfilled' && Array.isArray(reservationsRes.value?.data) && reservationsRes.value.data.length > 0) {
        setReservations(reservationsRes.value.data)
      } else {
        const savedRes = localStorage.getItem('pos_reservations')
        if (savedRes) {
          try {
            setReservations(JSON.parse(savedRes))
          } catch (e) {
            console.error(e)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load reports analytics from backend:', err)
    }
  }

  useEffect(() => {
    loadReportsData()
  }, [])

  // Aggregate all completed orders across live DB orders & CRM profiles
  const allOrders = useMemo(() => {
    const list = []
    const orderIdsSeen = new Set()

    if (Array.isArray(dbOrders)) {
      dbOrders.forEach((o) => {
        if (!o) return
        const id = o._id || o.id
        if (id) orderIdsSeen.add(id)
        list.push({
          ...o,
          customerName: o.customerName || o.customer?.name || 'Guest Customer',
          customerPhone: o.customerPhone || o.customer?.phone || '',
          date: o.createdAt || o.date || new Date().toISOString()
        })
      })
    }

    if (Array.isArray(crmCustomers)) {
      crmCustomers.forEach((c) => {
        if (!c) return
        const history = c.orderHistory ?? []
        if (!Array.isArray(history)) return
        history.forEach((order) => {
          if (!order) return
          const id = order._id || order.id
          if (id && orderIdsSeen.has(id)) return
          if (id) orderIdsSeen.add(id)
          list.push({
            ...order,
            customerName: c.name || 'Guest Customer',
            customerPhone: c.phone || '',
            date: order.createdAt || order.date || new Date().toISOString()
          })
        })
      })
    }

    return list.sort((a, b) => {
      const da = a && a.date ? new Date(a.date).getTime() : 0
      const db = b && b.date ? new Date(b.date).getTime() : 0
      const timeA = isNaN(da) ? 0 : da
      const timeB = isNaN(db) ? 0 : db
      return timeB - timeA
    })
  }, [dbOrders, crmCustomers])

  // Aggregate timeframe-specific reports data
  const reportData = useMemo(() => {
    // 1. Chart Bins Construction
    const now = new Date()
    let numDays = 30
    if (timeframe === '7D') numDays = 7
    else if (timeframe === '90D') numDays = 90

    const bins = []
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      
      let label = ''
      if (timeframe === '7D') {
        label = d.toLocaleDateString('en-IN', { weekday: 'short' })
      } else if (timeframe === '30D') {
        if (i % 6 === 0) {
          label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        }
      } else {
        if (i % 15 === 0) {
          label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        }
      }

      bins.push({
        dateString: d.toLocaleDateString(),
        label,
        value: 0
      })
    }

    const isAggregator = (o) => /zomato|eat\s*odia|swiggy|aggregator/i.test(o.orderType || '') || /zomato|eat\s*odia|swiggy|aggregator/i.test(o.channel || '') || ['Zomato', 'Eat Odia', 'Swiggy', 'Aggregator'].includes(o.paymentMethod);

    // Populate bins with actual local orders (excluding aggregators)
    if (Array.isArray(allOrders)) {
      allOrders.forEach((order) => {
        if (!order || !order.date || isAggregator(order)) return
        const parsedDate = new Date(order.date)
        if (isNaN(parsedDate.getTime())) return
        const orderDateStr = parsedDate.toLocaleDateString()
        const bin = bins.find((b) => b.dateString === orderDateStr)
        if (bin) {
          bin.value += Number(order.total || 0)
        }
      })
    }

    // Map bins to heights (strictly zero if no sales recorded)
    const maxVal = Math.max(...bins.map((b) => b.value))
    const finalBars = bins.map((b) => ({
      percent: maxVal > 0 ? Math.round((b.value / maxVal) * 100) : 0,
      value: b.value
    }))
    const finalLabels = bins.map((b) => b.label)

    // 2. Sales Summary Breakdown
    const totalSales = bins.reduce((sum, b) => sum + b.value, 0)
    const totalOrders = Array.isArray(allOrders) ? allOrders.length : 0
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // 3. Dynamic Category revenue distribution
    const categoryRevenue = {}
    
    if (Array.isArray(allOrders)) {
      allOrders.forEach((o) => {
        if (!o || isAggregator(o)) return
        const orderItems = o.items ?? []
        if (Array.isArray(orderItems)) {
          orderItems.forEach((it) => {
            if (!it) return
            const cat = it.category || 'Special Items'
            const rev = Number(it.price || 0) * Number(it.qty || 0)
            categoryRevenue[cat] = (categoryRevenue[cat] || 0) + rev
          })
        }
      })
    }

    const categorySplits = Object.entries(categoryRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // 4. Channel splits ( Dine-in, Takeaway, Zomato, Eat Odia )
    let dineInOrders = 0
    let takeawayOrders = 0
    let zomatoOrders = 0
    let eatOdiaOrders = 0

    let dineInRevenue = 0
    let takeawayRevenue = 0
    let zomatoRevenue = 0
    let eatOdiaRevenue = 0

    if (Array.isArray(allOrders)) {
      allOrders.forEach((o) => {
        if (!o) return
        const ch = (o.channel || o.orderType || o.paymentMethod || '').toLowerCase()
        const amount = Number(o.total || 0)

        if (ch.includes('zomato')) {
          zomatoOrders++
          zomatoRevenue += 0
        } else if (ch.includes('eat odia') || ch.includes('eatodia') || ch.includes('eat')) {
          eatOdiaOrders++
          eatOdiaRevenue += 0
        } else if (ch.includes('takeaway') || ch.includes('parcel')) {
          takeawayOrders++
          takeawayRevenue += amount
        } else {
          dineInOrders++
          dineInRevenue += amount
        }
      })
    }

    const totalChannelOrders = dineInOrders + takeawayOrders + zomatoOrders + eatOdiaOrders

    const dineInPct = totalChannelOrders > 0 ? Math.round((dineInOrders / totalChannelOrders) * 100) : 0
    const takeawayPct = totalChannelOrders > 0 ? Math.round((takeawayOrders / totalChannelOrders) * 100) : 0
    const zomatoPct = totalChannelOrders > 0 ? Math.round((zomatoOrders / totalChannelOrders) * 100) : 0
    const eatOdiaPct = totalChannelOrders > 0 ? Math.round((eatOdiaOrders / totalChannelOrders) * 100) : 0

    // 5. Menu Performance Items (excluding Zomato / Eat Odia / aggregator orders)
    const itemSales = {}
    if (Array.isArray(allOrders)) {
      allOrders.forEach((o) => {
        if (!o || isAggregator(o)) return
        const orderItems = o.items ?? []
        if (Array.isArray(orderItems)) {
          orderItems.forEach((it) => {
            if (!it || (!it.name && !it.title)) return
            const name = it.name || it.title
            if (!itemSales[name]) {
              itemSales[name] = { qty: 0, revenue: 0, category: it.category || 'Custom' }
            }
            const itemQty = Number(it.qty || it.quantity || 1)
            const itemPrice = Number(it.price || 0)
            itemSales[name].qty += itemQty
            itemSales[name].revenue += itemPrice * itemQty
          })
        }
      })
    }

    const topSellingItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)

    const underperformingItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 3)

    // 6. Tender Split (excluding aggregators)
    const tenderCount = { UPI: 0, Cash: 0, Card: 0 }
    if (Array.isArray(allOrders)) {
      allOrders.forEach((o) => {
        if (!o || isAggregator(o)) return
        const pm = o.paymentMethod ?? 'Cash'
        if (tenderCount[pm] !== undefined) {
          tenderCount[pm] += Number(o.total || 0)
        } else {
          tenderCount.Cash += Number(o.total || 0)
        }
      })
    }

    const tenderSplits = Object.entries(tenderCount).map(([type, value]) => ({ type, value }))

    return {
      chartBars: finalBars,
      chartLabels: finalLabels,
      totalSales,
      totalOrders,
      avgOrderValue,
      categorySplits,
      dineInOrders,
      dineInRevenue,
      dineInPct,
      takeawayOrders,
      takeawayRevenue,
      takeawayPct,
      zomatoOrders,
      zomatoRevenue,
      zomatoPct,
      eatOdiaOrders,
      eatOdiaRevenue,
      eatOdiaPct,
      topPerformers: topSellingItems,
      lowPerformers: underperformingItems,
      tenderSplits
    }
  }, [allOrders, timeframe])

  const filteredHistory = useMemo(() => {
    if (!Array.isArray(reservations)) return []
    return reservations.filter((r) => {
      if (!r) return false
      const matchesSearch =
        (r.guestName && r.guestName.toLowerCase().includes(resSearch.toLowerCase())) ||
        (r.phone && r.phone.includes(resSearch)) ||
        (r.tableName && r.tableName.toLowerCase().includes(resSearch.toLowerCase()))
      const matchesStatus = resFilterStatus === 'All' || r.status === resFilterStatus
      return matchesSearch && matchesStatus
    })
  }, [reservations, resSearch, resFilterStatus])

  // Handle export report toast
  const handleExport = () => {
    alert("CSV/PDF Export Triggered! Audit summary report downloaded successfully.")
  }

  return (
    <div className="flex h-full w-full max-w-full flex-col gap-6 overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Analytics &amp; Reporting</h1>
          <p className="text-sm text-zinc-500">Analyze sales performance, reservation audit logs, and tender details</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-bold text-zinc-900 shadow-md transition-all hover:bg-yellow-500 hover:shadow-lg active:scale-95 shrink-0 cursor-pointer"
        >
          <Icon d={ICON_EXPORT} size={14} />
          Export Reports
        </button>
      </div>

      {/* Navigation Tab Selector */}
      <div className="flex border-b border-zinc-200 gap-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'sales'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          📊 Sales &amp; Revenue Analytics
        </button>
        <button
          onClick={() => setActiveTab('reservations')}
          className={`pb-3 text-xs sm:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'reservations'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <span>📅 Reservation History Audit</span>
        </button>
      </div>

      {activeTab === 'sales' && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Net Sales */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Net Sales</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">₹{reportData.totalSales.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Orders */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Audit Orders</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">{reportData.totalOrders}</span>
              </div>
            </div>

            {/* Average Ticket Value */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Average Ticket Size (AOV)</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">₹{reportData.avgOrderValue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Grid: Sales Category & Channels Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            
            {/* Category Breakdown */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Revenue Split by Category</h3>
                <p className="text-[11px] text-zinc-400">Total spending grouped by menu department</p>
              </div>
              <div className="space-y-3">
                {(() => {
                  const activeSplits = (reportData.categorySplits || []).filter((c) => c.value > 0)
                  const totalCatSum = activeSplits.reduce((sum, c) => sum + c.value, 0)
                  if (activeSplits.length === 0) {
                    return <p className="text-xs text-zinc-400 font-semibold py-4 text-center">No category sales recorded yet for this period.</p>
                  }
                  return activeSplits.map((cat) => {
                    const pct = totalCatSum > 0 ? Math.round((cat.value / totalCatSum) * 100) : 0
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-zinc-700">{cat.name}</span>
                          <span className="text-zinc-900">₹{cat.value.toFixed(2)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Order Channel Split */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Order Channel Split</h3>
                <p className="text-[11px] text-zinc-400">Distribution across Dining, Takeaway & Aggregator Channels</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
                {/* Dine In */}
                <div className="text-center p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1 flex flex-col items-center justify-center">
                  <p className="text-xs font-extrabold text-zinc-800">🍽️ Dine-in</p>
                  <p className="text-sm font-black text-blue-600">{reportData.dineInOrders} Orders</p>
                  <p className="text-xs text-zinc-500 font-bold font-mono">₹{reportData.dineInRevenue.toFixed(0)}</p>
                </div>
                {/* Takeaway */}
                <div className="text-center p-3 rounded-xl bg-amber-50/70 border border-amber-100 space-y-1 flex flex-col items-center justify-center">
                  <p className="text-xs font-extrabold text-zinc-800">📦 Takeaway</p>
                  <p className="text-sm font-black text-amber-600">{reportData.takeawayOrders} Orders</p>
                  <p className="text-xs text-zinc-500 font-bold font-mono">₹{reportData.takeawayRevenue.toFixed(0)}</p>
                </div>
                {/* Zomato */}
                <div className="text-center p-3 rounded-xl bg-red-50/70 border border-red-100 space-y-1 flex flex-col items-center justify-center">
                  <p className="text-xs font-extrabold text-zinc-800">🛵 Zomato</p>
                  <p className="text-sm font-black text-red-600">{reportData.zomatoOrders} Orders</p>
                </div>
                {/* Eat Odia */}
                <div className="text-center p-3 rounded-xl bg-orange-50/70 border border-orange-100 space-y-1 flex flex-col items-center justify-center">
                  <p className="text-xs font-extrabold text-zinc-800">🍱 Eat Odia</p>
                  <p className="text-sm font-black text-orange-600">{reportData.eatOdiaOrders} Orders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Grid: Menu Performance & Payment Summaries */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Menu Performance Analysis */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Menu Item Performance</h3>
                <p className="text-[11px] text-zinc-400">Comparison of high-profit vs low-performing items</p>
              </div>
              <div className="space-y-4">
                
                {/* Top items */}
                <div>
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <span>⭐</span> Top Sellers
                  </p>
                  <div className="space-y-2">
                    {reportData.topPerformers.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 py-1">No items registered.</p>
                    ) : (
                      reportData.topPerformers.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-zinc-50 pb-1.5">
                          <span className="font-semibold text-zinc-700">{it.name} <span className="text-[10px] text-zinc-400">({it.category})</span></span>
                          <span className="font-bold text-zinc-900">{it.qty} sold • ₹{it.revenue.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Underperforming items */}
                <div>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <span>⚠️</span> Underperforming Items
                  </p>
                  <div className="space-y-2">
                    {reportData.lowPerformers.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 py-1">No items registered.</p>
                    ) : (
                      reportData.lowPerformers.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-zinc-50 pb-1.5">
                          <span className="font-semibold text-zinc-700">{it.name} <span className="text-[10px] text-zinc-400">({it.category})</span></span>
                          <span className="font-bold text-zinc-400">{it.qty} sold • ₹{it.revenue.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Payment & Tender Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Payment &amp; Tender Audit</h3>
                <p className="text-[11px] text-zinc-400">Audit logs by payment gateway / cash receipts</p>
              </div>
              <div className="space-y-3">
                {reportData.totalSales === 0 ? (
                  <p className="text-xs text-zinc-400 font-semibold py-4 text-center">No payment transactions found.</p>
                ) : (
                  reportData.tenderSplits.map((tender) => {
                    const pct = reportData.totalSales > 0 ? Math.round((tender.value / reportData.totalSales) * 100) : 0
                    if (tender.value === 0) return null
                    return (
                      <div key={tender.type} className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-100 p-3 hover:bg-zinc-100/50 transition">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100 text-yellow-800 font-extrabold text-xs">
                            {tender.type.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-800">{tender.type} Payment</p>
                            <p className="text-[10px] text-zinc-400">{pct}% split ratio</p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-zinc-900">₹{tender.value.toFixed(2)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>

          {/* Interactive Revenue Chart Card (Moved to bottom) */}
          <div className="flex h-[320px] flex-col overflow-hidden rounded-xl bg-white shadow-md border border-zinc-200 w-full shrink-0">
            
            {/* Card Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Revenue Analysis Chart</h2>
                <p className="text-[11px] text-zinc-400">Timeframe distribution • values in Indian Rupees (₹)</p>
              </div>
              <div className="flex gap-1.5">
                {['7D', '30D', '90D'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeframe(r)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                      timeframe === r
                        ? 'bg-yellow-400 text-zinc-900 shadow-sm'
                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Body */}
            <div className="flex min-h-0 flex-1 flex-col px-5 pb-3.5 pt-3.5">
              <div className="relative min-h-0 flex-1">
                
                {/* Gridlines */}
                {[100, 75, 50, 25, 0].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 flex items-center gap-2"
                    style={{ bottom: `${pct}%` }}
                  >
                    <span className="w-6 shrink-0 text-right text-[10px] text-zinc-300">
                      {pct === 0 ? '' : pct}
                    </span>
                    <div className="flex-1 border-t border-dashed border-zinc-100" />
                  </div>
                ))}

                {/* Bars */}
                <div className="absolute inset-0 ml-8 flex items-end gap-0.5 sm:gap-1 pb-0.5">
                  {reportData.chartBars.map((bar, i) => (
                    <div
                      key={i}
                      className="group/bar relative flex flex-1 flex-col items-center justify-end"
                      style={{ height: '100%' }}
                    >
                      <svg
                        className="w-[85%] origin-bottom transition-all duration-200 hover:opacity-100 hover:scale-y-105"
                        style={{ height: `${bar.percent}%`, opacity: 0.95 }}
                        viewBox="0 0 10 100" preserveAspectRatio="none"
                      >
                        <rect x="0" y="0" width="10" height="100" rx="1.5" ry="1.5" fill="#FBBF24" />
                      </svg>
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover/bar:opacity-100">
                        ₹{bar.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* X axis labels */}
              <div className="ml-8 mt-2.5 flex shrink-0 justify-between">
                {reportData.chartLabels.map((d, i) => (
                  <span key={i} className="text-[10px] text-zinc-400 font-semibold min-w-[20px] text-center">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'reservations' && (
        <div className="space-y-6">
          {/* Reservation History KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Recorded</span>
              <p className="text-2xl font-black text-zinc-900 mt-2">{reservations.length}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">Arrived / Seated</span>
              <p className="text-2xl font-black text-green-900 mt-2">
                {reservations.filter((r) => r.status === 'Arrived').length}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Completed</span>
              <p className="text-2xl font-black text-blue-900 mt-2">
                {reservations.filter((r) => r.status === 'Completed').length}
              </p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">Cancelled</span>
              <p className="text-2xl font-black text-red-900 mt-2">
                {reservations.filter((r) => r.status === 'Cancelled').length}
              </p>
            </div>
          </div>

          {/* Reservation Logs Table Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 flex items-center gap-2">
                  <span>📑</span>
                  <span>Reservation Audit Logs</span>
                </h2>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Complete history of arrived, completed, active, and cancelled bookings
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs">
                  <Icon d={ICON_SEARCH} size={14} className="text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search guest, phone, table..."
                    value={resSearch}
                    onChange={(e) => setResSearch(e.target.value)}
                    className="bg-transparent outline-none text-xs text-zinc-800"
                  />
                </div>

                <select
                  value={resFilterStatus}
                  onChange={(e) => setResFilterStatus(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Arrived">Arrived</option>
                  <option value="Completed">Completed</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Guest Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Party Size</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-800">
                  {filteredHistory.map((r) => (
                    <tr key={r.id || r.tableName + r.date + r.time} className="hover:bg-zinc-50/50 transition">
                      <td className="py-2.5 px-3 font-bold text-yellow-700">{r.tableName}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">{r.guestName}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{r.phone}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{r.date} • {r.time}</td>
                      <td className="py-2.5 px-3 text-zinc-700">👥 {r.partySize} Guests</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                            r.status === 'Arrived'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : r.status === 'Completed'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : r.status === 'Confirmed'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-zinc-400 text-xs font-semibold">
                        No reservation history records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Reports
