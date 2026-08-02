import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { sendToBluetoothPrinter, checkPrinterStreamStatus } from '../../utils/bluetoothPrinter'
import { clearAuthSession } from '../../utils/auth'

/* ── Inline SVG icon primitives ── */
const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const IC = {
  store:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  percent:  'M19 5L5 19 M6.5 6.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M17.5 17.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  database: 'M12 22c5.523 0 10-1.79 10-4V6c0-2.21-4.477-4-10-4S2 3.79 2 6v12c0 2.21 4.477 4 10 4s10-1.79 10-4 M2 6c0 2.21 4.477 4 10 4s10-1.79 10-4 M2 18c0 2.21 4.477 4 10 4s10-1.79 10-4',
  check:    'M20 6L9 17l-5-5',
  trash:    'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  upload:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  alert:    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  logout:   'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  plus:     'M12 5v14M5 12h14',
  edit:     'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  printer:  'M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z',
  bluetooth:'M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11',
  link:     'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  unlink:   'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71 M1 1l22 22'
}

const DEFAULT_STORE = {
  brandName: 'MAGIXX',
  subtitle: 'Sweets & Cafe',
  storeName: 'MAGIXX — Sweets & Cafe',
  phone: '9876543210',
  email: 'hello@magixx.com',
  address: 'Plot 42, Cafe Street, Gourmet City',
}

const DEFAULT_BILLING = {
  gstin: '21ABCDE1234F1Z5',
  invoiceHeader: 'Main Road, Cafe Square, Odisha • Ph: 9000000000',
  invoiceFooter: 'THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN',
  taxRate: '5.00',
  taxType: 'inclusive',
  currency: '₹ INR',
  footerNotes: 'THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN',
}

const GENERIC_SERIAL_UUID = '000018f0-0000-1000-8000-00805f9b34fb'

const DEFAULT_PRINTERS = {
  kotPrinterName: '',
  kotPrinterAddress: '',
  kotPrinterServiceUUID: GENERIC_SERIAL_UUID,
  billingPrinterName: '',
  billingPrinterAddress: '',
  billingPrinterServiceUUID: GENERIC_SERIAL_UUID,
}

const ROLE_STYLES = {
  Admin: 'bg-zinc-900 text-yellow-400 border border-zinc-800 font-extrabold shadow-2xs',
  Manager: 'bg-blue-50 text-blue-800 border border-blue-200 font-extrabold',
  Cashier: 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold'
}

const ROLES = ['Admin', 'Manager', 'Cashier']

const EMPTY_STAFF_FORM = {
  name: '',
  phone: '',
  password: '',
  role: 'Cashier',
  imageFile: null,
  previewUrl: null
}

const Settings = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('store')
  const [isEditing, setIsEditing] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Safe localStorage Initializers wrapped in try/catch to prevent JSON parse crashes
  const [store, setStore] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_store_settings')
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_STORE
    } catch {
      return DEFAULT_STORE
    }
  })

  const [billing, setBilling] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_billing_settings')
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_BILLING
    } catch {
      return DEFAULT_BILLING
    }
  })

  const [printers, setPrinters] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_printer_settings')
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_PRINTERS
    } catch {
      return DEFAULT_PRINTERS
    }
  })

  const [staff, setStaff] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_staff_members')
      return (saved && saved !== 'undefined' && Array.isArray(JSON.parse(saved))) ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Electron Native System Printers state
  const [systemPrinters, setSystemPrinters] = useState([])

  // Bluetooth Pairing Modal & Status States
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [availableDevices, setAvailableDevices] = useState([])
  const [targetPrinterType, setTargetPrinterType] = useState('kot')
  const [kotPairStatus, setKotPairStatus] = useState('')
  const [billPairStatus, setBillPairStatus] = useState('')

  // Toast Handler
  const [toastMsg, setToastMsg] = useState('')
  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // Safe Object Normalizations for Render Immunity
  const safeStore = { ...DEFAULT_STORE, ...(store || {}) }
  const safeBilling = { ...DEFAULT_BILLING, ...(billing || {}) }
  const safePrinters = { ...DEFAULT_PRINTERS, ...(printers || {}) }
  const safeStaff = Array.isArray(staff) ? staff : []
  const safeSystemPrinters = Array.isArray(systemPrinters) ? systemPrinters : []
  const safeAvailableDevices = Array.isArray(availableDevices) ? availableDevices : []

  // Load installed OS printers if running inside Electron
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.getSystemPrinters === 'function') {
      window.electronAPI.getSystemPrinters().then((printersList) => {
        if (Array.isArray(printersList)) {
          setSystemPrinters(printersList)
        }
      }).catch(console.error)
    }
  }, [])

  // Listen for Electron IPC bluetooth device lists if enabled
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.onBluetoothDeviceList === 'function') {
      const cleanup = window.electronAPI.onBluetoothDeviceList((deviceList) => {
        setAvailableDevices(deviceList || [])
        setShowDeviceModal(true)
      })
      return () => {
        if (typeof cleanup === 'function') cleanup()
      }
    }
  }, [])

  // Sync staff members from backend API
  const fetchStaffData = async () => {
    try {
      const res = await api.get('/users')
      if (res.data && Array.isArray(res.data)) {
        const formatted = res.data.map(u => ({
          id: u._id || u.id,
          _id: u._id || u.id,
          name: u.name || '',
          phone: u.phone || '',
          email: u.email || `${(u.name || 'user').toLowerCase().replace(/\s+/g, '')}@magixx.com`,
          role: u.role || 'Cashier',
          status: u.status || 'active',
          img: u.avatar || null,
          avatar: u.avatar || null,
          since: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Jan 2024'
        }))
        setStaff(formatted)
        localStorage.setItem('pos_staff_members', JSON.stringify(formatted))
      }
    } catch (err) {
      console.warn('Could not fetch staff from backend, relying on local storage:', err.message)
    }
  }

  // Sync backend settings
  const fetchBackendSettings = async () => {
    try {
      const res = await api.get('/settings')
      if (res.data) {
        if (res.data.storeName) {
          setStore(prev => {
            const updated = { ...DEFAULT_STORE, ...(prev || {}), storeName: res.data.storeName }
            localStorage.setItem('pos_store_settings', JSON.stringify(updated))
            return updated
          })
        }
        if (res.data.gstin || res.data.taxRate) {
          setBilling(prev => {
            const safePrev = prev || DEFAULT_BILLING
            const updated = {
              ...DEFAULT_BILLING,
              ...safePrev,
              gstin: res.data.gstin || safePrev.gstin,
              taxRate: res.data.taxRate ? String(res.data.taxRate) : safePrev.taxRate,
              taxType: res.data.taxType || safePrev.taxType,
              currency: res.data.currency || safePrev.currency,
              invoiceHeader: res.data.invoiceHeader || safePrev.invoiceHeader,
              invoiceFooter: res.data.invoiceFooter || safePrev.invoiceFooter,
            }
            localStorage.setItem('pos_billing_settings', JSON.stringify(updated))
            return updated
          })
        }
        if (res.data.kotPrinterName || res.data.billingPrinterName) {
          setPrinters(prev => {
            const safePrev = prev || DEFAULT_PRINTERS
            const updated = {
              ...DEFAULT_PRINTERS,
              ...safePrev,
              kotPrinterName: res.data.kotPrinterName || safePrev.kotPrinterName,
              kotPrinterAddress: res.data.kotPrinterAddress || safePrev.kotPrinterAddress,
              kotPrinterServiceUUID: res.data.kotPrinterServiceUUID || safePrev.kotPrinterServiceUUID,
              billingPrinterName: res.data.billingPrinterName || safePrev.billingPrinterName,
              billingPrinterAddress: res.data.billingPrinterAddress || safePrev.billingPrinterAddress,
              billingPrinterServiceUUID: res.data.billingPrinterServiceUUID || safePrev.billingPrinterServiceUUID,
            }
            localStorage.setItem('pos_printer_settings', JSON.stringify(updated))
            return updated
          })
        }
      }
    } catch (err) {
      console.warn('Could not fetch backend settings:', err.message)
    }
  }

  useEffect(() => {
    fetchStaffData()
    fetchBackendSettings()
  }, [])

  useEffect(() => {
    if (staff && Array.isArray(staff) && staff.length > 0) {
      localStorage.setItem('pos_staff_members', JSON.stringify(staff))
    }
  }, [staff])

  // Bluetooth Pairing Request Handler with localStorage persistence & storage events
  const scanAndPairPrinter = async (type) => {
    setTargetPrinterType(type)
    if (type === 'kot') setKotPairStatus('scanning')
    else setBillPairStatus('scanning')

    showToast(`Scanning for Bluetooth printer (${type.toUpperCase()})...`)

    try {
      if (navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function') {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            GENERIC_SERIAL_UUID,
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
            '0000fff0-0000-1000-8000-00805f9b34fb',
          ],
        })

        if (device) {
          const deviceName = device.name || 'BT Printer'
          const deviceId = device.id || ''

          setPrinters(prev => {
            const safePrev = prev || DEFAULT_PRINTERS
            const updated = {
              ...safePrev,
              ...(type === 'kot'
                ? { kotPrinterName: deviceName, kotPrinterAddress: deviceId }
                : { billingPrinterName: deviceName, billingPrinterAddress: deviceId })
            }
            localStorage.setItem('pos_printer_settings', JSON.stringify(updated))
            window.dispatchEvent(new Event('storage'))
            return updated
          })

          if (type === 'kot') setKotPairStatus('paired')
          else setBillPairStatus('paired')

          showToast(`Successfully paired ${deviceName} for ${type.toUpperCase()}!`)

          api.put('/settings', {
            ...(type === 'kot'
              ? { kotPrinterName: deviceName, kotPrinterAddress: deviceId }
              : { billingPrinterName: deviceName, billingPrinterAddress: deviceId }),
          }).catch(console.warn)
        }
      } else {
        showToast('Web Bluetooth is not supported in this environment. Select an OS printer from the dropdown.')
        if (type === 'kot') setKotPairStatus('')
        else setBillPairStatus('')
      }
    } catch (err) {
      console.warn('Bluetooth pairing cancelled or error:', err?.message)
      showToast(`Pairing cancelled or error: ${err?.message || 'Cancelled'}`)
      if (type === 'kot') setKotPairStatus('')
      else setBillPairStatus('')
    }
  }

  const handleSelectBluetoothDevice = (deviceId, deviceName) => {
    try {
      setPrinters(prev => {
        const safePrev = prev || DEFAULT_PRINTERS
        const updated = {
          ...safePrev,
          ...(targetPrinterType === 'kot'
            ? { kotPrinterName: deviceName, kotPrinterAddress: deviceId }
            : { billingPrinterName: deviceName, billingPrinterAddress: deviceId })
        }
        localStorage.setItem('pos_printer_settings', JSON.stringify(updated))
        window.dispatchEvent(new Event('storage'))
        return updated
      })

      if (window.electronAPI && typeof window.electronAPI.chooseBluetoothDevice === 'function') {
        window.electronAPI.chooseBluetoothDevice(deviceId)
      }

      setShowDeviceModal(false)
      if (targetPrinterType === 'kot') setKotPairStatus('paired')
      else setBillPairStatus('paired')

      showToast(`Connected ${deviceName}!`)
    } catch (e) {
      console.error('Error selecting bluetooth device:', e)
    }
  }

  const handleCancelBluetoothDevice = () => {
    if (window.electronAPI && typeof window.electronAPI.cancelBluetoothDevice === 'function') {
      window.electronAPI.cancelBluetoothDevice()
    }
    setShowDeviceModal(false)
    if (targetPrinterType === 'kot') setKotPairStatus('')
    else setBillPairStatus('')
  }

  // Native & Bluetooth Test Printing Handler
  const handleTestPrint = async (printerType) => {
    const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing'
    showToast(`Sending test print job to ${label}...`)

    const sampleReceipt = [
      '================================',
      `   MAGIXX - ${label.toUpperCase()} TEST`,
      '================================',
      `Printer: ${printerType === 'kot' ? (safePrinters.kotPrinterName || 'Default System Printer') : (safePrinters.billingPrinterName || 'Default System Printer')}`,
      `Time: ${new Date().toLocaleTimeString()}`,
      `Status: TEST PRINT OK`,
      '--------------------------------',
      '*** TEST RECEIPT PRINT OK ***',
      '================================',
    ].join('\n')

    const printed = await sendToBluetoothPrinter(printerType, sampleReceipt, showToast)
    if (printed) {
      showToast(`Test receipt printed successfully on ${label}!`)
    }
  }

  // Save printer config to localStorage and backend
  const savePrinterSettings = async () => {
    localStorage.setItem('pos_printer_settings', JSON.stringify(safePrinters))
    window.dispatchEvent(new Event('storage'))
    try {
      await api.put('/settings', {
        kotPrinterName: safePrinters.kotPrinterName,
        kotPrinterAddress: safePrinters.kotPrinterAddress,
        kotPrinterServiceUUID: safePrinters.kotPrinterServiceUUID,
        billingPrinterName: safePrinters.billingPrinterName,
        billingPrinterAddress: safePrinters.billingPrinterAddress,
        billingPrinterServiceUUID: safePrinters.billingPrinterServiceUUID,
      })
    } catch (err) {
      console.warn('Could not save printer settings to backend:', err.message)
    }
    showToast('Printer configuration saved successfully!')
  }

  // Staff Modal States
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM)
  const [isStaffEditModalOpen, setIsStaffEditModalOpen] = useState(false)
  const [memberToEdit, setMemberToEdit] = useState(null)
  const [staffEditForm, setStaffEditForm] = useState(EMPTY_STAFF_FORM)

  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  // File to base64 Data URL converter for photos
  const handlePhotoSelect = (e, setFormState) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setFormState(prev => ({
        ...prev,
        imageFile: file,
        previewUrl: event.target.result,
        removeAvatar: false
      }))
    }
    reader.readAsDataURL(file)
  }

  // Save Store Settings
  const saveStoreSettings = async (e) => {
    e.preventDefault()
    try {
      await api.put('/settings', {
        brandName: safeStore.brandName,
        subtitle: safeStore.subtitle,
        storeName: safeStore.storeName,
        phone: safeStore.phone,
        email: safeStore.email,
        address: safeStore.address,
      })
    } catch (err) {
      console.warn('Backend store settings save warning:', err.message)
    }
    localStorage.setItem('pos_store_settings', JSON.stringify(safeStore))
    window.dispatchEvent(new Event('storage'))
    showToast('Store Profile configuration updated and synced to backend!')
    setIsEditing(false)
  }

  const cancelStoreSettings = () => {
    try {
      const saved = localStorage.getItem('pos_store_settings')
      setStore((saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_STORE)
    } catch {
      setStore(DEFAULT_STORE)
    }
    setIsEditing(false)
  }

  useEffect(() => {
    if (activeTab !== 'store') {
      setIsEditing(false)
      try {
        const saved = localStorage.getItem('pos_store_settings')
        setStore((saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_STORE)
      } catch {
        setStore(DEFAULT_STORE)
      }
    }
  }, [activeTab])

  // Save Billing Settings
  const saveBillingSettings = async (e) => {
    e.preventDefault()
    try {
      await api.put('/settings', {
        gstin: safeBilling.gstin,
        invoiceHeader: safeBilling.invoiceHeader,
        invoiceFooter: safeBilling.invoiceFooter || safeBilling.footerNotes,
        taxRate: Number(safeBilling.taxRate),
        taxType: safeBilling.taxType,
        currency: safeBilling.currency,
        storeName: safeStore.storeName,
      })
    } catch (err) {
      console.warn('Backend settings save warning:', err.message)
    }
    const updatedBilling = {
      ...safeBilling,
      footerNotes: safeBilling.invoiceFooter || safeBilling.footerNotes,
    }
    setBilling(updatedBilling)
    localStorage.setItem('pos_billing_settings', JSON.stringify(updatedBilling))
    window.dispatchEvent(new Event('storage'))
    showToast('Tax, GSTIN & Invoice preferences saved to database!')
  }

  // Staff Management Actions
  const toggleStaffStatus = async (id) => {
    const member = safeStaff.find((s) => (s._id || s.id) === id)
    if (!member) return
    const newStatus = member.status === 'active' ? 'offline' : 'active'

    try {
      if (id && typeof id === 'string' && id.length > 10) {
        await api.put(`/users/${id}`, { status: newStatus })
      }
    } catch (err) {
      console.warn('Backend toggle staff status error:', err.message)
    }

    setStaff((prev) =>
      (prev || []).map((s) => ((s._id || s.id) === id ? { ...s, status: newStatus } : s))
    )
    showToast('Staff access status updated.')
  }

  const handleSaveStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.phone.trim() || !staffForm.password.trim()) {
      showToast('Name, phone number, and password are required.')
      return
    }

    try {
      const payload = {
        name: staffForm.name.trim(),
        phone: staffForm.phone.trim(),
        password: staffForm.password.trim(),
        role: staffForm.role || 'Cashier',
        status: 'active',
        avatar: staffForm.previewUrl || ''
      }

      const res = await api.post('/users', payload)
      const createdUser = res.data

      const formattedMember = {
        id: createdUser._id || createdUser.id,
        _id: createdUser._id || createdUser.id,
        name: createdUser.name,
        phone: createdUser.phone,
        email: createdUser.email || `${createdUser.name.toLowerCase().replace(/\s+/g, '')}@magixx.com`,
        role: createdUser.role,
        status: createdUser.status || 'active',
        img: createdUser.avatar || staffForm.previewUrl || null,
        since: createdUser.createdAt ? new Date(createdUser.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Jan 2024'
      }

      setStaff((prev) => [formattedMember, ...(prev || []).filter(s => (s._id || s.id) !== formattedMember.id)])
      setStaffForm(EMPTY_STAFF_FORM)
      setIsStaffModalOpen(false)
      showToast('New staff member provisioned & saved to database successfully!')
    } catch (err) {
      console.error('Error creating staff:', err)
      const errMsg = err.response?.data?.message || 'Failed to provision staff member.'
      showToast(`Error: ${errMsg}`)
    }
  }

  const removeStaffMember = async (id) => {
    try {
      if (id && typeof id === 'string' && id.length > 10) {
        await api.delete(`/users/${id}`)
      }
    } catch (err) {
      console.warn('Backend delete staff error:', err.message)
    }
    setStaff((prev) => (prev || []).filter((s) => (s._id || s.id) !== id))
    showToast('Staff account revoked.')
  }

  const openStaffEditModal = (member) => {
    setMemberToEdit(member)
    const existingAvatar = member.avatar || member.img || null
    setStaffEditForm({
      name: member.name || '',
      phone: member.phone || member.email || '',
      password: member.password || '',
      role: member.role || 'Cashier',
      imageFile: null,
      previewUrl: existingAvatar,
      removeAvatar: false
    })
    setIsStaffEditModalOpen(true)
  }

  const handleEditStaffSave = async () => {
    if (!staffEditForm.name.trim() || !staffEditForm.phone.trim()) return
    const id = memberToEdit?._id || memberToEdit?.id
    const newName = staffEditForm.name.trim()
    const newPhone = staffEditForm.phone.trim()
    const newRole = staffEditForm.role
    const newAvatar = staffEditForm.removeAvatar ? '' : (staffEditForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img || '')

    try {
      const updateData = {
        name: newName,
        phone: newPhone,
        role: newRole,
        avatar: newAvatar,
        removeAvatar: Boolean(staffEditForm.removeAvatar)
      }
      if (staffEditForm.password && staffEditForm.password.trim()) {
        updateData.password = staffEditForm.password.trim()
      }

      if (id && typeof id === 'string' && id.length > 10) {
        await api.put(`/users/${id}`, updateData)
      }
    } catch (err) {
      console.warn('Backend edit staff error:', err.message)
    }

    setStaff((prev) =>
      (prev || []).map((s) =>
        (s._id || s.id) === id
          ? {
              ...s,
              name: newName,
              phone: newPhone,
              role: newRole,
              img: newAvatar,
              avatar: newAvatar
            }
          : s
      )
    )

    // Sync active user profile in localStorage if editing self
    const activeUserStr = localStorage.getItem('pos_active_user') || localStorage.getItem('userInfo')
    if (activeUserStr) {
      try {
        const parsedActive = JSON.parse(activeUserStr)
        const isCurrentActive =
          parsedActive &&
          (parsedActive._id === id ||
            parsedActive.id === id ||
            parsedActive.phone === memberToEdit?.phone ||
            parsedActive.name === memberToEdit?.name ||
            (parsedActive.role === 'Admin' && memberToEdit?.role === 'Admin'))

        if (isCurrentActive) {
          const updatedActiveUser = {
            ...parsedActive,
            name: newName,
            phone: newPhone,
            role: newRole,
            avatar: newAvatar
          }
          localStorage.setItem('pos_active_user', JSON.stringify(updatedActiveUser))
          localStorage.setItem('userInfo', JSON.stringify(updatedActiveUser))
          window.dispatchEvent(new Event('pos_user_updated'))
          window.dispatchEvent(new Event('storage'))
        }
      } catch (e) {
        console.error('Error updating active user storage:', e)
      }
    }

    setStaffEditForm(EMPTY_STAFF_FORM)
    setMemberToEdit(null)
    setIsStaffEditModalOpen(false)
    showToast('Staff account details updated!')
  }

  // Backup & Restore Database
  const handleBackup = () => {
    const data = {
      pos_store_settings: localStorage.getItem('pos_store_settings'),
      pos_billing_settings: localStorage.getItem('pos_billing_settings'),
      pos_staff_members: localStorage.getItem('pos_staff_members'),
      pos_menu_categories: localStorage.getItem('pos_menu_categories'),
      pos_menu_items: localStorage.getItem('pos_menu_items'),
      exportedAt: new Date().toISOString(),
    }
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `magixx_pos_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Database backup downloaded successfully!')
  }

  const handleRestore = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        if (parsed.pos_store_settings) localStorage.setItem('pos_store_settings', parsed.pos_store_settings)
        if (parsed.pos_billing_settings) localStorage.setItem('pos_billing_settings', parsed.pos_billing_settings)
        if (parsed.pos_staff_members) localStorage.setItem('pos_staff_members', parsed.pos_staff_members)
        if (parsed.pos_menu_categories) localStorage.setItem('pos_menu_categories', parsed.pos_menu_categories)
        if (parsed.pos_menu_items) localStorage.setItem('pos_menu_items', parsed.pos_menu_items)

        window.dispatchEvent(new Event('storage'))
        showToast('Database restored successfully!')
        setTimeout(() => window.location.reload(), 1000)
      } catch (err) {
        alert('Invalid backup file format.')
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmFactoryReset = async () => {
    setIsResetting(true)
    try {
      try {
        await api.post('/admin/factory-reset')
      } catch (err1) {
        try {
          await api.post('/debug/reset')
        } catch (err2) {
          console.warn('Backend reset endpoint fallback warning:', err2)
        }
      }

      localStorage.clear()
      sessionStorage.clear()

      setShowResetModal(false)
      setIsResetting(false)

      window.location.href = '/login'
    } catch (err) {
      console.error('Factory Reset Error:', err)
      alert(err.response?.data?.message || 'Factory Reset failed')
      setIsResetting(false)
    }
  }

  const handleLogout = () => {
    clearAuthSession()
    showToast('Logging out...')
    setTimeout(() => {
      navigate('/', { replace: true })
    }, 200)
  }

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-2 font-sans overflow-hidden">
      
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-xs font-bold text-white shadow-xl animate-in fade-in slide-in-from-top-2">
          <Icon d={IC.check} size={15} className="text-green-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900">Settings &amp; Staff Directory</h1>
        <p className="mt-0.5 text-xs text-zinc-500 font-medium">Manage store branding, tax rules, staff roles &amp; database backups</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('store')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'store'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Icon d={IC.store} size={16} />
          <span>Store Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'billing'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Icon d={IC.percent} size={16} />
          <span>Tax &amp; Billing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Icon d={IC.users} size={16} />
          <span>Staff &amp; Roles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'data'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Icon d={IC.database} size={16} />
          <span>Backup &amp; Restore</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'hardware'
              ? 'border-yellow-400 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Icon d={IC.printer} size={16} />
          <span>Hardware &amp; Printers</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto pr-1">

        {/* TAB 1: Store Profile */}
        {activeTab === 'store' && (
          <form onSubmit={saveStoreSettings} className="max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-zinc-900 border-b border-zinc-100 pb-2">Business Branding &amp; Identity</h2>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Brand Name (Navbar)</label>
                <input
                  type="text"
                  required
                  disabled={!isEditing}
                  value={safeStore.brandName}
                  onChange={(e) => setStore((p) => ({ ...safeStore, brandName: e.target.value }))}
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Brand Subtitle</label>
                <input
                  type="text"
                  required
                  disabled={!isEditing}
                  value={safeStore.subtitle}
                  onChange={(e) => setStore((p) => ({ ...safeStore, subtitle: e.target.value }))}
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Registered Cafe Name</label>
              <input
                type="text"
                required
                disabled={!isEditing}
                value={safeStore.storeName}
                onChange={(e) => setStore((p) => ({ ...safeStore, storeName: e.target.value }))}
                className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Contact Number</label>
                <input
                  type="tel"
                  required
                  disabled={!isEditing}
                  value={safeStore.phone}
                  onChange={(e) => setStore((p) => ({ ...safeStore, phone: e.target.value }))}
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Contact Email</label>
                <input
                  type="email"
                  required
                  disabled={!isEditing}
                  value={safeStore.email}
                  onChange={(e) => setStore((p) => ({ ...safeStore, email: e.target.value }))}
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Business Address</label>
              <textarea
                required
                disabled={!isEditing}
                value={safeStore.address}
                onChange={(e) => setStore((p) => ({ ...safeStore, address: e.target.value }))}
                className={`w-full h-20 rounded-xl border px-4 py-2.5 text-sm outline-none transition resize-none duration-150 ${isEditing ? 'border-zinc-200 bg-white text-zinc-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 shadow-sm' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500 cursor-not-allowed'}`}
              />
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-yellow-400 px-6 py-2.5 text-xs font-bold text-zinc-900 shadow-md hover:bg-yellow-500 transition active:scale-95 duration-150 cursor-pointer"
                >
                  Edit Store Profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelStoreSettings}
                    className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-bold text-zinc-600 shadow-sm hover:bg-zinc-50 transition active:scale-95 duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-yellow-400 px-6 py-2.5 text-xs font-bold text-zinc-900 shadow-md hover:bg-yellow-500 transition active:scale-95 duration-150 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* TAB 2: Tax & Billing Preferences */}
        {activeTab === 'billing' && (
          <form onSubmit={saveBillingSettings} className="max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-zinc-900 border-b border-zinc-100 pb-2">Taxation &amp; Receipt Configuration</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">GSTIN Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 21ABCDE1234F1Z5"
                  value={safeBilling.gstin || ''}
                  onChange={(e) => setBilling((p) => ({ ...safeBilling, gstin: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 font-mono uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Invoice Header / Subtitle &amp; Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Road, Cafe Square, Odisha • Ph: 9000000000"
                  value={safeBilling.invoiceHeader || ''}
                  onChange={(e) => setBilling((p) => ({ ...safeBilling, invoiceHeader: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Default Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={safeBilling.taxRate}
                  onChange={(e) => setBilling((p) => ({ ...safeBilling, taxRate: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Tax Type</label>
                <select
                  value={safeBilling.taxType || 'exclusive'}
                  onChange={(e) => setBilling((p) => ({ ...safeBilling, taxType: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                >
                  <option value="exclusive">Exclusive (Add to price)</option>
                  <option value="inclusive">Inclusive (Include in price)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Currency Code</label>
                <select
                  value={safeBilling.currency}
                  onChange={(e) => setBilling((p) => ({ ...safeBilling, currency: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                >
                  <option value="₹ INR">₹ INR (Indian Rupee)</option>
                  <option value="$ USD">$ USD (US Dollar)</option>
                  <option value="€ EUR">€ EUR (Euro)</option>
                  <option value="£ GBP">£ GBP (British Pound)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Receipt Footer Message / Notes</label>
              <textarea
                required
                placeholder="e.g. THANK YOU FOR VISITING MAGIXX! HAVE A SWEET DAY • VISIT AGAIN"
                value={safeBilling.invoiceFooter || safeBilling.footerNotes || ''}
                onChange={(e) => setBilling((p) => ({ ...safeBilling, invoiceFooter: e.target.value, footerNotes: e.target.value }))}
                className="w-full h-20 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-yellow-400 px-6 py-2.5 text-xs font-bold text-zinc-900 shadow-md hover:bg-yellow-500 transition active:scale-95 cursor-pointer"
              >
                Save Configuration &amp; Invoice Rules
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: Staff & Roles */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-extrabold text-zinc-900">Staff Accounts &amp; Access Directory</h2>
                <p className="text-xs text-zinc-400 font-medium">
                  {safeStaff.length} staff members • {safeStaff.filter(s => s.status === 'active').length} active access accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStaffForm(EMPTY_STAFF_FORM)
                  setIsStaffModalOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md transition-all hover:bg-yellow-500 active:scale-95 cursor-pointer"
              >
                <Icon d={IC.plus} size={15} />
                <span>Provision Staff Member</span>
              </button>
            </div>

            {safeStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-14 text-center bg-white border border-zinc-200/80 rounded-2xl w-full">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Icon d={IC.users} size={24} />
                </div>
                <p className="text-sm font-extrabold text-zinc-800">No staff members provisioned</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  Click "Provision Staff Member" above to create an authorized account.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {safeStaff.map((member) => {
                  const memberId = member._id || member.id
                  return (
                    <div
                      key={memberId}
                      className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div className="relative">
                        {member.img || member.avatar ? (
                          <img
                            src={member.img || member.avatar}
                            alt={member.name || 'Staff'}
                            className="h-16 w-16 rounded-full object-cover shadow-sm ring-2 ring-yellow-400"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400 text-zinc-900 font-black text-xl shadow-sm ring-2 ring-yellow-400/50">
                            {getInitials(member.name)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                            member.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`}
                        />
                      </div>

                      <div className="text-center w-full">
                        <p className="font-extrabold text-zinc-900 text-sm truncate">{member.name || 'Unnamed'}</p>
                        <p className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">📱 {member.phone || member.email || 'N/A'}</p>
                      </div>

                      <span className={`px-3 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${ROLE_STYLES[member.role] ?? 'bg-zinc-50 text-zinc-600 border border-zinc-200'}`}>
                        {member.role || 'Cashier'}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleStaffStatus(memberId)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                          member.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100'
                            : 'bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                        {member.status === 'active' ? 'Active Access' : 'Access Suspended'}
                      </button>

                      <div className="flex w-full gap-2 pt-2 border-t border-zinc-100 mt-1">
                        <button
                          type="button"
                          onClick={() => openStaffEditModal(member)}
                          className="flex-1 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 py-1.5 text-xs font-bold text-zinc-800 transition active:scale-95 shadow-2xs cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStaffMember(memberId)}
                          className="flex-1 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 py-1.5 text-xs font-bold text-red-600 transition active:scale-95 shadow-2xs cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Storage Backup & Recovery */}
        {activeTab === 'data' && (
          <div className="max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 border-b border-zinc-100 pb-2">Local Storage Database Operations</h2>
              <p className="text-xs text-zinc-400 mt-1">Export, backup, or import state mappings directly via JSON state bundles.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3.5">
                <div>
                  <h3 className="text-xs font-extrabold text-zinc-800 flex items-center gap-1.5">
                    <Icon d={IC.download} size={14} className="text-zinc-600" />
                    Backup Database
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Download a copy of current store settings, staff accounts, and catalog.</p>
                </div>
                <button
                  type="button"
                  onClick={handleBackup}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
                >
                  Download DB (.json)
                </button>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3.5">
                <div>
                  <h3 className="text-xs font-extrabold text-zinc-800 flex items-center gap-1.5">
                    <Icon d={IC.upload} size={14} className="text-zinc-600" />
                    Restore Database
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Upload a previously exported JSON backup state file.</p>
                </div>
                <label className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-bold text-zinc-900 shadow cursor-pointer hover:bg-yellow-500 active:scale-95 transition">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestore}
                    className="hidden"
                  />
                  Upload Backup (.json)
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                  <Icon d={IC.logout} size={15} className="text-zinc-700" />
                  Active System Session
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">End your active administrator session and return to staff sign-in.</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 text-xs font-bold text-red-600 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
              >
                Logout Session
              </button>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <Icon d={IC.alert} size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-extrabold text-red-800">Danger Zone: Purge Application State</h3>
                  <p className="text-[10px] text-red-500/80 mt-0.5">Wipes out CRM databases, inventories, transactions, reservations, and resets cache back to clean zero-states.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Factory Reset (Wipe Cache)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Hardware & Printers */}
        {activeTab === 'hardware' && (
          <div className="max-w-2xl space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <h2 className="text-base font-extrabold text-zinc-900">Hardware &amp; Printers</h2>
                <p className="mt-0.5 text-xs text-zinc-500">Configure Bluetooth thermal printers for KOT (kitchen) and billing (counter) receipts.</p>
              </div>

              {/* Status Banner */}
              <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                window.electronAPI && typeof window.electronAPI.printReceipt === 'function'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : navigator.bluetooth
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  window.electronAPI ? 'bg-green-500' : navigator.bluetooth ? 'bg-blue-500' : 'bg-amber-400'
                }`} />
                {window.electronAPI && typeof window.electronAPI.printReceipt === 'function'
                  ? 'Electron Native Printing active — direct silent printing to OS Bluetooth Classic & USB thermal printers enabled'
                  : navigator.bluetooth
                  ? 'Web Bluetooth API available — Bluetooth LE printer pairing supported'
                  : 'Web Bluetooth is NOT available. Use Chrome or Edge on desktop/Android for Bluetooth printing.'}
              </div>

              {/* KOT Kitchen Printer */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700">
                      <Icon d={IC.printer} size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-zinc-900">KOT Kitchen Printer</p>
                      <p className="text-[10px] text-zinc-500">Receives KOT slip when &quot;KOT &amp; Print&quot; is clicked in POS</p>
                    </div>
                  </div>
                  {(kotPairStatus === 'paired' || Boolean(safePrinters.kotPrinterName || safePrinters.kotPrinterAddress)) && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-1 text-[10px] font-extrabold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />Configured
                    </span>
                  )}
                  {kotPairStatus === 'scanning' && (
                    <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-[10px] font-extrabold text-blue-700 animate-pulse">Scanning…</span>
                  )}
                </div>

                {safeSystemPrinters.length > 0 && (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Select System / Bluetooth Printer (OS Paired)</label>
                    <select
                      value={safePrinters.kotPrinterName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        setPrinters((p) => {
                          const safePrev = p || DEFAULT_PRINTERS;
                          const updated = { ...safePrev, kotPrinterName: selectedName };
                          localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
                          window.dispatchEvent(new Event('storage'));
                          return updated;
                        });
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-yellow-400"
                    >
                      <option value="">-- Choose System Printer --</option>
                      {safeSystemPrinters.map((p, idx) => (
                        <option key={idx} value={p.name}>
                          {p.name} {p.isDefault ? '(OS Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Device / Printer Name</label>
                    <input
                      type="text"
                      value={safePrinters.kotPrinterName}
                      onChange={(e) => setPrinters((p) => ({ ...(p || DEFAULT_PRINTERS), kotPrinterName: e.target.value }))}
                      placeholder="e.g. POS-58 or PT-210 Kitchen"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">GATT Service UUID (Web BT)</label>
                    <input
                      type="text"
                      value={safePrinters.kotPrinterServiceUUID}
                      onChange={(e) => setPrinters((p) => ({ ...(p || DEFAULT_PRINTERS), kotPrinterServiceUUID: e.target.value }))}
                      placeholder="000018f0-0000-1000-8000-00805f9b34fb"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-mono text-zinc-700 outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {navigator.bluetooth && (
                    <button
                      type="button"
                      onClick={() => scanAndPairPrinter('kot')}
                      disabled={kotPairStatus === 'scanning'}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-zinc-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Icon d={IC.bluetooth} size={13} />
                      {kotPairStatus === 'scanning' ? 'Scanning…' : 'Scan & Pair KOT Printer'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTestPrint('kot')}
                    className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-extrabold text-yellow-900 hover:bg-yellow-100 transition cursor-pointer"
                  >
                    <Icon d={IC.printer} size={13} />
                    Test Print Receipt
                  </button>
                  {(safePrinters.kotPrinterName || safePrinters.kotPrinterAddress) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrinters((p) => {
                          const safePrev = p || DEFAULT_PRINTERS;
                          const updated = { ...safePrev, kotPrinterName: '', kotPrinterAddress: '' };
                          localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
                          window.dispatchEvent(new Event('storage'));
                          api.put('/settings', updated).catch(() => {});
                          return updated;
                        });
                        setKotPairStatus('');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
                    >
                      <Icon d={IC.unlink} size={12} />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Billing Counter Printer */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <Icon d={IC.printer} size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-zinc-900">Billing Counter Printer</p>
                      <p className="text-[10px] text-zinc-500">Receives final receipt when &quot;Checkout &amp; Pay&quot; completes in POS</p>
                    </div>
                  </div>
                  {(billPairStatus === 'paired' || Boolean(safePrinters.billingPrinterName || safePrinters.billingPrinterAddress)) && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-1 text-[10px] font-extrabold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />Configured
                    </span>
                  )}
                  {billPairStatus === 'scanning' && (
                    <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-[10px] font-extrabold text-blue-700 animate-pulse">Scanning…</span>
                  )}
                </div>

                {safeSystemPrinters.length > 0 && (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Select System / Bluetooth Printer (OS Paired)</label>
                    <select
                      value={safePrinters.billingPrinterName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        setPrinters((p) => {
                          const safePrev = p || DEFAULT_PRINTERS;
                          const updated = { ...safePrev, billingPrinterName: selectedName };
                          localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
                          window.dispatchEvent(new Event('storage'));
                          return updated;
                        });
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-yellow-400"
                    >
                      <option value="">-- Choose System Printer --</option>
                      {safeSystemPrinters.map((p, idx) => (
                        <option key={idx} value={p.name}>
                          {p.name} {p.isDefault ? '(OS Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Device / Printer Name</label>
                    <input
                      type="text"
                      value={safePrinters.billingPrinterName}
                      onChange={(e) => setPrinters((p) => ({ ...(p || DEFAULT_PRINTERS), billingPrinterName: e.target.value }))}
                      placeholder="e.g. POS-58 or PT-210 Counter"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">GATT Service UUID (Web BT)</label>
                    <input
                      type="text"
                      value={safePrinters.billingPrinterServiceUUID}
                      onChange={(e) => setPrinters((p) => ({ ...(p || DEFAULT_PRINTERS), billingPrinterServiceUUID: e.target.value }))}
                      placeholder="000018f0-0000-1000-8000-00805f9b34fb"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-mono text-zinc-700 outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {navigator.bluetooth && (
                    <button
                      type="button"
                      onClick={() => scanAndPairPrinter('billing')}
                      disabled={billPairStatus === 'scanning'}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-zinc-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Icon d={IC.bluetooth} size={13} />
                      {billPairStatus === 'scanning' ? 'Scanning…' : 'Scan & Pair Billing Printer'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTestPrint('billing')}
                    className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-extrabold text-yellow-900 hover:bg-yellow-100 transition cursor-pointer"
                  >
                    <Icon d={IC.printer} size={13} />
                    Test Print Receipt
                  </button>

                  {(safePrinters.billingPrinterName || safePrinters.billingPrinterAddress) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrinters((p) => {
                          const safePrev = p || DEFAULT_PRINTERS;
                          const updated = { ...safePrev, billingPrinterName: '', billingPrinterAddress: '' };
                          localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
                          window.dispatchEvent(new Event('storage'));
                          api.put('/settings', updated).catch(() => {});
                          return updated;
                        });
                        setBillPairStatus('');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
                    >
                      <Icon d={IC.unlink} size={12} />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={savePrinterSettings}
                  className="flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-extrabold text-zinc-900 shadow-sm hover:bg-yellow-500 transition active:scale-95 cursor-pointer"
                >
                  <Icon d={IC.check} size={14} />
                  Save Printer Configuration
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Provision New Staff Modal ── */}
      {isStaffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsStaffModalOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-zinc-900">Provision New Staff Member</h2>
                <p className="text-xs text-zinc-400 font-medium">Create staff login credentials and assign system access role</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 flex items-center gap-4 border-b border-zinc-100 pb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition"
              >
                {staffForm.previewUrl ? (
                  <img src={staffForm.previewUrl} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <span className="text-xl">📷</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoSelect(e, setStaffForm)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-yellow-300 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-800 hover:bg-yellow-100 transition shadow-2xs cursor-pointer"
                  >
                    {staffForm.previewUrl ? 'Change Profile Photo' : 'Upload Profile Photo'}
                  </button>
                  {staffForm.previewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setStaffForm((p) => ({ ...p, imageFile: null, previewUrl: null }))
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-2xs cursor-pointer"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">PNG or JPG up to 5MB</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Turner"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Account Password</label>
                <input
                  type="password"
                  placeholder="Set permanent login password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Assigned RBAC Role</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                disabled={!staffForm.name.trim() || !staffForm.phone.trim() || !staffForm.password}
                className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition disabled:opacity-50 cursor-pointer"
              >
                Provision Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ── */}
      {isStaffEditModalOpen && memberToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsStaffEditModalOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-zinc-900">Edit Staff Account</h2>
                <p className="text-xs text-zinc-400 font-medium">Update phone number, password, and access role</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStaffEditModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 flex items-center gap-4 border-b border-zinc-100 pb-4">
              <div
                onClick={() => editFileInputRef.current?.click()}
                className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition"
              >
                {(!staffEditForm.removeAvatar && (staffEditForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img)) ? (
                  <img
                    src={staffEditForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-xl">📷</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoSelect(e, setStaffEditForm)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="rounded-xl border border-yellow-300 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-800 hover:bg-yellow-100 transition shadow-2xs cursor-pointer"
                  >
                    {!staffEditForm.removeAvatar && (staffEditForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img)
                      ? 'Change Profile Photo'
                      : 'Upload Profile Photo'}
                  </button>
                  {!staffEditForm.removeAvatar && (staffEditForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStaffEditForm((p) => ({ ...p, imageFile: null, previewUrl: null, removeAvatar: true }))
                        if (editFileInputRef.current) editFileInputRef.current.value = ''
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-2xs cursor-pointer"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">PNG or JPG up to 5MB</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  value={staffEditForm.name}
                  onChange={(e) => setStaffEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Mobile Number</label>
                <input
                  type="tel"
                  value={staffEditForm.phone}
                  onChange={(e) => setStaffEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Account Password</label>
                <input
                  type="password"
                  placeholder="Update permanent login password"
                  value={staffEditForm.password}
                  onChange={(e) => setStaffEditForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Assigned RBAC Role</label>
                <select
                  value={staffEditForm.role}
                  onChange={(e) => setStaffEditForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsStaffEditModalOpen(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditStaffSave}
                disabled={!staffEditForm.name.trim() || !staffEditForm.phone.trim()}
                className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition disabled:opacity-50 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Factory Reset Confirmation Modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
                <Icon d={IC.alert} size={24} />
              </div>
              <h3 className="text-base font-extrabold text-zinc-900">Confirm Factory Reset?</h3>
              <p className="mt-1 text-xs text-zinc-500 font-medium leading-relaxed">
                This action will permanently wipe all transactional orders, customer profiles, payment ledgers, and reservations from the database, and reset all 12 tables back to available status.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmFactoryReset}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? 'Wiping Cache...' : 'Confirm Factory Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bluetooth Hardware Device Chooser Modal ── */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-yellow-400 font-bold shrink-0 shadow-sm">
                  <Icon d={IC.bluetooth} size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900">Select Bluetooth Printer</h3>
                  <p className="text-xs text-zinc-500 font-medium">Discovered hardware peripherals in range</p>
                </div>
              </div>
              <button
                onClick={handleCancelBluetoothDevice}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-4 max-h-64 overflow-y-auto space-y-2 pr-1">
              {safeAvailableDevices.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 font-medium leading-relaxed">
                  Scanning for Bluetooth peripherals... Make sure your thermal printer is turned on and discoverable.
                </div>
              ) : (
                safeAvailableDevices.map((dev, idx) => (
                  <div
                    key={dev.deviceId || idx}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 hover:border-yellow-400 hover:bg-yellow-50/40 transition shadow-2xs"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-extrabold text-zinc-900 truncate">
                        {dev.deviceName || dev.name || 'Unknown Printer'}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                        ID: {dev.deviceId || 'N/A'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectBluetoothDevice(dev.deviceId, dev.deviceName || dev.name)}
                      className="rounded-xl bg-yellow-400 px-4 py-1.5 text-xs font-extrabold text-zinc-900 hover:bg-yellow-500 shadow-sm transition shrink-0 cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={handleCancelBluetoothDevice}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Settings
