import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/adminLayout.jsx'
import Login from './pages/common/login.jsx'
import Dashboard from './pages/admin/dashboard.jsx'
import Menu from './pages/admin/menu.jsx'
import Order from './pages/common/order.jsx'
import Customer from './pages/admin/customer.jsx'
import Reports from './pages/admin/reports.jsx'
import Settings from './pages/admin/setting.jsx'
import Reservations from './pages/admin/reservations.jsx'
import Payments from './pages/admin/payments.jsx'
import { getAuthToken } from './utils/auth'

const ProtectedRoute = ({ children }) => {
  const token = getAuthToken()
  if (!token) {
    return <Navigate to="/" replace />
  }
  return children
}

const App = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={<Login />} />

      {/* Authenticated routes sharing AdminLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/order" element={<Order />} />

        <Route path="/admin">
          <Route index         element={<Dashboard />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="users"        element={<Navigate to="/admin/setting" replace />} />
          <Route path="menu"         element={<Menu />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="payments"     element={<Payments />} />
          <Route path="customer"     element={<Customer />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="setting"      element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
