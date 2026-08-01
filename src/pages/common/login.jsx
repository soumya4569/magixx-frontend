import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

/* ── Inline SVG Icon Helper ── */
const Icon = ({ d, size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const ICONS = {
  userOrMail: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24 M1 1l22 22',
  admin: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  manager: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  cashier: 'M3 10h18M7 15h1m4 0h1m-7 4h1m4 0h1m-5-14h12a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  arrowRight: 'M5 12h14M12 5l7 7-7 7'
}

const Login = () => {
  const navigate = useNavigate()
  const [role, setRole] = useState('Admin') // 'Admin' | 'Manager' | 'Cashier'

  // Auth Guard: Auto-redirect active authenticated sessions to prevent back-button loops
  useEffect(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('pos_auth_token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('pos_auth_token')

    if (token) {
      let activeRole = 'Admin'
      try {
        const user = JSON.parse(
          localStorage.getItem('userInfo') ||
          localStorage.getItem('pos_active_user') ||
          '{}'
        )
        activeRole = user.role || 'Admin'
      } catch {
        activeRole = 'Admin'
      }

      if (activeRole === 'Admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (activeRole === 'Manager') {
        navigate('/admin/menu', { replace: true })
      } else {
        navigate('/order', { replace: true })
      }
    }
  }, [navigate])

  // Form State - Mobile or Email Flexible Identifier
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Validation & Loading
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const validateForm = () => {
    const newErrors = {}

    if (!identifier.trim()) {
      newErrors.identifier = 'Mobile number or email address is required'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    if (!validateForm()) return

    setIsLoading(true)

    try {
      // Authenticate via backend API /auth/login
      const response = await api.post('/auth/login', {
        phone: identifier.trim(),
        password: password,
        role: role,
      })

      const data = response.data

      // Safely store JWT token and user profile in localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('userInfo', JSON.stringify(data))
      localStorage.setItem('pos_auth_token', data.token)
      localStorage.setItem('pos_active_user', JSON.stringify({
        _id: data._id,
        name: data.name,
        phone: data.phone,
        role: data.role,
        avatar: data.avatar || '',
        token: data.token,
        loginAt: new Date().toISOString(),
      }))

      setIsLoading(false)

      // Role-Based Navigation with replace: true to prevent browser history loops
      const activeRole = data.role || role
      if (activeRole === 'Admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (activeRole === 'Manager') {
        navigate('/admin/menu', { replace: true })
      } else {
        navigate('/order', { replace: true })
      }
    } catch (err) {
      setIsLoading(false)
      const errorMsg =
        err.response?.data?.message ||
        'Login failed. Please check your credentials or server connection.'
      setServerError(errorMsg)
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-zinc-100 p-4 font-sans text-zinc-900">
      <div className="w-full max-w-md">

        {/* Brand Logo & Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 shadow-md">
            <span className="text-2xl font-black text-zinc-900">M</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">MAGIXX Sweets &amp; Cafe</h1>
          <p className="mt-1 text-xs text-zinc-500 font-medium">Point of Sale &amp; Executive Management System</p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-7 shadow-xl">

          {/* Single-View Title */}
          <div className="mb-5 border-b border-zinc-100 pb-3">
            <h2 className="text-base font-extrabold text-zinc-900">Staff Sign In</h2>
            <p className="text-xs text-zinc-400 font-medium">Enter your registered mobile or email to access your terminal</p>
          </div>

          {/* Role Selection (Admin vs Manager vs Cashier) */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-bold text-zinc-700 uppercase tracking-wider">Select Access Role</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('Admin')}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  role === 'Admin'
                    ? 'border-yellow-400 bg-yellow-50/60 ring-2 ring-yellow-400/50'
                    : 'border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${role === 'Admin' ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Icon d={ICONS.admin} size={15} />
                </div>
                <span className="text-[11px] font-extrabold text-zinc-900">Admin</span>
                <span className="text-[9px] text-zinc-400 font-medium">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('Manager')}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  role === 'Manager'
                    ? 'border-yellow-400 bg-yellow-50/60 ring-2 ring-yellow-400/50'
                    : 'border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${role === 'Manager' ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Icon d={ICONS.manager} size={15} />
                </div>
                <span className="text-[11px] font-extrabold text-zinc-900">Manager</span>
                <span className="text-[9px] text-zinc-400 font-medium">Menu &amp; POS</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('Cashier')}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  role === 'Cashier'
                    ? 'border-yellow-400 bg-yellow-50/60 ring-2 ring-yellow-400/50'
                    : 'border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${role === 'Cashier' ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Icon d={ICONS.cashier} size={15} />
                </div>
                <span className="text-[11px] font-extrabold text-zinc-900">Cashier</span>
                <span className="text-[9px] text-zinc-400 font-medium">POS Only</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Server Error Alert */}
            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {serverError}
              </div>
            )}

            {/* Flexible Identifier: Mobile Number or Email */}
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700">Mobile Number or Email</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Icon d={ICONS.userOrMail} size={16} />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 9876543210 or name@magixx.com"
                  className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                    errors.identifier ? 'border-red-300 focus:ring-red-400' : 'border-zinc-200 focus:border-yellow-400 focus:ring-yellow-400/50'
                  }`}
                />
              </div>
              {errors.identifier && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.identifier}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700">Account Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Icon d={ICONS.lock} size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-9 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                    errors.password ? 'border-red-300 focus:ring-red-400' : 'border-zinc-200 focus:border-yellow-400 focus:ring-yellow-400/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
                >
                  <Icon d={showPassword ? ICONS.eyeOff : ICONS.eye} size={16} />
                </button>
              </div>
              {errors.password && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.password}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-xs font-extrabold text-zinc-900 shadow-md transition-all hover:bg-yellow-500 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-zinc-900" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Sign In as {role}</span>
                  <Icon d={ICONS.arrowRight} size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11px] text-zinc-400 font-medium">
          MAGIXX Sweets &amp; Cafe POS v2.4 • Secure Direct Password Authentication
        </p>
      </div>
    </main>
  )
}

export default Login
