import { useRef, useState, useEffect } from 'react'
import api from '../../services/api'

const ROLE_STYLES = {
  Admin: 'bg-violet-50 text-violet-700 border-violet-200 font-extrabold',
  Manager: 'bg-blue-50 text-blue-700 border-blue-200 font-extrabold',
  Cashier: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold'
}

const ROLES = ['Admin', 'Manager', 'Cashier']

const SHIFTS = [
  'Shift #1 (Morning POS)',
  'Shift #2 (Afternoon Peak)',
  'Shift #3 (Evening Closing)',
  'Shift #4 (Main Terminal)',
  'Shift #4 (Kitchen Counter)'
]

const DEFAULT_STAFF = [
  {
    id: 'admin_1',
    _id: 'admin_1',
    name: 'Admin',
    email: 'admin@magixx.com',
    phone: '9876543210',
    role: 'Admin',
    status: 'active',
    img: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&q=80',
    since: 'Jan 2024',
    shift: 'Shift #4 (Main Terminal)'
  },
  {
    id: 'manager_1',
    _id: 'manager_1',
    name: 'Chef Manager',
    email: 'chef_manager@magixx.com',
    phone: '9876543211',
    role: 'Manager',
    status: 'active',
    img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&q=80',
    since: 'Mar 2024',
    shift: 'Shift #4 (Kitchen Counter)'
  },
  {
    id: 'cashier_1',
    _id: 'cashier_1',
    name: 'Cashier 1',
    email: 'cashier1@magixx.com',
    phone: '9876543212',
    role: 'Cashier',
    status: 'active',
    img: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&q=80',
    since: 'May 2024',
    shift: 'Shift #1 (Morning POS)'
  }
]

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'Cashier',
  shift: SHIFTS[0],
  imageFile: null,
  previewUrl: null
}

const Users = () => {
  const [staff, setStaff] = useState(() => {
    const saved = localStorage.getItem('pos_staff_members')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (e) {
        console.error(e)
      }
    }
    return DEFAULT_STAFF
  })

  const fetchStaffData = async () => {
    try {
      const res = await api.get('/users')
      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalized = res.data.map((u) => ({
          id: u._id || u.id,
          _id: u._id || u.id,
          name: u.name,
          phone: u.phone || '',
          email: u.email || `${(u.name || 'user').toLowerCase().replace(/\s+/g, '')}@magixx.com`,
          role: u.role || 'Cashier',
          status: u.status || 'active',
          shift: u.shift || SHIFTS[0],
          img: u.avatar || u.img || null,
          avatar: u.avatar || u.img || null,
          since: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Jan 2024'
        }))
        setStaff(normalized)
        localStorage.setItem('pos_staff_members', JSON.stringify(normalized))
      }
    } catch (err) {
      console.warn('Backend /users endpoint fetch warning:', err)
    }
  }

  useEffect(() => {
    fetchStaffData()
  }, [])

  useEffect(() => {
    if (staff.length > 0) {
      localStorage.setItem('pos_staff_members', JSON.stringify(staff))
    }
  }, [staff])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [memberToEdit, setMemberToEdit] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  const toggleStatus = async (id) => {
    const target = staff.find((s) => (s._id || s.id) === id)
    if (!target) return
    const nextStatus = target.status === 'active' ? 'offline' : 'active'
    try {
      if (id && typeof id === 'string' && id.length > 10) {
        await api.put(`/users/${id}`, { status: nextStatus })
      }
    } catch (err) {
      console.warn('Backend toggle status error:', err.message)
    }

    setStaff((prev) =>
      prev.map((s) => ((s._id || s.id) === id ? { ...s, status: nextStatus } : s))
    )
  }

  const activeCount = staff.filter((s) => s.status === 'active').length

  const openModal = () => {
    setForm(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setForm(EMPTY_FORM)
    setIsModalOpen(false)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setForm((prev) => ({ ...prev, imageFile: file, previewUrl: event.target.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) return
    const now = new Date()
    const since = now.toLocaleString('default', { month: 'short' }) + ' ' + now.getFullYear()
    
    let createdMember = null
    try {
      const res = await api.post('/users', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password.trim(),
        role: form.role,
        shift: form.shift,
        avatar: form.previewUrl || ''
      })
      if (res.data) {
        createdMember = {
          id: res.data._id || res.data.id,
          _id: res.data._id || res.data.id,
          name: res.data.name,
          phone: res.data.phone,
          email: res.data.email || form.email || `${form.name.toLowerCase().replace(/\s+/g, '')}@magixx.com`,
          role: res.data.role,
          status: res.data.status || 'active',
          img: res.data.avatar || form.previewUrl || null,
          since,
          shift: res.data.shift || form.shift
        }
      }
    } catch (err) {
      console.warn('Backend create user warning:', err.message)
    }

    if (!createdMember) {
      createdMember = {
        id: Date.now(),
        _id: Date.now(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || `${form.name.toLowerCase().replace(/\s+/g, '')}@magixx.com`,
        role: form.role,
        status: 'active',
        img: form.previewUrl || null,
        since,
        shift: form.shift
      }
    }

    setStaff((prev) => [createdMember, ...prev])
    closeModal()
  }

  const removeMember = async (id) => {
    try {
      if (id && typeof id === 'string' && id.length > 10) {
        await api.delete(`/users/${id}`)
      }
    } catch (err) {
      console.warn('Backend delete staff error:', err.message)
    }
    setStaff((prev) => prev.filter((s) => (s._id || s.id) !== id))
  }

  const openEditModal = (member) => {
    setMemberToEdit(member)
    setEditForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      role: member.role,
      shift: member.shift || SHIFTS[0],
      imageFile: null,
      previewUrl: member.avatar || member.img || null,
      removeAvatar: false
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditForm(EMPTY_FORM)
    setMemberToEdit(null)
    setIsEditModalOpen(false)
  }

  const handleEditFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setEditForm((prev) => ({ ...prev, imageFile: file, previewUrl: event.target.result, removeAvatar: false }))
    }
    reader.readAsDataURL(file)
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim() || !memberToEdit) return
    const id = memberToEdit._id || memberToEdit.id
    const newAvatar = editForm.removeAvatar ? '' : (editForm.previewUrl || memberToEdit?.avatar || memberToEdit?.img || '')
    
    try {
      const updateData = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        shift: editForm.shift,
        avatar: newAvatar,
        removeAvatar: Boolean(editForm.removeAvatar)
      }
      if (editForm.password && editForm.password.trim()) {
        updateData.password = editForm.password.trim()
      }
      if (id && typeof id === 'string' && id.length > 10) {
        await api.put(`/users/${id}`, updateData)
      }
    } catch (err) {
      console.warn('Backend edit staff error:', err.message)
    }

    setStaff((prev) =>
      prev.map((s) =>
        (s._id || s.id) === id
          ? {
              ...s,
              name: editForm.name.trim(),
              phone: editForm.phone.trim(),
              email: editForm.email.trim() || s.email,
              role: editForm.role,
              shift: editForm.shift,
              img: newAvatar,
              avatar: newAvatar
            }
          : s
      )
    )
    closeEditModal()
  }

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Admin Staff Provisioning</h1>
          <p className="mt-0.5 text-xs text-zinc-500 font-medium">
            Manage system users, assign role access levels (Admin, Manager, Cashier), and manage staff credentials.
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md transition-all hover:bg-yellow-500 hover:shadow-lg active:scale-95"
        >
          <span className="text-base leading-none">+</span>
          Provision New Staff
        </button>
      </div>

      {/* Staff Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-zinc-200 rounded-2xl w-full">
            <span className="text-4xl mb-2">👤</span>
            <p className="text-sm font-semibold text-zinc-500 font-sans">No staff accounts provisioned</p>
            <p className="text-xs text-zinc-400 mt-1">Click "Provision New Staff" above to create an account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]"
              >
                {/* Avatar + Online Indicator */}
                <div className="relative">
                  <img
                    src={member.img}
                    alt={member.name}
                    className="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-yellow-400/80"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${
                      member.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'
                    }`}
                  />
                </div>

                {/* Name & Email */}
                <div className="text-center w-full">
                  <p className="font-extrabold text-zinc-900 text-sm truncate">{member.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{member.email || 'staff@magixx.com'}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{member.shift}</p>
                </div>

                {/* Role Badge */}
                <span className={`rounded-full border px-3 py-0.5 text-[11px] ${ROLE_STYLES[member.role] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
                  {member.role}
                </span>

                {/* Status Toggle */}
                <button
                  onClick={() => toggleStatus(member.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                    member.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-zinc-50 text-zinc-400 border border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {member.status === 'active' ? 'Active Access' : 'Access Suspended'}
                </button>

                {/* Actions */}
                <div className="flex w-full gap-2 pt-2 border-t border-zinc-100 mt-1">
                  <button
                    onClick={() => openEditModal(member)}
                    className="flex-1 rounded-xl border border-yellow-300 bg-yellow-50/80 py-1.5 text-xs font-bold text-yellow-800 transition-all hover:bg-yellow-100 active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="flex-1 rounded-xl border border-red-100 bg-red-50 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-100 active:scale-95"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Provision New Staff Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-zinc-900">Provision New Staff Member</h2>
                <p className="text-xs text-zinc-400 font-medium">Create staff login credentials and assign system access role</p>
              </div>
              <button
                onClick={closeModal}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Avatar Upload */}
            <div className="mb-5 flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 hover:border-yellow-400 hover:bg-yellow-50 transition"
              >
                {form.previewUrl ? (
                  <img src={form.previewUrl} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl text-zinc-300">👤</div>
                )}
              </div>

              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-yellow-300 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-800 hover:bg-yellow-100 transition"
                >
                  {form.imageFile ? 'Change Photo' : 'Upload Profile Photo'}
                </button>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Turner"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Account Password</label>
                <input
                  type="password"
                  placeholder="Permanent login password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Assigned RBAC Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Shift / Terminal Assignment</label>
                <select
                  value={form.shift}
                  onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.phone.trim() || !form.password.trim()}
                className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition disabled:opacity-50"
              >
                Provision Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ── */}
      {isEditModalOpen && memberToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal() }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-zinc-900">Edit Staff Account</h2>
                <p className="text-xs text-zinc-400 font-medium">Update permissions and shift assignment</p>
              </div>
              <button
                onClick={closeEditModal}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Mobile Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Account Password</label>
                <input
                  type="password"
                  placeholder="Update password (optional)"
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Assigned RBAC Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">Shift / Terminal</label>
                <select
                  value={editForm.shift}
                  onChange={(e) => setEditForm((p) => ({ ...p, shift: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={closeEditModal}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editForm.name.trim() || !editForm.phone.trim()}
                className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-extrabold text-zinc-900 shadow-md hover:bg-yellow-500 transition disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
