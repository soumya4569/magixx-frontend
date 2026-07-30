import { useState, useMemo, useEffect } from 'react'
import api from '../../services/api'

const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const IC = {
  payment:   'M2 10h20 M6 6h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z',
  search:    'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  download:  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  receipt:   'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  check:     'M20 6L9 17l-5-5',
}

const Payments = () => {
  const [methodFilter, setMethodFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  const [paymentsList, setPaymentsList] = useState([])
  const [paymentSummary, setPaymentSummary] = useState({ totalRevenue: 0, breakdown: [] })

  const fetchPaymentsData = async () => {
    try {
      const [payRes, sumRes] = await Promise.allSettled([
        api.get('/payments'),
        api.get('/payments/summary'),
      ])
      if (payRes.status === 'fulfilled') setPaymentsList(payRes.value.data)
      if (sumRes.status === 'fulfilled') setPaymentSummary(sumRes.value.data)
    } catch (err) {
      console.error('Failed to fetch payments ledger data:', err)
    }
  }

  useEffect(() => {
    fetchPaymentsData()
  }, [])

  const transactions = useMemo(() => {
    return paymentsList
      .filter((p) => !['Aggregator', 'Zomato', 'Swiggy', 'Eat Odia'].includes(p.paymentMethod))
      .map((p, idx) => ({
        txKey: p._id || `tx-${idx}`,
        token: p.order?.tokenNumber ? `#${p.order.tokenNumber}` : '#01',
        customer: p.order?.customer?.name || 'Walk-in Guest',
        phone: p.order?.customer?.phone || 'N/A',
        method: p.paymentMethod || 'Cash',
        amount: Number(p.amount || 0),
        tax: Number(p.order?.tax || 0),
        date: new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date(p.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: p.status || 'Success',
        items: p.order?.items || [],
      }))
  }, [paymentsList])

  const totals = useMemo(() => {
    const upiRev   = transactions.filter(t => t.method === 'UPI' || t.method === 'UPI / QR').reduce((s, t) => s + t.amount, 0)
    const cashRev  = transactions.filter(t => t.method === 'Cash').reduce((s, t) => s + t.amount, 0)
    const cardRev  = transactions.filter(t => t.method === 'Card').reduce((s, t) => s + t.amount, 0)
    const totalRev = upiRev + cashRev + cardRev
    return { totalRev, upiRev, cashRev, cardRev }
  }, [transactions])

  const filteredTransactions = transactions.filter((t) => {
    const matchesMethod = methodFilter === 'All' || t.method === methodFilter
    const matchesSearch = t.customer.toLowerCase().includes(search.toLowerCase()) ||
                          t.phone.includes(search)
    return matchesMethod && matchesSearch
  })

  return (
    <div className="flex flex-1 flex-col overflow-y-auto space-y-6">

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Payments &amp; Transactions</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">Live collection metrics across Cash, UPI QR &amp; Card</p>
        </div>
        <button
          onClick={() => alert('Exporting payment logs CSV...')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 shadow-xs hover:bg-gray-50 transition active:scale-95 shrink-0"
        >
          <Icon d={IC.download} size={15} />
          <span>Export Transactions</span>
        </button>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-yellow-300 bg-yellow-400/10 p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase text-yellow-800 tracking-wider">Total Revenue</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">₹{totals.totalRev.toFixed(2)}</p>
          <p className="text-[10px] font-semibold text-yellow-700 mt-0.5">{transactions.length} Real Transactions</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">📲 UPI / QR</p>
          <p className="text-2xl font-black text-gray-900 mt-1">₹{totals.upiRev.toFixed(2)}</p>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Digital Scan &amp; Pay</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">💵 Cash</p>
          <p className="text-2xl font-black text-gray-900 mt-1">₹{totals.cashRev.toFixed(2)}</p>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Physical Tender</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">💳 Card</p>
          <p className="text-2xl font-black text-gray-900 mt-1">₹{totals.cardRev.toFixed(2)}</p>
          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">POS Terminal</p>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <span>💳</span>
            <span>Live Payment Ledger</span>
          </h2>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs">
              <Icon d={IC.search} size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-xs text-gray-800"
              />
            </div>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 outline-none cursor-pointer"
            >
              <option value="All">All Methods</option>
              <option value="UPI">📲 UPI / QR</option>
              <option value="Cash">💵 Cash</option>
              <option value="Card">💳 Card</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Payment Method</th>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Tax Component</th>
                <th className="py-2.5 px-3">Total Amount</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
              {filteredTransactions.map((tx, idx) => (
                <tr key={tx.txKey || idx} className="hover:bg-gray-50/50 transition">
                  <td className="py-2.5 px-3">
                    <p className="font-bold text-gray-900">{tx.customer}</p>
                    <p className="text-[10px] text-gray-400">{tx.phone}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      tx.method === 'UPI / QR'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : tx.method === 'Cash'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : tx.method === 'Card'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-orange-100 text-orange-800 border border-orange-200'
                    }`}>
                      {tx.method}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{tx.date} • {tx.time}</td>
                  <td className="py-2.5 px-3 text-orange-600 font-medium">₹{tx.tax ? tx.tax.toFixed(2) : '0.00'}</td>
                  <td className="py-2.5 px-3 font-black text-gray-900 text-sm">₹{tx.amount.toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-700 hover:bg-yellow-400 hover:text-zinc-900 transition"
                    >
                      <Icon d={IC.receipt} size={12} />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-gray-400">
                    <span className="text-3xl block mb-1">💳</span>
                    <p className="text-xs font-bold text-gray-500">No real transactions recorded yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Complete an order in POS to view live payment logs.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100">
            <div className="text-center border-b border-dashed border-gray-200 pb-3 mb-3">
              <h3 className="text-base font-black text-gray-900 uppercase">MAGIXX — Sweets &amp; Cafe</h3>
              <p className="text-[10px] text-gray-400 font-semibold">Payment Receipt</p>
            </div>

            <div className="space-y-1.5 text-xs mb-4">
              <div className="flex justify-between text-gray-500">
                <span>Customer:</span>
                <span className="font-bold text-gray-900">{selectedTx.customer}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Phone:</span>
                <span className="font-bold text-gray-700">{selectedTx.phone}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Payment Mode:</span>
                <span className="font-bold text-yellow-700">{selectedTx.method}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Date &amp; Time:</span>
                <span className="text-gray-700">{selectedTx.date} • {selectedTx.time}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-gray-900 font-black text-sm">
                <span>Total Paid:</span>
                <span>₹{selectedTx.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full rounded-xl bg-yellow-400 py-2 text-xs font-extrabold text-zinc-900 hover:bg-yellow-500 transition shadow-sm"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Payments
