import { useState, useEffect } from 'react'
import api from '../../services/api'

const Table = () => {
	const [tables, setTables] = useState([])
	const [selected, setSelected] = useState(null)

	const fetchTables = async () => {
		try {
			const res = await api.get('/tables')
			const normalized = res.data.map((t) => ({
				_id: t._id,
				id: t._id,
				tableNumber: t.tableNumber,
				seats: t.capacity || 4,
				status: t.status || 'available',
			}))
			setTables(normalized)
			localStorage.setItem('pos_tables_list', JSON.stringify(normalized))
		} catch (err) {
			console.error('Failed to fetch tables from backend:', err)
		}
	}

	useEffect(() => {
		fetchTables()
	}, [])

	useEffect(() => {
		if (tables.length > 0) {
			localStorage.setItem('pos_tables_list', JSON.stringify(tables))
		}
	}, [tables])

	const occupied = tables.filter((t) => t.status === 'occupied').length
	const available = tables.filter((t) => t.status === 'available').length

	const addTable = async () => {
		const nextNum = `Table ${tables.length + 1}`
		try {
			const res = await api.post('/tables', {
				tableNumber: nextNum,
				capacity: 4,
				status: 'available',
			})
			setTables((prev) => [
				...prev,
				{
					_id: res.data._id,
					id: res.data._id,
					tableNumber: res.data.tableNumber,
					seats: res.data.capacity,
					status: res.data.status,
				},
			])
		} catch (err) {
			console.error('Failed to create table:', err)
		}
	}

	const removeTable = async (id) => {
		try {
			await api.delete(`/tables/${id}`)
			setTables((prev) => prev.filter((t) => t.id !== id && t._id !== id))
			setSelected(null)
		} catch (err) {
			console.error('Failed to delete table:', err)
		}
	}

	const toggleStatus = async (id) => {
		const target = tables.find((t) => t.id === id || t._id === id)
		if (!target) return
		const nextStatus = target.status === 'available' ? 'occupied' : 'available'
		try {
			const res = await api.patch(`/tables/${id}/status`, { status: nextStatus })
			setTables((prev) =>
				prev.map((t) =>
					t.id === id || t._id === id ? { ...t, status: res.data.status || nextStatus } : t
				)
			)
			setSelected(null)
			window.dispatchEvent(new Event('pos:table-updated'))
			window.dispatchEvent(new Event('pos:data-updated'))
		} catch (err) {
			console.error('Failed to update table seating status:', err)
		}
	}

	return (
		<div className="flex h-full w-full flex-col gap-6 overflow-hidden">

			{/* Main container */}
			<div className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-md overflow-hidden">

				{/* Header */}
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-zinc-900">Table Management</h1>
						<p className="text-sm text-zinc-500">Live floor plan and seating status sync</p>
					</div>

					{/* Summary pills + Add Table button */}
					<div className="flex flex-wrap items-center gap-3">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm font-medium text-zinc-600 shadow-sm">
							<span className="h-2 w-2 rounded-full bg-zinc-400" />
							{tables.length} Total
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-600 shadow-sm">
							<span className="h-2 w-2 rounded-full bg-orange-400" />
							{occupied} Occupied
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-600 shadow-sm">
							<span className="h-2 w-2 rounded-full bg-green-400" />
							{available} Available
						</span>
						<button
							onClick={addTable}
							className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-zinc-900 shadow-md transition-all hover:bg-yellow-500 hover:shadow-lg active:scale-95"
						>
							<span className="text-base leading-none">+</span>
							Add Table
						</button>
					</div>
				</div>

				{/* Floor plan grid */}
				<div className="flex-1 overflow-y-auto pr-1">
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
						{tables.map((table) => {
							const isOccupied = table.status === 'occupied'
							const isSelected = selected === table.id

							return (
								<button
									key={table.id}
									type="button"
									onClick={() => {
										setSelected((prev) => (prev === table.id ? null : table.id))
									}}
									className={`group relative flex aspect-square flex-col items-center justify-center rounded-2xl border shadow-sm transition-all duration-200 cursor-pointer hover:scale-[1.04] hover:shadow-md active:scale-95
										${isOccupied
											? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
											: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
										}
										${isSelected ? 'ring-2 ring-offset-2 ' + (isOccupied ? 'ring-orange-400' : 'ring-yellow-400') : ''}
									`}
								>
									{/* Table number */}
									<span className={`text-xl font-extrabold leading-none ${isOccupied ? 'text-orange-500' : 'text-zinc-900'}`}>
										{table.tableNumber}
									</span>

									{/* Seats */}
									<span className="mt-1 text-xs font-medium opacity-70">{table.seats} seats</span>

									{/* Status badge */}
									<span className={`mt-2 rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${isOccupied ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
										{isOccupied ? 'Occupied' : 'Available'}
									</span>

									{/* Action overlay on select */}
									{isSelected && (
										<div className="absolute bottom-2 inset-x-2 flex gap-1.5 justify-center z-10">
											<button
												type="button"
												onClick={(e) => { e.stopPropagation(); toggleStatus(table.id) }}
												className="rounded-lg bg-yellow-400 hover:bg-yellow-500 px-2 py-0.5 text-[9px] font-bold text-zinc-900 shadow-sm transition-all"
											>
												{isOccupied ? 'Free' : 'Occupy'}
											</button>
											<button
												type="button"
												onClick={(e) => { e.stopPropagation(); removeTable(table.id) }}
												className="rounded-lg bg-red-500 hover:bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm transition-all"
											>
												Delete
											</button>
										</div>
									)}
								</button>
							)
						})}
					</div>
				</div>

				{/* Legend */}
				<div className="mt-6 flex items-center justify-center gap-8 border-t border-zinc-100 pt-5">
					<div className="flex items-center gap-2 text-sm text-zinc-500">
						<span className="h-3 w-3 rounded-full bg-zinc-300" />
						Available — tap to select, then mark occupied
					</div>
					<div className="flex items-center gap-2 text-sm text-zinc-500">
						<span className="h-3 w-3 rounded-full bg-orange-400" />
						Occupied — tap to select, then mark available
					</div>
				</div>
			</div>
		</div>
	)
}

export default Table