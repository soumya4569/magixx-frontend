import { useState, useCallback, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../services/api'
import { sendToBluetoothPrinter, getPrinterConfig } from '../../utils/bluetoothPrinter'

const BASE_MERCHANT_VPA = 'paytmqr659xjb@ptys'


/* ════════════════════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════════════════ */
const MAX_TOKENS = 25
const TOKEN_NUMS = Array.from({ length: MAX_TOKENS }, (_, i) => i + 1)

/* eslint-disable-next-line react-refresh/only-export-components */
/* eslint-disable-next-line react-refresh/only-export-components */
export const MENU_ITEMS = []

const CATEGORY_EMOJIS = {
  'Pizza':                '🍕',
  'Milk Shakes & Mojitos':'🧋',
  'Sandwiches':           '🥪',
  'Special Items':        '🍱',
  'Subway & Hotdog':      '🌭',
  'Fries & Maggie':       '🍟',
  'Tea & Coffees':        '☕',
  'Breakfast':            '🥞',
  'Ice Cream':            '🍨',
  'Burgers':              '🍔',
}

const CATEGORIES_ORDER = [
  'Pizza',
  'Milk Shakes & Mojitos',
  'Sandwiches',
  'Special Items',
  'Subway & Hotdog',
  'Fries & Maggie',
  'Tea & Coffees',
  'Breakfast',
  'Ice Cream',
  'Burgers',
]


/* Inline SVG primitives */
const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const ICON_PLUS     = 'M12 5v14M5 12h14'
const ICON_MINUS    = 'M5 12h14'
const ICON_TRASH    = 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'
const ICON_SEARCH   = 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z'
const ICON_TOKEN    = 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'
const ICON_PRINT    = 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z'
const ICON_NOTE     = 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'
const ICON_EXIT     = 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
const ICON_WARN     = 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01'
const ICON_SORT_ASC = 'M3 6h18M6 12h12M9 18h6'
const ICON_SORT_DSC = 'M3 18h18M6 12h12M9 6h6'
const ICON_DRAFT    = 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8'

/* 58mm Thermal Print Text Helpers */
const centerText = (str, width = 32) => {
  const s = String(str || '').trim()
  if (s.length >= width) return s.slice(0, width)
  const pad = Math.floor((width - s.length) / 2)
  return ' '.repeat(Math.max(0, pad)) + s
}

const wrapAndCenterText = (str, width = 32) => {
  if (!str || !String(str).trim()) return []
  const words = String(str).trim().split(/\s+/)
  const rawLines = []
  let currentLine = ''

  words.forEach((word) => {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) rawLines.push(currentLine)
      let remaining = word
      while (remaining.length > width) {
        rawLines.push(remaining.slice(0, width))
        remaining = remaining.slice(width)
      }
      currentLine = remaining
    }
  })
  if (currentLine) rawLines.push(currentLine)

  return rawLines.map((line) => centerText(line, width))
}

/* Toast notification popup component */
const Toast = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none no-print print:hidden Toastify__toast-container toast-container">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all duration-300 transform translate-y-0 no-print print:hidden Toastify__toast ${
          t.type === 'warning' ? 'bg-amber-600' : t.type === 'info' ? 'bg-blue-600' : 'bg-zinc-900'
        }`}
      >
        <span>{t.type === 'warning' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '✓'}</span>
        <span>{t.msg}</span>
      </div>
    ))}
  </div>
)

/* Custom Item Modal component */
const CustomItemModal = ({ onClose, onAdd }) => {
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!itemName.trim() || !itemPrice || isNaN(itemPrice) || parseFloat(itemPrice) <= 0) return
    onAdd(itemName.trim(), parseFloat(itemPrice))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100">
        <h3 className="text-base font-extrabold text-gray-900 mb-1">Add Custom Item</h3>
        <p className="text-xs text-gray-400 mb-4">Create a custom off-menu dish for this token</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Item Name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Special Extra Cheese"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400 focus:bg-white"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Price (₹)</label>
            <input
              type="number"
              step="1"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-yellow-400 focus:bg-white"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!itemName.trim() || !itemPrice || parseFloat(itemPrice) <= 0}
              className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition disabled:opacity-40"
            >
              Add to Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* Payment Modal component */
const PaymentModal = ({ total, onClose, onConfirm }) => {
  const [method, setMethod] = useState('UPI / QR')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get business name from store settings if available
  const businessName = useMemo(() => {
    try {
      const saved = localStorage.getItem('pos_store_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.brandName) return parsed.brandName
        if (parsed.storeName) return parsed.storeName
      }
    } catch (e) {
      console.error(e)
    }
    return 'YourBusinessName'
  }, [])

  // Dynamic Merchant UPI URI format for base merchant VPA: upi://pay?pa=paytmqr659xjb@ptys&pn=YourBusinessName&am=TOTAL_AMOUNT&cu=INR
  const formattedAmount = total.toFixed(2)
  const upiUri = `upi://pay?pa=${BASE_MERCHANT_VPA}&pn=${encodeURIComponent(businessName)}&am=${formattedAmount}&cu=INR`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-100">
        <h3 className="text-base font-extrabold text-gray-900 mb-1">Process Payment</h3>
        <p className="text-xs text-gray-400 mb-4">Select payment method to complete billing</p>
        
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3.5 text-center mb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-800">Total Payable Amount</p>
          <p className="text-2xl font-black text-zinc-900 mt-0.5">₹{formattedAmount}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {['UPI / QR', 'Cash', 'Card'].map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-xl border p-2.5 text-center transition flex flex-col items-center gap-1 ${
                method === m
                  ? 'border-yellow-400 bg-yellow-400 text-zinc-900 font-extrabold shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 font-semibold hover:border-gray-300'
              }`}
            >
              <span className="text-base">{m === 'Cash' ? '💵' : m === 'UPI / QR' ? '📲' : '💳'}</span>
              <span className="text-[11px]">{m}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Store UPI QR Code */}
        {method === 'UPI / QR' && (
          <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50/50 p-3.5 text-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-800 bg-yellow-200/60 px-2.5 py-0.5 rounded-full">
                UPI QR
              </span>
              <span className="text-[11px] font-extrabold text-zinc-900">
                ₹{formattedAmount}
              </span>
            </div>
            
            <div className="mx-auto w-48 h-48 rounded-xl bg-white p-3 border border-gray-200 shadow-md flex items-center justify-center">
              <QRCodeSVG
                value={upiUri}
                size={168}
                level="M"
                includeMargin={false}
                className="w-full h-full"
              />
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="rounded bg-white border border-gray-200 py-1 px-2.5 inline-block">
                <p className="text-[10px] font-bold text-gray-700">
                  UPI ID: <span className="font-mono text-yellow-800 font-extrabold select-all">{BASE_MERCHANT_VPA}</span>
                </p>
              </div>

              {/* Payment App Logos Footer */}
              <div className="pt-1">
                <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Scan &amp; Pay using any UPI App</p>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {/* GPay */}
                  <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-2xs rounded-lg px-2 py-1">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span className="text-[10px] font-extrabold text-gray-700">GPay</span>
                  </div>

                  {/* PhonePe */}
                  <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 shadow-2xs rounded-lg px-2 py-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#5f259f] flex items-center justify-center text-white font-black text-[8px]">
                      पे
                    </div>
                    <span className="text-[10px] font-extrabold text-purple-900">PhonePe</span>
                  </div>

                  {/* Paytm */}
                  <div className="flex items-center gap-1 bg-sky-50 border border-sky-200 shadow-2xs rounded-lg px-2 py-1">
                    <span className="text-[11px] font-black tracking-tighter text-[#002e6e]">
                      Pay<span className="text-[#00baf2]">tm</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            disabled={isSubmitting}
            onClick={async () => {
              if (isSubmitting) return
              setIsSubmitting(true)
              try {
                // Phase 1 executes synchronously inside confirmPayment;
                // modal will unmount after this call returns.
                await onConfirm(method)
              } finally {
                // Guard reset is a safety net — modal is already unmounted
                // by the time this fires, so this is effectively a no-op.
                setIsSubmitting(false)
              }
            }}
            className="rounded-xl bg-green-600 px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Drafts Modal component */
const DraftModal = ({ drafts, onClose, onRestore, onDelete }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-gray-900">Saved Draft Orders</h3>
          <p className="text-xs text-gray-400">Restore or manage saved order drafts</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {drafts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="text-3xl">📂</span>
            <p className="text-xs font-bold mt-2">No saved drafts</p>
          </div>
        ) : (
          drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 hover:border-yellow-400 transition">
              <div>
                <p className="text-xs font-extrabold text-gray-900">Draft #{d.id.slice(-4)}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                  <span>📞 {d.customerPhone || 'Guest'}</span>
                  <span>👤 {d.customerName || 'No Name'}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{d.savedAt} • Total: <span className="font-bold text-gray-700">₹{d.total.toFixed(2)}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRestore(d)}
                  className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-extrabold text-zinc-900 shadow-xs hover:bg-yellow-500 transition"
                >
                  Restore
                </button>
                <button
                  onClick={() => onDelete(d.id)}
                  className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 transition"
                >
                  <Icon d={ICON_TRASH} size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)

/* Product Card component */
const ProductCard = ({ item, qty, onAdd }) => (
  <button
    onClick={() => onAdd(item)}
    className="relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-150 hover:border-yellow-400 hover:shadow-md active:scale-95 group text-left cursor-pointer"
  >
    <div className="relative overflow-hidden bg-gray-100">
      <img
        src={item.img || item.image || "/images/placeholder.jpg"}
        alt={item.name}
        className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-105"
        onError={(e) => { e.target.src = "/images/placeholder.jpg" }}
      />
      {qty > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-extrabold text-zinc-900 shadow">
          {qty}
        </span>
      )}
    </div>
    <div className="flex flex-col gap-0.5 p-2.5">
      <p className="line-clamp-2 text-[11px] font-bold text-gray-900 leading-tight">{item.name}</p>
      <p className="text-xs font-extrabold text-yellow-600">
        {typeof item.price === "number" ? `₹${item.price.toFixed(2)}` : item.price}
      </p>
    </div>
  </button>
)

/* ════════════════════════════════════════════════════════════════════
   Order — Main POS Screen
══════════════════════════════════════════════════════════════════ */
const Order = () => {
  const [tokens, setTokens] = useState(() => {
    const saved = localStorage.getItem('pos_tokens')
    if (saved) {
      try {
        return new Map(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    }
    return new Map()
  })

  const [activeToken,         setActiveToken]         = useState(null)
  const [activeCategory,      setActiveCategory]      = useState('Show All')
  const [sortOrder,           setSortOrder]           = useState('desc')
  const [searchQuery,         setSearchQuery]         = useState('')
  const [toasts,              setToasts]              = useState([])
  const [drafts,              setDrafts]              = useState(() => {
    const saved = localStorage.getItem('pos_drafts')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error(e)
      }
    }
    return []
  })
  const [showDraftList,       setShowDraftList]       = useState(false)
  const [showPayModal,        setShowPayModal]        = useState(false)
  const [showCustomItemModal, setShowCustomItemModal] = useState(false)
  const [kotTokens,           setKotTokens]           = useState(() => {
    const saved = localStorage.getItem('pos_kot_tokens')
    if (saved) {
      try {
        return new Set(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    }
    return new Set()
  })
  const [editingNoteId,       setEditingNoteId]       = useState(null)
  const [tempNote,            setTempNote]            = useState('')
  const [lastPrintedDoc,      setLastPrintedDoc]      = useState(null)
  const [billingSettings,     setBillingSettings]     = useState(() => {
    const saved = localStorage.getItem('pos_billing_settings')
    return saved ? JSON.parse(saved) : { taxRate: '5.00', taxType: 'inclusive', currency: '₹ INR' }
  })

  useEffect(() => {
    localStorage.setItem('pos_drafts', JSON.stringify(drafts))
  }, [drafts])

  useEffect(() => {
    localStorage.setItem('pos_tokens', JSON.stringify(Array.from(tokens.entries())))
  }, [tokens])

  useEffect(() => {
    localStorage.setItem('pos_kot_tokens', JSON.stringify(Array.from(kotTokens)))
  }, [kotTokens])

  const [menuItems, setMenuItems] = useState([])

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await api.get('/menu')
        if (Array.isArray(res.data)) {
          const itemsData = res.data.map((item) => ({
            ...item,
            id: item._id || item.id,
            img: item.image || item.img || '/images/placeholder.jpg',
            status: item.status || 'Available',
          }))
          setMenuItems(itemsData)
        } else {
          setMenuItems([])
        }
      } catch (err) {
        console.error('Failed to load menu items from backend API:', err)
        setMenuItems([])
      }
    }
    fetchMenu()
  }, [])

  useEffect(() => {
    const fetchBackendSettings = async () => {
      try {
        const res = await api.get('/settings')
        if (res.data) {
          setBillingSettings((prev) => ({
            ...prev,
            gstin: res.data.gstin || prev.gstin || '21ABCDE1234F1Z5',
            invoiceHeader: res.data.invoiceHeader || prev.invoiceHeader || 'Main Road, Cafe Square, Odisha • Ph: 9000000000',
            invoiceFooter: res.data.invoiceFooter || prev.invoiceFooter || 'THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN',
            storeName: res.data.storeName || prev.storeName || 'MAGIXX SWEETS & CAFE',
            taxRate: res.data.taxRate !== undefined ? String(res.data.taxRate) : prev.taxRate,
            taxType: res.data.taxType || prev.taxType,
            currency: res.data.currency || prev.currency,
            // Bluetooth printer config from backend
            kotPrinterName: res.data.kotPrinterName || '',
            kotPrinterServiceUUID: res.data.kotPrinterServiceUUID || '000018f0-0000-1000-8000-00805f9b34fb',
            billingPrinterName: res.data.billingPrinterName || '',
            billingPrinterServiceUUID: res.data.billingPrinterServiceUUID || '000018f0-0000-1000-8000-00805f9b34fb',
          }))
        }
      } catch (err) {
        console.warn('Backend settings fetch warning in order.jsx:', err.message)
      }
    }

    const syncBilling = () => {
      const saved = localStorage.getItem('pos_billing_settings')
      if (saved) {
        try {
          setBillingSettings(JSON.parse(saved))
        } catch (e) {
          console.error(e)
        }
      }
      // Also sync printer settings from localStorage
      const savedPrinters = localStorage.getItem('pos_printer_settings')
      if (savedPrinters) {
        try {
          const parsed = JSON.parse(savedPrinters)
          setBillingSettings((prev) => ({
            ...prev,
            kotPrinterName: parsed.kotPrinterName || prev.kotPrinterName || '',
            kotPrinterServiceUUID: parsed.kotPrinterServiceUUID || prev.kotPrinterServiceUUID || '000018f0-0000-1000-8000-00805f9b34fb',
            billingPrinterName: parsed.billingPrinterName || prev.billingPrinterName || '',
            billingPrinterServiceUUID: parsed.billingPrinterServiceUUID || prev.billingPrinterServiceUUID || '000018f0-0000-1000-8000-00805f9b34fb',
          }))
        } catch (e) {
          console.error(e)
        }
      }
      fetchBackendSettings()
    }
    syncBilling()
    window.addEventListener('storage', syncBilling)
    window.addEventListener('focus', syncBilling)
    return () => {
      window.removeEventListener('storage', syncBilling)
      window.removeEventListener('focus', syncBilling)
    }
  }, [])

  /* Derived states */
  const activeCount = tokens.size
  const atCapacity  = activeCount >= MAX_TOKENS
  const cart        = activeToken ? (tokens.get(activeToken)?.cart ?? []) : []

  const getUnprintedItems = (cartList = []) => {
    return cartList
      .map((item) => {
        const printed = item.printedQty || 0
        const delta = item.qty - printed
        return delta > 0 ? { ...item, deltaQty: delta } : null
      })
      .filter(Boolean)
  }

  const unprintedItems = useMemo(() => getUnprintedItems(cart), [cart])
  const unprintedCount = useMemo(() => unprintedItems.reduce((s, i) => s + i.deltaQty, 0), [unprintedItems])
  const hasUnprinted = unprintedCount > 0

  const taxRatePercent = parseFloat(billingSettings.taxRate || '5.00')
  const taxRateFraction = taxRatePercent / 100
  const isInclusive = billingSettings.taxType === 'inclusive' || !billingSettings.taxType

  const cartBaseSum = cart.reduce((s, c) => s + c.price * c.qty, 0)

  let subtotal = 0
  let taxAmount = 0
  let total = 0

  if (isInclusive) {
    total = cartBaseSum
    taxAmount = total * (taxRateFraction / (1 + taxRateFraction))
    subtotal = total - taxAmount
  } else {
    subtotal = cartBaseSum
    taxAmount = subtotal * taxRateFraction
    total = subtotal + taxAmount
  }

  // CGST + SGST split: each component = half of total tax
  const cgstRate = taxRatePercent / 2
  const sgstRate = taxRatePercent / 2
  const cgstAmount = taxAmount / 2
  const sgstAmount = taxAmount / 2

  const activeCustomerPhone = activeToken ? (tokens.get(activeToken)?.customerPhone ?? '') : ''
  const activeCustomerName = activeToken ? (tokens.get(activeToken)?.customerName ?? '') : ''

  const [customerLookupMap, setCustomerLookupMap] = useState({})

  useEffect(() => {
    const trimmedPhone = activeCustomerPhone.trim()
    if (!trimmedPhone || trimmedPhone.length < 4 || trimmedPhone === '9000000000') return

    if (customerLookupMap[trimmedPhone] !== undefined) return

    let isMounted = true
    const doLookup = async () => {
      try {
        const res = await api.get(`/customers/lookup/${encodeURIComponent(trimmedPhone)}`)
        if (isMounted && res.data) {
          const info = res.data.isReturning ? res.data : null
          setCustomerLookupMap((prev) => ({ ...prev, [trimmedPhone]: info }))

          if (info && info.name && !activeCustomerName && activeToken) {
            setTokens((prev) => {
              const slot = prev.get(activeToken)
              if (!slot) return prev
              const next = new Map(prev)
              next.set(activeToken, { ...slot, customerName: info.name })
              return next
            })
          }
        }
      } catch (e) {
        const savedCustomersRaw = localStorage.getItem('crm_customers')
        if (savedCustomersRaw) {
          try {
            const customers = JSON.parse(savedCustomersRaw)
            const matched = customers.find((c) => c.phone.trim() === trimmedPhone && c.phone !== '9000000000' && !/^WALK-/i.test(c.phone))
            if (matched && isMounted) {
              const info = {
                isReturning: true,
                name: matched.name,
                visits: matched.visits || 1,
                lifetimeSpend: matched.lifetimeSpend || 0,
              }
              setCustomerLookupMap((prev) => ({ ...prev, [trimmedPhone]: info }))
              if (matched.name && !activeCustomerName && activeToken) {
                setTokens((prev) => {
                  const slot = prev.get(activeToken)
                  if (!slot) return prev
                  const next = new Map(prev)
                  next.set(activeToken, { ...slot, customerName: matched.name })
                  return next
                })
              }
            }
          } catch (err) {}
        }
      }
    }

    doLookup()
    return () => { isMounted = false }
  }, [activeCustomerPhone, activeCustomerName, activeToken, customerLookupMap])

  const activeCustomerInfo = useMemo(() => {
    const trimmed = activeCustomerPhone.trim()
    if (!trimmed || trimmed === '9000000000') return null
    return customerLookupMap[trimmed] || null
  }, [activeCustomerPhone, customerLookupMap])

  const setCustomerDetails = (phone, name) => {
    if (!activeToken) return
    setTokens((prev) => {
      const slot = prev.get(activeToken) ?? { cart: [], createdAt: '--:--' }
      const next = new Map(prev)
      next.set(activeToken, { ...slot, customerPhone: phone, customerName: name })
      return next
    })

    const trimmedPhone = phone.trim()
    if (trimmedPhone.length >= 10) {
      const savedCustomersRaw = localStorage.getItem('crm_customers')
      let customers = savedCustomersRaw ? JSON.parse(savedCustomersRaw) : []
      const matched = customers.find((c) => c.phone.trim() === trimmedPhone)
      if (matched && name && !matched.name) {
        matched.name = name
        localStorage.setItem('crm_customers', JSON.stringify(customers))
      }
    }
  }

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  const fmtToken = (n) => `#${String(n).padStart(2, '0')}`

  const selectToken = (num) => {
    setActiveToken(num)
    setTokens((prev) => {
      if (prev.has(num)) return prev
      const next = new Map(prev)
      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      next.set(num, { cart: [], createdAt: now, customerPhone: '', customerName: '', orderType: 'Dine-in' })
      return next
    })
  }

  const clearToken = (num) => {
    setTokens((prev) => { const n = new Map(prev); n.delete(num); return n })
    setKotTokens((prev) => { const n = new Set(prev); n.delete(num); return n })
    if (activeToken === num) setActiveToken(null)
  }

  const updateCart = (updater) => {
    if (!activeToken) return
    setTokens((prev) => {
      const slot = prev.get(activeToken) ?? { cart: [], createdAt: '--:--' }
      const next = new Map(prev)
      next.set(activeToken, { ...slot, cart: updater(slot.cart) })
      return next
    })
  }

  const addToCart = (item) => {
    if (!activeToken) {
      toast('Select a token first to start an order!', 'warning')
      return
    }
    updateCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1, printedQty: 0, note: '' }]
    })
  }

  const handleAddCustomItem = (name, price) => {
    if (!activeToken) {
      toast('Select a token first to add a custom item!', 'warning')
      return
    }
    const customItem = {
      id: `custom-${Date.now()}`,
      name,
      price,
      category: 'Custom',
      img: '/images/placeholder.jpg',
    }
    addToCart(customItem)
    setShowCustomItemModal(false)
    toast(`Added "${name}" (₹${price.toFixed(2)}) to Token ${fmtToken(activeToken)}`, 'success')
  }

  const activeTokenSlot = activeToken ? tokens.get(activeToken) : null
  const kotSent = Boolean(activeToken && (kotTokens.has(activeToken) || activeTokenSlot?.kotPrinted || cart.some((i) => (i.printedQty || 0) > 0)))

  const changeQty = (id, delta) => {
    const item = cart.find((c) => c.id === id)
    if (!item) return

    const printedQty = item.printedQty || 0
    if (delta < 0 && (kotSent || printedQty > 0)) {
      if (item.qty <= printedQty || printedQty > 0) {
        toast(`Cannot reduce "${item.name}" once KOT has been printed and sent to kitchen!`, 'warning')
        return
      }
    }

    updateCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0)
    )
  }

  const removeItem = (id) => {
    const item = cart.find((c) => c.id === id)
    if (!item) return

    const printedQty = item.printedQty || 0
    if (kotSent || printedQty > 0) {
      toast(`Cannot remove "${item.name}" once KOT has been printed and sent to kitchen!`, 'warning')
      return
    }

    updateCart((prev) => prev.filter((c) => c.id !== id))
    toast(`Removed "${item.name}" from order`, 'info')
  }

  const startEditNote = (id, currentNote) => {
    setEditingNoteId(id)
    setTempNote(currentNote || '')
  }

  const saveNote = (id) => {
    updateCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, note: tempNote.trim() } : c))
    )
    setEditingNoteId(null)
    setTempNote('')
  }

  const activeOrderType = activeToken ? (tokens.get(activeToken)?.orderType ?? 'Dine-in') : 'Dine-in'
  const isAggregatorOrder = activeOrderType === 'Zomato' || activeOrderType === 'Eat Odia'

  const setOrderType = (orderType) => {
    if (!activeToken) return
    setTokens((prev) => {
      const slot = prev.get(activeToken) ?? { cart: [], createdAt: '--:--' }
      const next = new Map(prev)
      next.set(activeToken, { ...slot, orderType })
      return next
    })
  }

  const activeOrderStatus = activeTokenSlot?.status ?? 'Active'

  const handleKOT = async () => {
    if (cart.length === 0 || !activeToken) return
    const deltaItems = getUnprintedItems(cart)
    const deltaTotalCount = deltaItems.reduce((acc, i) => acc + i.deltaQty, 0)
    const isSubsequent = Boolean(activeTokenSlot?.kotPrinted)

    if (isSubsequent && deltaTotalCount === 0) {
      toast(`All items for Token ${fmtToken(activeToken)} have already been sent to kitchen`, 'info')
      return
    }

    const currentToken = tokens.get(activeToken)
    const printItems = (deltaItems.length > 0 ? deltaItems : cart).map((i) => ({
      name: i.name,
      qty: i.deltaQty || i.qty,
      price: i.price,
      note: i.note || '',
    }))

    const isRegisteredCustomer = (cName) => {
      if (!cName || typeof cName !== 'string') return false
      const trimmed = cName.trim()
      if (!trimmed) return false
      return !/^(walk-?in|walk-?in guest|guest|unregistered|default)$/i.test(trimmed)
    }

    const lineSeparatorDouble = '='.repeat(32)
    const lineSeparatorSingle = '-'.repeat(32)
    const storeName = billingSettings.storeName || 'MAGIXX SWEETS & CAFE'
    const kotTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const formattedOrderType = String(activeOrderType || 'Dine-in').toUpperCase()

    const kotReceiptLines = [
      lineSeparatorDouble,
      ...wrapAndCenterText(storeName, 32),
      ...wrapAndCenterText('*** KITCHEN ORDER TICKET ***', 32),
      lineSeparatorDouble,
      `Token : #${fmtToken(activeToken)}`.slice(0, 32),
      `Time  : ${kotTime}`.slice(0, 32),
      isRegisteredCustomer(currentToken?.customerName) ? `Name  : ${currentToken.customerName.trim()}`.slice(0, 32) : '',
      lineSeparatorSingle,
      centerText(`*** TYPE: ${formattedOrderType} ***`).slice(0, 32),
      lineSeparatorSingle,
    ].filter(Boolean)

    const formatNoteLines = (noteText, width = 32) => {
      const notePrefix = '   Note: '
      const indentSpaces = ' '.repeat(notePrefix.length)
      const maxContentLen = width - notePrefix.length
      const words = String(noteText || '').trim().split(/\s+/)
      const resultLines = []
      let currentLine = ''

      words.forEach((word) => {
        if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxContentLen) {
          currentLine += (currentLine ? ' ' : '') + word
        } else {
          if (currentLine) resultLines.push(currentLine)
          currentLine = word.slice(0, maxContentLen)
        }
      })
      if (currentLine) resultLines.push(currentLine)

      return resultLines.map((l, idx) => `${idx === 0 ? notePrefix : indentSpaces}${l}`)
    }

    printItems.forEach((i) => {
      const qtyPrefix = `${i.qty}x `.padEnd(4)
      const indentSpaces = '    '
      const name = i.name || 'Item'
      const words = String(name).trim().split(/\s+/)
      const nameLines = []
      let currentLine = ''

      words.forEach((word) => {
        if ((currentLine + (currentLine ? ' ' : '') + word).length <= 28) {
          currentLine += (currentLine ? ' ' : '') + word
        } else {
          if (currentLine) nameLines.push(currentLine)
          let remaining = word
          while (remaining.length > 28) {
            nameLines.push(remaining.slice(0, 28))
            remaining = remaining.slice(28)
          }
          currentLine = remaining
        }
      })
      if (currentLine) nameLines.push(currentLine)

      nameLines.forEach((nLine, idx) => {
        if (idx === 0) {
          kotReceiptLines.push(`${qtyPrefix}${nLine}`)
        } else {
          kotReceiptLines.push(`${indentSpaces}${nLine}`)
        }
      })

      if (i.note && i.note.trim()) {
        const formattedNotes = formatNoteLines(i.note.trim(), 32)
        kotReceiptLines.push(...formattedNotes)
      }
    })

    kotReceiptLines.push(lineSeparatorDouble)
    kotReceiptLines.push(centerText('*** SENT TO KITCHEN ***'))

    const kotReceiptText = kotReceiptLines.join('\n')

    // Attempt native silent print targeting saved Kitchen printer — only commit state if print succeeds
    const printed = await sendToBluetoothPrinter('kot', kotReceiptText, toast)
    if (!printed) return

    // Print succeeded — now commit KOT state
    setKotTokens((prev) => new Set([...prev, activeToken]))

    setTokens((prev) => {
      const slot = prev.get(activeToken)
      if (!slot) return prev
      const updatedCart = (slot.cart || []).map((item) => ({
        ...item,
        printedQty: item.qty,
      }))
      const next = new Map(prev)
      next.set(activeToken, {
        ...slot,
        cart: updatedCart,
        kotPrinted: true,
        status: isAggregatorOrder ? 'Delivered to Rider' : slot.status,
      })
      return next
    })

    const kotDoc = {
      type: 'KOT',
      tokenNumber: activeToken,
      orderType: activeOrderType,
      items: printItems,
      customerName: currentToken?.customerName || '',
      customerPhone: currentToken?.customerPhone || '',
      time: kotTime,
    }
    setLastPrintedDoc(kotDoc)

    if (isAggregatorOrder) {
      const partnerName = currentToken?.customerName?.trim() || `${activeOrderType} Partner`
      const partnerPhone = currentToken?.customerPhone?.trim() || `Online Aggregator (${activeOrderType})`

      const savedCustomersRaw = localStorage.getItem('crm_customers')
      let customers = savedCustomersRaw ? JSON.parse(savedCustomersRaw) : []
      let customer = customers.find((c) => c.name === partnerName || (c.phone === partnerPhone && !partnerPhone.startsWith('Online Aggregator')))

      if (!customer) {
        customer = {
          id: `cust-agg-${activeOrderType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: partnerName,
          phone: partnerPhone,
          createdAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          orderHistory: [],
        }
        customers.push(customer)
      }

      const completedOrder = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: kotTime,
        items: [...cart],
        subtotal,
        tax: taxAmount,
        total,
        paymentMethod: activeOrderType,
        orderType: activeOrderType,
        channel: activeOrderType,
      }

      customer.orderHistory.push(completedOrder)
      localStorage.setItem('crm_customers', JSON.stringify(customers))
      window.dispatchEvent(new Event('pos_crm_updated'))

      toast(`KOT Printed & sent to kitchen — Token ${fmtToken(activeToken)}`, 'success')
    } else {
      if (isSubsequent && deltaTotalCount > 0) {
        toast(`KOT Addition printed — ${deltaTotalCount} new item(s) sent to kitchen for Token ${fmtToken(activeToken)}`, 'success')
      } else {
        toast(`KOT printed & sent to kitchen — Token ${fmtToken(activeToken)}`, 'success')
      }
    }
  }

  const handleDeliveredToRider = () => {
    if (!activeToken) return
    toast(`Order status updated to "Customer Left" — Token ${fmtToken(activeToken)} cleared ✓`, 'success')
    clearToken(activeToken)
  }

  const handleDraft = () => {
    if (cart.length === 0 || !activeToken) return
    const currentToken = tokens.get(activeToken)
    const phone = currentToken?.customerPhone ?? ''
    const name = currentToken?.customerName ?? ''

    const draft = {
      id: `draft-${Date.now()}`,
      savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      cart: cart.map((c) => ({ ...c, printedQty: c.printedQty || 0 })),
      customerPhone: phone,
      customerName: name,
      orderType: activeOrderType,
      kotPrinted: kotTokens.has(activeToken) || Boolean(currentToken?.kotPrinted),
      total,
    }

    setDrafts((prev) => [draft, ...prev])
    setTokens((prev) => {
      const next = new Map(prev)
      next.delete(activeToken)
      return next
    })
    setKotTokens((prev) => {
      const next = new Set(prev)
      next.delete(activeToken)
      return next
    })
    setActiveToken(null)
    toast('Order saved as draft', 'info')
  }

  const restoreDraft = (draft) => {
    let targetToken = activeToken
    if (!targetToken) {
      targetToken = TOKEN_NUMS.find((n) => !tokens.has(n)) || 1
      setActiveToken(targetToken)
    }

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const isPrinted = Boolean(draft.kotPrinted)
    const restoredCart = (draft.cart || []).map((item) => ({
      ...item,
      printedQty: item.printedQty ?? (isPrinted ? item.qty : 0),
    }))

    const cleanCustomerField = (val) => {
      if (!val) return ''
      const s = String(val).trim()
      if (s === '???' || s === '??' || s === '️') return ''
      return s
    }

    setTokens((prev) => {
      const slot = prev.get(targetToken) ?? { cart: [], createdAt: now, orderType: 'Dine-in' }
      const next = new Map(prev)
      next.set(targetToken, {
        ...slot,
        cart: restoredCart,
        customerPhone: cleanCustomerField(draft.customerPhone),
        customerName: cleanCustomerField(draft.customerName),
        orderType: draft.orderType || slot.orderType || 'Dine-in',
        kotPrinted: isPrinted,
        status: isPrinted && (draft.orderType === 'Zomato' || draft.orderType === 'Eat Odia') ? 'Delivered to Rider' : slot.status,
        createdAt: slot.createdAt || now,
      })
      return next
    })

    if (isPrinted) {
      setKotTokens((prev) => new Set([...prev, targetToken]))
    } else {
      setKotTokens((prev) => {
        const next = new Set(prev)
        next.delete(targetToken)
        return next
      })
    }

    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
    setShowDraftList(false)
    toast(`Draft restored to Token ${fmtToken(targetToken)}${isPrinted ? ' (KOT Already Printed ✓)' : ''}`, 'success')
  }

  const handleBillPayment = () => {
    if (cart.length === 0 || !activeToken) return
    setShowPayModal(true)
  }

  /**
   * printFinalBill — fire-and-forget USB thermal billing receipt helper.
   * Called via setTimeout after the payment modal has already been closed,
   * so it never blocks the UI or causes modal lock-up.
   *
   * Sends the bill text directly to the Electron IPC 'print-receipt' handler
   * via window.electronAPI.printReceipt — no bluetooth abstraction layer.
   *
   * @param {string} receiptText  Pre-built plain-text receipt content
   * @param {Function} toastFn    Toast callback (type: 'success' | 'warning' | 'error')
   */
  const printFinalBill = async (receiptText, toastFn) => {
    // ── Guard 1: Printer configured? ────────────────────────────────────────
    const printerConfig = getPrinterConfig('billing')
    if (!printerConfig?.name?.trim()) {
      console.warn('[printFinalBill] No USB billing printer name configured in Settings. Aborting print.')
      toastFn('USB Printer Error: No billing printer selected. Go to Settings to configure.', 'error')
      return
    }

    const printerName = printerConfig.name.trim()

    // ── Guard 2: Electron IPC bridge available? ──────────────────────────────
    if (!window.electronAPI || typeof window.electronAPI.printReceipt !== 'function') {
      console.warn('[printFinalBill] window.electronAPI.printReceipt is not available (non-Electron context).')
      toastFn('USB Printer Error: Print bridge unavailable. Restart the POS app.', 'error')
      return
    }

    // ── Direct IPC print call ────────────────────────────────────────────────
    try {
      console.log(`[printFinalBill] Invoking IPC print-receipt on USB printer: "${printerName}"`)
      const result = await window.electronAPI.printReceipt({
        printerName,
        textContent: receiptText,
      })

      if (result?.success) {
        console.log(`[printFinalBill] ✓ Receipt printed successfully on "${printerName}".`)
        toastFn('Receipt printed successfully!', 'success')
      } else {
        const reason = result?.error || 'Unknown USB print failure'
        console.error(`[printFinalBill] ✗ USB print failed on "${printerName}": ${reason}`)
        toastFn(`USB Printer Error: ${reason}. Check connection or Settings.`, 'error')
      }
    } catch (printErr) {
      console.error('[printFinalBill] ✗ Exception during USB IPC print call:', printErr)
      toastFn(
        `USB Printer Error: ${printErr?.message || 'Check connection or Settings'}.`,
        'error'
      )
    }
  }

  const confirmPayment = async (method = 'Cash') => {
    const currentToken = tokens.get(activeToken)
    const phone = (currentToken?.customerPhone || '').trim()
    const name = (currentToken?.customerName || '').trim() || (isAggregatorOrder ? `${activeOrderType} Guest` : 'Walk-in Guest')

    let normalizedMethod = 'Cash'
    if (isAggregatorOrder || activeOrderType === 'Zomato' || activeOrderType === 'Swiggy' || method.includes('Aggregator') || method.includes('Zomato') || method.includes('Swiggy')) {
      normalizedMethod = activeOrderType === 'Zomato' ? 'Zomato' : activeOrderType === 'Swiggy' ? 'Swiggy' : 'Aggregator'
    } else if (method.includes('UPI')) {
      normalizedMethod = 'UPI'
    } else if (method.includes('Card')) {
      normalizedMethod = 'Card'
    } else {
      normalizedMethod = 'Cash'
    }

    const isValidHex = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())

    const validOrderItems = (cart || []).map((c) => ({
      menuItem: isValidHex(c._id) ? c._id.trim() : isValidHex(c.id) ? c.id.trim() : undefined,
      name: c.name || 'Dish Item',
      quantity: Math.max(1, Number(c.qty || c.quantity || 1)),
      price: Math.max(0, Number(c.price || 0)),
      note: (c.note || '').trim(),
    }))

    if (validOrderItems.length === 0) {
      toast('Cart is empty. Please add items to cart before checkout.', 'error')
      return
    }

    // Build the bill receipt text before attempting print
    const isRegisteredCustomerName = (cName) => {
      if (!cName || typeof cName !== 'string') return false
      const trimmed = cName.trim()
      if (!trimmed) return false
      return !/^(walk-?in|walk-?in guest|guest|unregistered|default)$/i.test(trimmed)
    }

    const storeName = billingSettings.storeName || 'MAGIXX SWEETS & CAFE'
    const invoiceHeader = billingSettings.invoiceHeader || 'Opposite Kalyan Mandap, Near Joda Bus Stand, Odisha • Ph: 7001322855'
    const gstinText = billingSettings.gstin ? `GSTIN: ${billingSettings.gstin}` : ''
    const footerText = billingSettings.invoiceFooter || billingSettings.footerNotes || 'THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN'

    const formatBillItemRows = (items, width = 32) => {
      const resultLines = []
      items.forEach((c) => {
        const itemQty = String(c.qty).padStart(3)
        const itemRate = Number(c.price).toFixed(2).padStart(6)
        const lineTotal = (Number(c.price) * Number(c.qty)).toFixed(2).padStart(6)

        const words = String(c.name || 'Item').trim().split(/\s+/)
        const nameLines = []
        let currentLine = ''

        words.forEach((word) => {
          if ((currentLine + (currentLine ? ' ' : '') + word).length <= 14) {
            currentLine += (currentLine ? ' ' : '') + word
          } else {
            if (currentLine) nameLines.push(currentLine)
            let remaining = word
            while (remaining.length > 14) {
              nameLines.push(remaining.slice(0, 14))
              remaining = remaining.slice(14)
            }
            currentLine = remaining
          }
        })
        if (currentLine) nameLines.push(currentLine)

        nameLines.forEach((nLine, idx) => {
          const paddedName = nLine.padEnd(14)
          if (idx === 0) {
            resultLines.push(`${paddedName} ${itemQty} ${itemRate} ${lineTotal}`)
          } else {
            resultLines.push(`${paddedName}                   `)
          }
        })
      })
      return resultLines
    }

    const now = new Date()
    const billDate = now.toLocaleDateString('en-IN')
    const billTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    const tempOrderId = `ORD-${Date.now().toString().slice(-6)}`

    const billReceiptText = [
      '================================',
      ...wrapAndCenterText(storeName, 32),
      ...wrapAndCenterText(invoiceHeader, 32),
      ...(gstinText ? wrapAndCenterText(gstinText, 32) : []),
      '================================',
      `Date  : ${billDate}  ${billTime}`,
      `Type  : ${(activeOrderType || 'Dine-in').toUpperCase()}`,
      isRegisteredCustomerName(name) ? `Name  : ${name.trim()}` : '',
      phone && phone.trim() ? `Phone : ${phone.trim()}` : '',
      `Pay   : ${normalizedMethod}`,
      '--------------------------------',
      'ITEM           QTY   RATE  TOTAL',
      '--------------------------------',
      ...formatBillItemRows(cart || [], 32),
      '--------------------------------',
      `SUBTOTAL     : Rs. ${Number(subtotal).toFixed(2)}`,
      `CGST ${cgstRate.toFixed(2).padStart(4)}%  : Rs. ${Number(cgstAmount).toFixed(2)}`,
      `SGST ${sgstRate.toFixed(2).padStart(4)}%  : Rs. ${Number(sgstAmount).toFixed(2)}`,
      '================================',
      `GRAND TOTAL  : Rs. ${Number(total).toFixed(2)}`,
      '================================',
      '--------------------------------',
      ...wrapAndCenterText(footerText, 32),
    ].filter(Boolean).join('\n')

    try {
      let customerId = null
      if (!isAggregatorOrder && phone && phone.length >= 10) {
        try {
          const custRes = await api.post('/customers', { name, phone })
          if (custRes.data && custRes.data._id) {
            customerId = custRes.data._id
          }
        } catch {
          try {
            const custsRes = await api.get(`/customers?search=${encodeURIComponent(phone)}`)
            if (custsRes.data && Array.isArray(custsRes.data) && custsRes.data.length > 0) {
              customerId = custsRes.data[0]._id
            }
          } catch (e) {
            console.warn('Customer lookup fallback warning:', e)
          }
        }
      }

      const orderPayload = {
        items: validOrderItems,
        subtotal: Number(subtotal || 0),
        tax: Number(taxAmount || 0),
        cgst: Number(cgstAmount || 0),
        sgst: Number(sgstAmount || 0),
        total: Number(total || 0),
        paymentMethod: normalizedMethod,
        orderType: activeOrderType || 'Dine-in',
        channel: activeOrderType || 'Dine-in',
        tableNumber: activeOrderType === 'Dine-in' ? `Table ${activeToken}` : activeOrderType,
        customerId: isValidHex(customerId) ? customerId : undefined,
        customerPhone: phone || undefined,
        customerName: name || undefined,
      }

      const orderRes = await api.post('/orders', orderPayload)
      const orderData = orderRes.data

      const billDoc = {
        type: 'BILL',
        orderId: orderData._id ? `ORD-${String(orderData._id).slice(-6).toUpperCase()}` : tempOrderId,
        tokenNumber: orderData.tokenNumber || activeToken,
        items: (cart || []).map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
        subtotal: Number(subtotal || 0),
        taxAmount: Number(taxAmount || 0),
        total: Number(total || 0),
        paymentMethod: normalizedMethod,
        customerName: name,
        customerPhone: phone,
        date: billDate,
        time: billTime,
      }

      // ── Phase 1: Settle order state & close modal synchronously ──────────────
      // All UI state mutations happen here, before any async print I/O.
      // React will commit these state updates and unmount the modal as soon as
      // confirmPayment returns (or awaits the next microtask), preventing any
      // UI lockup or modal blocking from the subsequent IPC print call.
      setLastPrintedDoc(billDoc)
      setShowPayModal(false)  // ← Modal closes here; Phase 2 runs AFTER unmount
      clearToken(activeToken)
      window.dispatchEvent(new Event('pos:data-updated'))
      toast(`Payment (${normalizedMethod}) Successful`, 'success')

      // ── Phase 2: Fire-and-forget thermal print (deferred past current call stack) ─
      // setTimeout(..., 0) yields back to the React event loop, guaranteeing the
      // modal is fully unmounted before the blocking Electron IPC print call begins.
      // This prevents UI lockup on slow USB thermal printers and virtual print drivers.
      const receiptTextSnapshot = billReceiptText  // capture before any state mutation
      const toastSnapshot = toast                  // stable reference for the closure
      setTimeout(() => {
        printFinalBill(receiptTextSnapshot, toastSnapshot).catch((unexpectedErr) => {
          // Safety net: printFinalBill is already fully try/caught internally.
          // This outer catch handles any Promise-level rejection that escapes it.
          console.error('[confirmPayment] Unhandled rejection in printFinalBill:', unexpectedErr)
        })
      }, 0)
    } catch (err) {
      console.error('Order submission error:', err)
      const errMsg = err.response?.data?.message || err.message || 'Error processing order backend submission'
      toast(errMsg, 'error')
    }
  }

  const getCategoryItems = useCallback((catName) => {
    const items = menuItems.filter((i) => i.category === catName && i.status !== 'inactive')
    return [...items].sort((a, b) =>
      sortOrder === 'asc' ? a.price - b.price : b.price - a.price
    )
  }, [menuItems, sortOrder])

  const filteredMenuItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return menuItems.filter((i) => i.status !== 'inactive')
    return menuItems.filter(
      (i) => i.status !== 'inactive' && (i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    )
  }, [menuItems, searchQuery])

  // Dynamically derive categories from the live menuItems loaded from backend in exact specified order
  const derivedCategories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.filter((i) => i.status !== 'inactive').map((i) => i.category)))
    const sortedCats = CATEGORIES_ORDER.filter((c) => cats.includes(c))
    const extraCats = cats.filter((c) => !CATEGORIES_ORDER.includes(c))
    return ['Show All', ...sortedCats, ...extraCats]
  }, [menuItems])

  return (
    <>
      <Toast toasts={toasts} />

      {showCustomItemModal && (
        <CustomItemModal
          onClose={() => setShowCustomItemModal(false)}
          onAdd={handleAddCustomItem}
        />
      )}

      {showPayModal && (
        <PaymentModal
          total={total}
          onClose={() => setShowPayModal(false)}
          onConfirm={confirmPayment}
        />
      )}

      {showDraftList && (
        <DraftModal
          drafts={drafts}
          onClose={() => setShowDraftList(false)}
          onRestore={restoreDraft}
          onDelete={(id) => setDrafts((prev) => prev.filter((d) => d.id !== id))}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 text-gray-900 font-sans">
        
        {/* Header Bar */}
        <header className="sticky top-0 z-10 flex flex-wrap sm:flex-nowrap h-auto min-h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-5 py-2 gap-2 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-gray-900 uppercase">MAGIXX POS</h1>
              <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400">Order &amp; Billing Counter</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-bold text-gray-600">
              <span className={`h-2 w-2 rounded-full ${atCapacity ? 'bg-red-500 animate-pulse' : 'bg-green-400'}`} />
              <span>{activeCount}/{MAX_TOKENS} Active</span>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex flex-1 sm:flex-none items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 w-full sm:w-64 md:w-80">
              <Icon d={ICON_SEARCH} size={14} className="shrink-0 text-gray-400" />
              <input
                type="text"
                placeholder="Search dishes or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              )}
            </div>

            <button
              onClick={() => setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 transition"
              title="Sort items by price"
            >
              <Icon d={sortOrder === 'asc' ? ICON_SORT_ASC : ICON_SORT_DSC} size={14} />
              <span className="hidden sm:inline">{sortOrder === 'asc' ? 'Low to High' : 'High to Low'}</span>
            </button>

            <button
              onClick={() => setShowDraftList(true)}
              className="relative flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 transition"
            >
              <Icon d={ICON_DRAFT} size={14} />
              <span className="hidden sm:inline">Drafts</span>
              {drafts.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-black text-zinc-900">
                  {drafts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowCustomItemModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-extrabold text-zinc-900 shadow-sm hover:bg-yellow-500 transition active:scale-95"
            >
              <span className="text-sm font-black">+</span>
              <span className="hidden sm:inline">Custom Item</span>
            </button>
          </div>
        </header>

                {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          
          {/* LEFT: POS Menu Area */}
          <div className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-200 bg-white min-h-[350px] lg:min-h-0">
            {/* Token Selection Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-200 bg-white px-3 sm:px-4 py-2 scrollbar-thin shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 shrink-0 mr-1">
            <span>Tokens:</span>
          </div>

          <button
            onClick={() => { if (!atCapacity) { const next = TOKEN_NUMS.find((n) => !tokens.has(n)); if (next) selectToken(next) } else toast('Café at full capacity!', 'warning') }}
            disabled={atCapacity}
            className="flex h-9 px-3 shrink-0 items-center justify-center gap-1 rounded-xl bg-yellow-400 text-xs font-black text-zinc-900 shadow-xs transition hover:bg-yellow-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>+</span>
            <span>New Token</span>
          </button>

          <div className="h-4 w-px bg-gray-200 shrink-0 mx-1" />

          {TOKEN_NUMS.map((num) => {
            const isActive   = tokens.has(num)
            const isSelected = activeToken === num
            const tokenCart  = tokens.get(num)?.cart ?? []
            const itemCount  = tokenCart.reduce((s, c) => s + c.qty, 0)
            const hasKot     = kotTokens.has(num)

            return (
              <button
                key={num}
                onClick={() => selectToken(num)}
                title={isActive ? `Token ${fmtToken(num)} • ${itemCount} item(s)` : atCapacity ? 'Capacity full' : `Open Token ${fmtToken(num)}`}
                className={`relative flex h-9 shrink-0 items-center justify-center rounded-xl px-3.5 text-xs font-extrabold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white ring-2 ring-yellow-400 shadow-md scale-105'
                    : isActive
                    ? 'bg-yellow-100 text-yellow-950 border border-yellow-300 hover:bg-yellow-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                <span>{fmtToken(num)}</span>
                {isActive && itemCount > 0 && (
                  <span className={`ml-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-black ${
                    isSelected ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-900 text-white'
                  }`}>
                    {itemCount}
                  </span>
                )}
                {hasKot && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                )}
              </button>
            )
          })}
        </div>

            
            {/* Category Navigation Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-100 bg-white px-3 sm:px-4 py-2.5 scrollbar-thin shrink-0">
              {derivedCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                    activeCategory === cat
                      ? 'bg-yellow-400 text-zinc-900 shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat !== 'Show All' && <span>{CATEGORY_EMOJIS[cat] || '🍽️'}</span>}
                  <span>{cat}</span>
                </button>
              ))}
            </div>

            {/* Catalog Grid View */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {searchQuery ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-3">
                    Search Results ({filteredMenuItems.length} dishes found)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredMenuItems.map((item) => {
                      const qty = cart.find((c) => c.id === item.id)?.qty ?? 0
                      return <ProductCard key={item.id} item={item} qty={qty} onAdd={addToCart} />
                    })}
                  </div>
                  {filteredMenuItems.length === 0 && (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                      <span className="text-3xl opacity-30">🍽️</span>
                      <p className="text-sm font-bold text-gray-500">No dishes match "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              ) : activeCategory === 'Show All' ? (
                <div className="space-y-6">
                  {derivedCategories.filter((c) => c !== 'Show All').map((catName) => {
                    const catItems = getCategoryItems(catName)
                    if (catItems.length === 0) return null
                    return (
                      <section key={catName}>
                        <div className="flex items-center justify-between mb-2.5">
                          <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                            <span>{CATEGORY_EMOJIS[catName] || '🍽️'}</span>
                            <span>{catName}</span>
                            <span className="text-xs font-normal text-gray-400">({catItems.length})</span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                          {catItems.map((item) => {
                            const qty = cart.find((c) => c.id === item.id)?.qty ?? 0
                            return <ProductCard key={item.id} item={item} qty={qty} onAdd={addToCart} />
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                (() => {
                  const catItems = getCategoryItems(activeCategory)
                  return (
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                          <span>{CATEGORY_EMOJIS[activeCategory] || '🍽️'}</span>
                          <span>{activeCategory}</span>
                          <span className="text-xs font-normal text-gray-400">({catItems.length} dishes)</span>
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {catItems.map((item) => {
                          const qty = cart.find((c) => c.id === item.id)?.qty ?? 0
                          return <ProductCard key={item.id} item={item} qty={qty} onAdd={addToCart} />
                        })}
                      </div>

                      {catItems.length === 0 && (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                          <span className="text-3xl opacity-30">🍽️</span>
                          <p className="text-sm text-gray-400">No items in this category</p>
                        </div>
                      )}
                    </section>
                  )
                })()
              )}
            </div>
          </div>

          {/* RIGHT: Cart / Order Panel */}
          <aside className="flex w-full lg:w-96 shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-gray-200 bg-white min-h-[350px] lg:min-h-0">

            {/* Cart Header */}
            <div className="border-b border-gray-100 px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-gray-900">
                    {activeToken ? `Token ${fmtToken(activeToken)}` : 'No Token Selected'}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {activeToken
                      ? `Opened at ${tokens.get(activeToken)?.createdAt ?? '--:--'}${kotSent ? ' • KOT Sent ✓' : ''}`
                      : 'Pick a token to begin'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeToken && (
                    <select
                      value={activeOrderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-bold shadow-xs outline-none transition cursor-pointer ${
                        activeOrderType === 'Zomato'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : activeOrderType === 'Eat Odia'
                          ? 'border-orange-300 bg-orange-50 text-orange-700'
                          : activeOrderType === 'Takeaway'
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      <option value="Dine-in">🍽️ Dine-in</option>
                      <option value="Takeaway">📦 Takeaway</option>
                      <option value="Zomato">🛵 Zomato</option>
                      <option value="Eat Odia">🍱 Eat Odia</option>
                    </select>
                  )}
                  {kotSent && (
                    <span className="rounded-lg bg-green-50 border border-green-200 px-2 py-1 text-[10px] font-bold text-green-700">
                      {hasUnprinted ? `✓ KOT (${unprintedCount} New)` : '✓ KOT'}
                    </span>
                  )}
                  {activeToken && (
                    <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      🎟️ {fmtToken(activeToken)}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Details Inputs */}
              {activeToken && (
                <div className="mt-2 border-t border-gray-100 pt-2 shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Customer Profile</span>
                    {activeCustomerInfo?.isReturning && (
                      <span className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-[9px] font-extrabold text-green-700 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span>Returning Customer ({activeCustomerInfo.visits || 1} {activeCustomerInfo.visits === 1 ? 'visit' : 'visits'})</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Phone</label>
                      <input
                        type="text"
                        value={activeCustomerPhone}
                        onChange={(e) => setCustomerDetails(e.target.value, activeCustomerName)}
                        placeholder="e.g. 9876543210"
                        className="mt-0.5 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-900 outline-none focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Name (Opt)</label>
                      <input
                        type="text"
                        value={activeCustomerName}
                        onChange={(e) => setCustomerDetails(activeCustomerPhone, e.target.value)}
                        placeholder="e.g. John Doe"
                        className="mt-0.5 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-900 outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {atCapacity && (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                  <Icon d={ICON_WARN} size={13} className="mt-0.5 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs font-bold text-red-700">Café at Full Capacity ({MAX_TOKENS}/{MAX_TOKENS} Tokens)</p>
                    <p className="text-[10px] text-red-500 leading-tight mt-0.5">Clear a completed token to accept new orders.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Aggregator Order Notice Banner */}
            {isAggregatorOrder && (
              <div className="shrink-0 px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-extrabold">
                    {activeOrderType === 'Zomato' ? 'Z' : 'E'}
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-orange-950 leading-tight">
                      {activeOrderType} Aggregator Order
                    </p>
                    <p className="text-[10px] text-orange-700 leading-tight">
                      Billing handled externally via {activeOrderType}
                    </p>
                  </div>
                </div>
                <span className="rounded bg-orange-200/70 px-2 py-0.5 text-[9px] font-extrabold text-orange-900 uppercase">
                  External Billing
                </span>
              </div>
            )}

            {/* Token Clearing / Customer Left Action */}
            {Boolean(activeToken) && (
              <div className={`shrink-0 px-4 py-1.5 border-b ${kotSent ? 'border-gray-200 bg-gray-50' : 'border-red-100 bg-red-50'}`}>
                <button
                  disabled={kotSent}
                  onClick={() => {
                    if (kotSent) {
                      toast(`"Customer Left" option is disabled once KOT has been printed!`, 'warning')
                      return
                    }
                    clearToken(activeToken)
                    toast(`Customer Left — Token ${fmtToken(activeToken)} cleared`, 'info')
                  }}
                  title={kotSent ? 'Customer Left is disabled because KOT has already been printed & sent to kitchen' : `Customer Left — Token ${fmtToken(activeToken)}`}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                    kotSent
                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                      : 'border-red-200 bg-white text-red-600 shadow-xs hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-md active:scale-95 cursor-pointer'
                  }`}
                >
                  <Icon d={ICON_EXIT} size={14} />
                  <span>
                    {kotSent
                      ? `Customer Left — Disabled (KOT Printed)`
                      : `Customer Left — Token ${fmtToken(activeToken)}`}
                  </span>
                </button>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100/80 bg-gray-50/20">
              {!activeToken ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100/80 shadow-2xs">
                    <Icon d={ICON_TOKEN} size={28} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No token active</p>
                  <p className="text-xs text-gray-400 max-w-[200px]">Open a token from the strip above to start an order</p>
                </div>
              ) : cart.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-50/80 border border-yellow-100 shadow-2xs">
                    <span className="text-3xl">🛒</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Cart is empty</p>
                  <p className="text-xs text-gray-400 max-w-[200px]">Tap any dish to add it to Token {fmtToken(activeToken)}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="px-4 py-3 bg-white hover:bg-yellow-50/30 transition-colors duration-150 border-b border-gray-100/60 last:border-b-0">
                      <div className="flex items-center gap-2.5">
                        {/* Name / Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
                            <p className="truncate text-[13px] font-bold text-gray-900" title={item.name}>{item.name}</p>
                            {item.category === 'Custom' && (
                              <span className="rounded bg-yellow-100 px-1 py-0.25 text-[8px] font-bold text-yellow-800">
                                Custom
                              </span>
                            )}
                          </div>

                          {/* Price Display & Note Pill */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10.5px] font-bold text-gray-600">
                              ₹{item.price.toFixed(2)} each
                            </span>
                            <span className="text-gray-300 text-[10px]">•</span>

                            {/* Note button & attached note pill */}
                            <button
                              onClick={() => startEditNote(item.id, item.note)}
                              className={`inline-flex items-center gap-0.5 text-[10px] font-semibold transition ${
                                item.note ? 'text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold' : 'text-gray-400 hover:text-yellow-600'
                              }`}
                              title={item.note ? `Edit note: "${item.note}"` : 'Add note to item'}
                            >
                              <Icon d={ICON_NOTE} size={10} />
                              {item.note ? `"${item.note}"` : 'Note'}
                            </button>
                          </div>
                        </div>

                        {/* Qty controls + Price Total */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {/* Qty Stepper */}
                          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
                            <button
                              onClick={() => changeQty(item.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-white hover:text-red-500 transition active:scale-95 cursor-pointer"
                            >
                              <Icon d={ICON_MINUS} size={12} />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-gray-800">{item.qty}</span>
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-yellow-400 hover:text-zinc-900 transition active:scale-95 cursor-pointer"
                            >
                              <Icon d={ICON_PLUS} size={12} />
                            </button>
                          </div>

                          {/* Total Price for item */}
                          <span className="w-16 text-right text-xs font-bold text-gray-900">
                            ₹{(item.price * item.qty).toFixed(2)}
                          </span>

                          {/* Remove button */}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-gray-300 hover:text-red-400 transition"
                            title="Remove item"
                          >
                            <Icon d={ICON_TRASH} size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Dedicated Inline Note Input Row (Renders cleanly on its own row below item details) */}
                      {editingNoteId === item.id && (
                        <div className="mt-2 pt-1.5 border-t border-dashed border-gray-200 flex items-center gap-1.5 w-full">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={tempNote}
                              onChange={(e) => setTempNote(e.target.value)}
                              placeholder="Add instruction (e.g. extra spicy, no onions)..."
                              className="w-full rounded-lg border border-yellow-400 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 outline-none shadow-xs focus:ring-2 focus:ring-yellow-200"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveNote(item.id)
                                if (e.key === 'Escape') setEditingNoteId(null)
                              }}
                            />
                          </div>
                          <button
                            onClick={() => saveNote(item.id)}
                            className="rounded-lg bg-yellow-400 px-3 py-1 text-xs font-bold text-zinc-900 shadow-xs hover:bg-yellow-500 transition active:scale-95 shrink-0"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtotal breakdown */}
            <div className="border-t border-gray-200 px-4 py-2 space-y-1 shrink-0 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Sub total</span>
                <span className="font-medium text-gray-700">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>CGST ({cgstRate.toFixed(2)}% {isInclusive ? 'Incl.' : 'Excl.'})</span>
                <span className="font-medium text-orange-500">+ ₹{cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>SGST ({sgstRate.toFixed(2)}% {isInclusive ? 'Incl.' : 'Excl.'})</span>
                <span className="font-medium text-orange-600">+ ₹{sgstAmount.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-gray-200 pt-1.5">
                <span className="text-sm font-extrabold text-gray-900">Total</span>
                <span className="text-lg font-extrabold text-gray-900">₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="shrink-0 border-t border-gray-200 p-2.5 space-y-1.5 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={cart.length === 0 || !activeToken || (kotSent && !hasUnprinted)}
                  onClick={handleKOT}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold shadow-xs transition active:scale-95 disabled:cursor-not-allowed cursor-pointer ${
                    kotSent && !hasUnprinted
                      ? 'bg-green-50 text-green-700 border border-green-200 opacity-90'
                      : 'bg-gray-900 text-white hover:bg-black disabled:opacity-40'
                  }`}
                >
                  <Icon d={ICON_PRINT} size={13} />
                  {hasUnprinted && activeTokenSlot?.kotPrinted
                    ? `KOT (${unprintedCount} New)`
                    : kotSent && !hasUnprinted
                    ? '✓ KOT Sent'
                    : 'KOT & Print'}
                </button>

                <button
                  disabled={cart.length === 0 || !activeToken}
                  onClick={handleDraft}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-1.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Icon d={ICON_DRAFT} size={13} />
                  Draft
                </button>
              </div>

              {isAggregatorOrder ? (
                !kotSent ? (
                  <button
                    disabled={true}
                    className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-gray-400 py-2.5 text-xs font-bold text-white shadow-xs opacity-60 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>🛵</span>
                      <span>Delivered to Rider (Print KOT First)</span>
                    </div>
                    <span className="text-[9px] font-semibold text-gray-200">Execute KOT &amp; Print first to enable rider handover</span>
                  </button>
                ) : (
                  <button
                    onClick={() => confirmPayment(activeOrderType || 'Aggregator')}
                    className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-orange-600 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-orange-700 active:scale-95 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      <span>🛵</span>
                      <span>Delivered to Rider ({activeOrderType})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-orange-100">Handover Order &amp; Finalize Checkout</span>
                  </button>
                )
              ) : (
                <button
                  disabled={cart.length === 0 || !activeToken}
                  onClick={handleBillPayment}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-green-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Icon d={ICON_PRINT} size={16} />
                  Bill, Pay &amp; Print
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Thermal Printer 58mm / 80mm Print Layout Component ── */}
      {lastPrintedDoc && (
        <div id="printable-receipt" data-print-area="receipt-print-area" className="printable-receipt receipt-print-area hidden print:block text-black font-mono">
          {lastPrintedDoc.type === 'KOT' ? (
            <div className="space-y-1.5 text-center text-xs w-[50mm] max-w-[50mm] mx-auto overflow-hidden text-black font-mono">
              <div className="border-b-2 border-black pb-1">
                <h2 className="text-xs font-black uppercase tracking-tight">*** KITCHEN ORDER TICKET ***</h2>
                <p className="text-[10px] font-bold">{billingSettings.storeName || 'MAGIXX SWEETS & CAFE'}</p>
              </div>
              <div className="border-y-2 border-black py-1 my-1 text-center bg-black text-white">
                <p className="text-[8px] font-bold uppercase tracking-wider">ORDER TYPE</p>
                <p className="text-xs font-black uppercase tracking-widest">{String(lastPrintedDoc.orderType || 'Dine-in').toUpperCase()}</p>
              </div>
              <div className="flex justify-between text-[10px] font-bold border-b border-black pb-1 text-left">
                <div>
                  <p>TOKEN #: <span className="text-xs font-black">#{String(lastPrintedDoc.tokenNumber).padStart(2, '0')}</span></p>
                </div>
                <div className="text-right">
                  <p>TIME: {lastPrintedDoc.time}</p>
                  <p>DATE: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              </div>
              <div className="text-left border-b border-black pb-2 pt-0.5">
                <div className="grid grid-cols-12 font-black text-[9px] uppercase border-b border-black pb-1 mb-1">
                  <span className="col-span-8">ITEM NAME</span>
                  <span className="col-span-4 text-right">QTY</span>
                </div>
                {(lastPrintedDoc.items || []).map((item, idx) => (
                  <div key={idx} className="py-0.5 border-b border-gray-200">
                    <div className="grid grid-cols-12 text-[10px] font-bold">
                      <span className="col-span-8 break-words pr-1">{item.name}</span>
                      <span className="col-span-4 text-right font-black">x{item.qty}</span>
                    </div>
                    {item.note && (
                      <p className="text-[9px] font-semibold text-gray-700 italic pl-1 mt-0.5">
                        * Note: {item.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-0.5 text-[9px] font-bold uppercase text-center">
                <p>*** SENT TO KITCHEN ***</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-center text-xs w-[50mm] max-w-[50mm] mx-auto overflow-hidden text-black font-mono">
              <div className="border-b-2 border-black pb-1">
                <h2 className="text-xs font-black uppercase text-center leading-tight">{billingSettings.storeName || 'MAGIXX SWEETS & CAFE'}</h2>
                <p className="text-[9px] text-center leading-tight break-words">{billingSettings.invoiceHeader || 'Opposite Kalyan Mandap, Near Joda Bus Stand, Odisha • Ph: 7001322855'}</p>
                {billingSettings.gstin && <p className="text-[9px] text-center">GSTIN: {billingSettings.gstin}</p>}
                <p className="text-[10px] font-extrabold uppercase mt-0.5 text-center">TAX INVOICE / RECEIPT</p>
              </div>
              <div className="flex justify-between text-[9px] font-bold border-b border-black pb-1 text-left">
                <div>
                  <p>TOKEN #: <span className="text-xs font-black">#{String(lastPrintedDoc.tokenNumber).padStart(2, '0')}</span></p>
                  {lastPrintedDoc.customerName && !/^(walk-?in|walk-?in guest|guest|unregistered|default)$/i.test(lastPrintedDoc.customerName.trim()) && (
                    <p>CUST: {lastPrintedDoc.customerName.trim()}</p>
                  )}
                </div>
                <div className="text-right">
                  <p>DATE: {lastPrintedDoc.date || new Date().toLocaleDateString('en-GB')}</p>
                  <p>TIME: {lastPrintedDoc.time || new Date().toLocaleTimeString('en-GB')}</p>
                  <p>MODE: {lastPrintedDoc.paymentMethod}</p>
                </div>
              </div>

              {/* 4 Distinct Columns fitting 58mm printable width: ITEM NAME (col-span-5), QTY (col-span-2), RATE (col-span-2), TOTAL (col-span-3) */}
              <div className="text-left border-b border-black pb-1">
                <div className="grid grid-cols-12 font-black text-[9px] uppercase border-b border-black pb-1 mb-1">
                  <span className="col-span-5 text-left">ITEM</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-2 text-right">RATE</span>
                  <span className="col-span-3 text-right">TOTAL</span>
                </div>
                {(lastPrintedDoc.items || []).map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 text-[10px] font-bold py-0.5 border-b border-gray-100">
                    <span className="col-span-5 text-left break-words pr-0.5 leading-tight">{item.name}</span>
                    <span className="col-span-2 text-center">{item.qty}</span>
                    <span className="col-span-2 text-right">{Number(item.price || 0).toFixed(2)}</span>
                    <span className="col-span-3 text-right">{(Number(item.price || 0) * Number(item.qty || 1)).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Subtotal, CGST, SGST, Grand Total with enlarged, bold typography & clean layout */}
              <div className="space-y-0.5 border-b border-black pb-1 text-right">
                <div className="flex justify-between text-xs font-extrabold">
                  <span>SUBTOTAL:</span>
                  <span>Rs.{lastPrintedDoc.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-extrabold">
                  <span>CGST ({(parseFloat(billingSettings.taxRate || '5.00') / 2).toFixed(2)}%):</span>
                  <span>+ Rs.{((lastPrintedDoc.taxAmount || 0) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-extrabold">
                  <span>SGST ({(parseFloat(billingSettings.taxRate || '5.00') / 2).toFixed(2)}%):</span>
                  <span>+ Rs.{((lastPrintedDoc.taxAmount || 0) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black uppercase border-y-2 border-black py-1 my-1 bg-black/5">
                  <span className="tracking-wide">GRAND TOTAL:</span>
                  <span className="text-sm font-black">Rs.{lastPrintedDoc.total?.toFixed(2)}</span>
                </div>
              </div>
              <div className="pt-0.5 text-[9px] font-bold uppercase text-center break-words leading-tight">
                <p>{billingSettings.invoiceFooter || billingSettings.footerNotes || 'THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default Order

