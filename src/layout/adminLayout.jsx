import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getAuthToken } from '../utils/auth'

/* ── Inline SVG icon primitives ── */
const Icon = ({ d, size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11 a2 2 0 0 1 -2 2H5 a2 2 0 0 1 -2 -2z M9 22V12h6v10',
  pos: 'M3 3h18v4H3z M3 10h18v11H3z M8 10v11 M16 10v11',
  table: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  reservation: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14 a2 2 0 0 1 2 2v14 a2 2 0 0 1 -2 2H5 a2 2 0 0 1 -2 -2V6 a2 2 0 0 1 2 -2z',
  payment: 'M2 10h20 M6 6h12 a2 2 0 0 1 2 2v8 a2 2 0 0 1 -2 2H6 a2 2 0 0 1 -2 -2V8 a2 2 0 0 1 2 -2z',
  customer: 'M17 21v-2 a4 4 0 0 0 -4 -4H5 a4 4 0 0 0 -4 4v2 M9 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8z M23 21v-2 a4 4 0 0 0 -3 -3.87 M16 3.13 a4 4 0 0 1 0 7.75',
  invoice: 'M14 2H6 a2 2 0 0 0 -2 2v16 a2 2 0 0 0 2 2h12 a2 2 0 0 0 2 -2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  reports: 'M18 20V10 M12 20V4 M6 20v-6',
  settings: 'M12 15 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6z M19.4 15 a1.65 1.65 0 0 0 0.33 1.82l0.06 0.06 a2 2 0 0 1 0 2.83 a2 2 0 0 1 -2.83 0l-0.06 -0.06 a1.65 1.65 0 0 0 -1.82 -0.33 a1.65 1.65 0 0 0 -1 1.51V21 a2 2 0 0 1 -2 2 a2 2 0 0 1 -2 -2v-0.09 A1.65 1.65 0 0 0 9 19.4 a1.65 1.65 0 0 0 -1.82 0.33l-0.06 0.06 a2 2 0 0 1 -2.83 0 a2 2 0 0 1 0 -2.83l0.06 -0.06 A1.65 1.65 0 0 0 4.68 15 a1.65 1.65 0 0 0 -1.51 -1H3 a2 2 0 0 1 -2 -2 a2 2 0 0 1 2 -2h0.09 A1.65 1.65 0 0 0 4.6 9 a1.65 1.65 0 0 0 -0.33 -1.82l-0.06 -0.06 a2 2 0 0 1 0 -2.83 a2 2 0 0 1 2.83 0l0.06 0.06 A1.65 1.65 0 0 0 9 4.68 a1.65 1.65 0 0 0 1 -1.51V3 a2 2 0 0 1 2 -2 a2 2 0 0 1 2 2v0.09 a1.65 1.65 0 0 0 1 1.51 a1.65 1.65 0 0 0 1.82 -0.33l0.06 -0.06 a2 2 0 0 1 2.83 0 a2 2 0 0 1 0 2.83l-0.06 0.06 A1.65 1.65 0 0 0 19.4 9 a1.65 1.65 0 0 0 1.51 1H21 a2 2 0 0 1 2 2 a2 2 0 0 1 -2 2h-0.09 a1.65 1.65 0 0 0 -1.51 1z',
  logout: 'M9 21H5 a2 2 0 0 1 -2 -2V5 a2 2 0 0 1 2 -2h4 M16 17l5-5-5-5 M21 12H9',
  search: 'M21 21l-6-6 m2-5 a7 7 0 1 1 -14 0 a7 7 0 0 1 14 0z',
  chevronDown: 'M6 9l6 6 6-6',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  check: 'M20 6L9 17l-5-5',
  switch: 'M8 7h12 m0 0l-4-4 m4 4l-4 4 m0 6H4 m0 0l4 4 m-4-4l4-4',
  x: 'M18 6L6 18 M6 6l12 12'
}

/* ── Role-Based Access Control (RBAC) Permissions Matrix ── */
const ROLE_PERMISSIONS = {
  Admin: [
    '/admin/dashboard',
    '/order',
    '/admin/reservations',
    '/admin/payments',
    '/admin/customer',
    '/admin/menu',
    '/admin/reports',
    '/admin/setting'
  ],
  Manager: [
    '/admin/menu',
    '/order',
    '/admin/reservations',
    '/admin/customer',
    '/admin/reports'
  ],
  Cashier: [
    '/order',
    '/admin/reservations',
    '/admin/customer'
  ]
}

const DEFAULT_USER = {
  name: 'Admin User',
  phone: '9876543210',
  role: 'Admin',
  email: 'admin@magixx.com',
  shift: 'Shift #4 (Main Terminal)',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&q=80',
}

const CASHIER_PROFILES = [
  DEFAULT_USER,
  {
    name: 'Chef Manager',
    phone: '9876543211',
    role: 'Manager',
    email: 'chef_manager@magixx.com',
    shift: 'Shift #4 (Kitchen Counter)',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&q=80',
  },
  {
    name: 'Cashier 1',
    phone: '9876543212',
    role: 'Cashier',
    email: 'cashier1@magixx.com',
    shift: 'Shift #1 (Morning POS)',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&q=80',
  },
]

/* ── Shift Switch Profile Helper ── */
const getAvailableProfiles = (activeUser) => {
  const saved = localStorage.getItem('pos_staff_members')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => ({
          name: s.name,
          email: s.email,
          role: s.role,
          avatar: s.img || activeUser?.avatar || DEFAULT_USER.avatar,
          shift: s.shift || 'Shift #4 (Main Terminal)'
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }
  return CASHIER_PROFILES
}

/* ── Nav link component ── */
const SideLink = ({ to, iconPath, label, badge }) => {
  const { pathname } = useLocation()
  const isActive = pathname === to

  return (
    <NavLink
      to={to}
      end
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold md:text-sm transition-all duration-150 ${isActive
          ? 'bg-yellow-400 text-zinc-900 font-bold shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <Icon d={iconPath} size={15} className={isActive ? 'text-zinc-900' : 'text-gray-400'} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-900 leading-none">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ── Section header ── */
const NavSection = ({ label }) => (
  <p className="mt-3.5 mb-1 px-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
    {label}
  </p>
)

const AdminLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)

  const [activeUser, setActiveUser] = useState(() => {
    const saved = localStorage.getItem('pos_active_user') || localStorage.getItem('userInfo')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) {
        console.error(e)
      }
    }
    return CASHIER_PROFILES[0]
  })

  const [storeSettings, setStoreSettings] = useState(() => {
    const saved = localStorage.getItem('pos_store_settings')
    return saved ? JSON.parse(saved) : { brandName: 'MAGIXX', subtitle: 'Sweets & Cafe' }
  })

  // Normalize user role to Admin, Manager, or Cashier
  const rawRole = activeUser?.role || 'Admin'
  const normalizedRole = rawRole.includes('Admin')
    ? 'Admin'
    : rawRole.includes('Manager')
    ? 'Manager'
    : 'Cashier'

  const allowedRoutes = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS['Cashier']

  // Route & Auth Guard Protection
  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      navigate('/', { replace: true })
      return
    }

    const currentPath = location.pathname
    const isAllowed = allowedRoutes.includes(currentPath) || allowedRoutes.some(p => currentPath.startsWith(p + '/'))

    if (currentPath !== '/' && !isAllowed) {
      const fallbackRoute = allowedRoutes[0] || '/order'
      navigate(fallbackRoute, { replace: true })
    }
  }, [location.pathname, allowedRoutes, navigate])

  useEffect(() => {
    localStorage.setItem('pos_active_user', JSON.stringify(activeUser))
  }, [activeUser])

  useEffect(() => {
    const handleStorageChange = () => {
      const savedStore = localStorage.getItem('pos_store_settings')
      if (savedStore) {
        try {
          setStoreSettings(JSON.parse(savedStore))
        } catch (e) {
          console.error(e)
        }
      }
      const savedUser = localStorage.getItem('pos_active_user') || localStorage.getItem('userInfo')
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser)
          if (parsed && typeof parsed === 'object') {
            setActiveUser((prev) => {
              if (
                !prev ||
                prev.name !== parsed.name ||
                prev.role !== parsed.role ||
                prev.phone !== parsed.phone ||
                prev.avatar !== parsed.avatar
              ) {
                return { ...prev, ...parsed }
              }
              return prev
            })
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleStorageChange)
    window.addEventListener('pos_user_updated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleStorageChange)
      window.removeEventListener('pos_user_updated', handleStorageChange)
    }
  }, [])

  const firstLetter = storeSettings.brandName ? storeSettings.brandName.trim().charAt(0).toUpperCase() : 'M'

  const handleLogout = () => {
    setProfileOpen(false)
    clearAuthSession()
    navigate('/', { replace: true })
  }

  const handleSwitchCashier = (profile) => {
    setActiveUser(profile)
    setShiftModalOpen(false)
    setProfileOpen(false)
    
    // Redirect to home path of new role if current path is restricted
    const newRole = profile.role.includes('Admin') ? 'Admin' : (profile.role.includes('Manager') ? 'Manager' : 'Cashier')
    const newAllowed = ROLE_PERMISSIONS[newRole] || ROLE_PERMISSIONS['Cashier']
    if (!newAllowed.includes(location.pathname)) {
      navigate(newAllowed[0] || '/order')
    }
  }

  // Filter sidebar sections based on role permissions
  const canSeeDashboard = allowedRoutes.includes('/admin/dashboard')
  const canSeePOS = allowedRoutes.includes('/order')
  const canSeeReservations = allowedRoutes.includes('/admin/reservations')
  const canSeePayments = allowedRoutes.includes('/admin/payments')
  const canSeeCustomer = allowedRoutes.includes('/admin/customer')
  const canSeeMenu = allowedRoutes.includes('/admin/menu')
  const canSeeReports = allowedRoutes.includes('/admin/reports')
  const canSeeSettings = allowedRoutes.includes('/admin/setting')

  const hasMainGroup = canSeeDashboard || canSeePOS || canSeeReservations
  const hasOfferingGroup = canSeePayments || canSeeCustomer || canSeeMenu
  const hasBackOfficeGroup = canSeeReports || canSeeSettings

  return (
    <div className="flex h-screen w-full overflow-x-hidden bg-gray-50 text-gray-900">

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-white
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 shadow-sm shrink-0">
            <span className="text-base font-black text-zinc-900">{firstLetter}</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-gray-900 uppercase">{storeSettings.brandName}</h1>
            <p className="text-[9px] text-gray-400 font-medium">{storeSettings.subtitle}</p>
          </div>
        </div>

        {/* User profile card (sidebar display) */}
        <div className="mx-3 my-2.5 flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-2.5 py-2">
          <div className="relative shrink-0">
            <img
              src={activeUser.avatar}
              alt="user"
              className="h-8 w-8 rounded-full object-cover ring-2 ring-yellow-400"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-gray-900">{activeUser.name}</p>
            <p className="truncate text-[10px] text-gray-400 font-medium">{normalizedRole} Role</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 pb-3">

          {/* Main group */}
          {hasMainGroup && (
            <>
              <NavSection label="Main" />
              <div className="space-y-0.5">
                {canSeeDashboard && <SideLink to="/admin/dashboard" iconPath={ICONS.dashboard} label="Dashboard" />}
                {canSeePOS && <SideLink to="/order" iconPath={ICONS.pos} label="POS" />}
                {canSeeReservations && <SideLink to="/admin/reservations" iconPath={ICONS.reservation} label="Reservations" />}
              </div>
            </>
          )}

          {/* Offering group */}
          {hasOfferingGroup && (
            <>
              <NavSection label="Offering" />
              <div className="space-y-0.5">
                {canSeePayments && <SideLink to="/admin/payments" iconPath={ICONS.payment} label="Payments" />}
                {canSeeCustomer && <SideLink to="/admin/customer" iconPath={ICONS.customer} label="Customer" />}
                {canSeeMenu && <SideLink to="/admin/menu" iconPath={ICONS.invoice} label="Menu Management" />}
              </div>
            </>
          )}

          {/* Back Office group */}
          {hasBackOfficeGroup && (
            <>
              <NavSection label="Back Office" />
              <div className="space-y-0.5">
                {canSeeReports && <SideLink to="/admin/reports" iconPath={ICONS.reports} label="Reports" />}
                {canSeeSettings && <SideLink to="/admin/setting" iconPath={ICONS.settings} label="Setting" />}
              </div>
            </>
          )}
        </nav>
      </aside>

      {/* Sidebar mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Dropdown Backdrop to close open profile menu on click outside */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setProfileOpen(false)}
        />
      )}

      {/* ══════════ MAIN CONTENT AREA ══════════ */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">

        {/* Top Navbar with z-40 so floating menus float above page content */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 sm:gap-4 border-b border-gray-200 bg-white px-3 sm:px-5 shadow-xs">

          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Icon d={ICONS.menu} size={20} />
          </button>

          {/* Role Pill Badge in Navbar */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
            <span className={`h-2 w-2 rounded-full ${normalizedRole === 'Admin' ? 'bg-amber-500' : (normalizedRole === 'Manager' ? 'bg-blue-500' : 'bg-green-500')}`} />
            <span>Active Role: <strong className="text-zinc-900 font-extrabold">{normalizedRole}</strong></span>
          </div>

          {/* Top Right User Profile Dropdown Card */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-100 transition shadow-2xs"
              >
                <img
                  src={activeUser.avatar}
                  alt="profile"
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-yellow-400"
                />
                <div className="hidden text-left sm:block">
                  <span className="block text-xs font-bold text-gray-800 leading-tight">{activeUser.name}</span>
                  <span className="block text-[9px] text-gray-400 font-medium leading-none">{normalizedRole}</span>
                </div>
                <Icon d={ICONS.chevronDown} size={12} className="text-gray-400" />
              </button>

              {/* Single, clean Profile Options Dropdown Popover */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="space-y-0.5">
                    {canSeeSettings && (
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          navigate('/admin/setting')
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                      >
                        <Icon d={ICONS.settings} size={15} className="text-gray-400" />
                        <span>Profile Settings</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        setShiftModalOpen(true)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                      <Icon d={ICONS.switch} size={15} className="text-gray-400" />
                      <span>Switch Shift / Cashier</span>
                    </button>
                  </div>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                  >
                    <Icon d={ICONS.logout} size={15} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden p-3 sm:p-5">
          <Outlet />
        </main>
      </div>

      {/* ══════════ SWITCH SHIFT / CASHIER MODAL ══════════ */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Switch Shift / Cashier</h3>
                <p className="text-xs text-gray-400">Select active user profile for current terminal shift</p>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <Icon d={ICONS.x} size={18} />
              </button>
            </div>

            <div className="space-y-2.5 my-4">
              {getAvailableProfiles(activeUser).map((p) => {
                const isSelected = activeUser.email === p.email
                return (
                  <div
                    key={p.email}
                    onClick={() => handleSwitchCashier(p)}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-50/60'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <img src={p.avatar} alt={p.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-400/80" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.role} • {p.shift}</p>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-yellow-400 p-1 text-zinc-900 font-bold">
                        <Icon d={ICONS.check} size={12} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShiftModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
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

export default AdminLayout
