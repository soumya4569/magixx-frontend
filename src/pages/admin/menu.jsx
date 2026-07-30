import { useRef, useState, useEffect, useMemo } from 'react'
import api from '../../services/api'

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

const CATEGORIES = [
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

const Icon = ({ d, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d={d || 'M0 0h24v24H0z'} />
  </svg>
)

const ICON_SEARCH   = 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z'
const ICON_TRASH    = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
const ICON_EDIT     = 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z'

const EMPTY_FORM = { name: '', category: 'Pizza', price: '', description: '', imageFile: null, previewUrl: null, imageUrl: '' }

const Menu = () => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('Show All')

  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [itemToEdit, setItemToEdit] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [itemToDelete, setItemToDelete] = useState(null)

  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  // Fetch menu items from live backend API
  const fetchMenuItems = async () => {
    try {
      setIsLoading(true)
      const res = await api.get('/menu')
      const normalized = res.data.map((item) => ({
        ...item,
        id: item._id || item.id,
        img: item.image || item.img || '/images/placeholder.jpg',
      }))
      setItems(normalized)
    } catch (err) {
      console.error('Failed to fetch menu items from backend:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMenuItems()
  }, [])

  /* ── Derived Categories ── */
  const derivedCategories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category)))
    const sortedCats = CATEGORIES.filter((c) => cats.includes(c))
    const extraCats = cats.filter((c) => !CATEGORIES.includes(c))
    return ['Show All', ...sortedCats, ...extraCats]
  }, [items])

  /* ── Category Order Map for Category-wise Sorting ── */
  const categoryOrderMap = useMemo(() => {
    const map = {}
    CATEGORIES.forEach((cat, index) => {
      map[cat] = index
    })
    return map
  }, [])

  /* ── Category-wise Filtered & Sorted Items ── */
  const filteredItems = useMemo(() => {
    let list = items
    if (selectedCategory !== 'Show All') {
      list = list.filter((i) => i.category === selectedCategory)
    }

    const q = searchQuery.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
      )
    }

    // Sort category wise according to CATEGORIES order, then alphabetically by name
    return [...list].sort((a, b) => {
      const orderA = categoryOrderMap[a.category] ?? 999
      const orderB = categoryOrderMap[b.category] ?? 999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [items, selectedCategory, searchQuery, categoryOrderMap])

  /* ── CRUD Actions ── */
  const confirmDelete = async () => {
    if (!itemToDelete) return
    const id = itemToDelete.id || itemToDelete._id
    try {
      await api.delete(`/menu/${id}`)
      setItems((prev) => prev.filter((i) => i.id !== id && i._id !== id))
      setItemToDelete(null)
    } catch (err) {
      console.error('Failed to delete menu item:', err)
    }
  }

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
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        previewUrl: reader.result,
        imageUrl: ''
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: parseFloat(form.price),
        description: form.description?.trim() || '',
        image: form.previewUrl || form.imageUrl || '/images/placeholder.jpg',
      }
      const res = await api.post('/menu', payload)
      const newItem = {
        ...res.data,
        id: res.data._id || res.data.id,
        img: res.data.image || payload.image,
      }
      setItems((prev) => [newItem, ...prev])
      closeModal()
    } catch (err) {
      console.error('Failed to create menu item:', err)
    }
  }

  /* ── Edit helpers ── */
  const openEditModal = (item) => {
    setItemToEdit(item)
    setEditForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      description: item.description || '',
      imageFile: null,
      previewUrl: item.img || item.image || '',
      imageUrl: (item.img || item.image || '').startsWith('data:') ? '' : (item.img || item.image || ''),
      imageRemoved: false,
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditForm(EMPTY_FORM)
    setItemToEdit(null)
    setIsEditModalOpen(false)
  }

  const handleEditFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditForm((prev) => ({
        ...prev,
        imageFile: file,
        previewUrl: reader.result,
        imageUrl: '',
        imageRemoved: false,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveEditImage = () => {
    setEditForm((prev) => ({
      ...prev,
      imageFile: null,
      previewUrl: '',
      imageUrl: '',
      imageRemoved: true,
    }))
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ''
    }
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim() || !editForm.price || !itemToEdit) return
    try {
      const targetId = itemToEdit._id || itemToEdit.id
      const finalImage = editForm.imageRemoved
        ? ''
        : (editForm.previewUrl || editForm.imageUrl || '')
      const payload = {
        name: editForm.name.trim(),
        category: editForm.category,
        price: parseFloat(editForm.price),
        description: editForm.description?.trim() || '',
        image: finalImage,
      }
      const res = await api.put(`/menu/${targetId}`, payload)
      const updated = {
        ...res.data,
        id: res.data._id || targetId,
        img: res.data.image !== undefined ? res.data.image : payload.image,
      }
      setItems((prev) =>
        prev.map((i) => (i.id === targetId || i._id === targetId ? updated : i))
      )
      closeEditModal()
    } catch (err) {
      console.error('Failed to update menu item:', err)
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-hidden">

      {/* Title Banner & Description (Without Icon) */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Menu Management</h1>
        <p className="text-sm text-zinc-500">Manage catalog dishes, prices, descriptions, and categories sorted category wise</p>
      </div>

      {/* Main Table Section Card */}
      <div className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-md overflow-hidden">

        {/* Toolbar: Total Counter (Left), Shorter Search Bar & Add New Button (Right) */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-xs font-bold text-zinc-500">
            Total Dishes: <span className="text-zinc-900 font-extrabold">{filteredItems.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 w-48 sm:w-56">
              <Icon d={ICON_SEARCH} size={14} className="shrink-0 text-zinc-400" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-xs text-zinc-400 hover:text-zinc-600">✕</button>
              )}
            </div>

            <button
              onClick={openModal}
              className="flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-sm hover:bg-yellow-500 transition active:scale-95 cursor-pointer"
            >
              <span className="text-sm font-black">+</span>
              <span>Add New Item</span>
            </button>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto border-b border-zinc-100 pb-3 scrollbar-thin shrink-0">
          {derivedCategories.map((cat) => {
            const count = cat === 'Show All' ? items.length : items.filter((i) => i.category === cat).length
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-400 text-zinc-900 shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {cat !== 'Show All' && <span>{CATEGORY_EMOJIS[cat] || '🍽️'}</span>}
                <span>{cat}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Category Wise Dishes Table Area */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-zinc-400">
              <span className="text-2xl animate-spin">⏳</span>
              <p className="text-xs font-bold">Loading menu catalog...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center p-6">
              <span className="text-3xl opacity-40">🍽️</span>
              <p className="text-sm font-bold text-zinc-700">No dishes match your query</p>
              <p className="text-xs text-zinc-400">Try adjusting your category filter or search input.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-zinc-700">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Dish</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white font-medium">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                    {/* Dish Image + Name + Description */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.img}
                          alt={item.name}
                          onError={(e) => { e.target.src = '/images/placeholder.jpg'; }}
                          className="h-11 w-11 rounded-xl object-cover shadow-xs border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 text-xs md:text-sm truncate">{item.name}</p>
                          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                            {item.description || 'Delicious dish from our menu.'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-800">
                        <span>{CATEGORY_EMOJIS[item.category] || '🍽️'}</span>
                        <span>{item.category}</span>
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 font-black text-zinc-900 text-sm">
                      ₹{item.price.toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex items-center gap-1 rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-800 hover:bg-yellow-100 transition active:scale-95 cursor-pointer"
                        >
                          <Icon d={ICON_EDIT} size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition active:scale-95 cursor-pointer"
                        >
                          <Icon d={ICON_TRASH} size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add New Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900">Add New Dish</h3>
                <p className="text-xs text-zinc-400">Add a dish to your live restaurant menu</p>
              </div>
              <button onClick={closeModal} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Special Paneer Pizza"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short description of ingredients or preparation..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Dish Image</label>
                <div className="flex items-center gap-3">
                  {form.previewUrl ? (
                    <img src={form.previewUrl} alt="Preview" className="h-12 w-12 rounded-xl object-cover border border-zinc-200 shadow-xs" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl text-zinc-400">🍽️</div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-xs text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-yellow-900 hover:file:bg-yellow-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button onClick={closeModal} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.price}
                className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-sm hover:bg-yellow-500 disabled:opacity-40 cursor-pointer"
              >
                Save Dish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900">Edit Dish</h3>
                <p className="text-xs text-zinc-400">Update dish details in your catalog</p>
              </div>
              <button onClick={closeEditModal} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Dish Image</label>
                <div className="flex flex-wrap items-center gap-3">
                  {editForm.previewUrl ? (
                    <img src={editForm.previewUrl} alt="Preview" className="h-12 w-12 rounded-xl object-cover border border-zinc-200 shadow-xs" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl text-zinc-400">🍽️</div>
                  )}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditFileChange}
                    className="text-xs text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-yellow-900 hover:file:bg-yellow-200 cursor-pointer"
                  />
                  {Boolean(editForm.previewUrl || editForm.imageUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveEditImage}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition active:scale-95 cursor-pointer"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button onClick={closeEditModal} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editForm.name.trim() || !editForm.price}
                className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-extrabold text-zinc-900 shadow-sm hover:bg-yellow-500 disabled:opacity-40 cursor-pointer"
              >
                Update Dish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Icon d={ICON_TRASH} size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900">Delete Dish</h3>
                <p className="text-xs text-zinc-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 font-medium">
              Are you sure you want to delete <span className="font-bold text-zinc-900">"{itemToDelete.name}"</span> from your catalog?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button onClick={() => setItemToDelete(null)} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-red-700 cursor-pointer"
              >
                Delete Dish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Menu
