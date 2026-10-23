import { Navigate, Outlet, Route, Routes, useParams } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import { RequireRole, StaffLoading, homeFor } from '../features/auth/RequireRole'
import { LoginView } from '../features/auth/views/LoginView'
import { AvailabilityView } from '../features/availability/views/AvailabilityView'
import { KitchenBoardView } from '../features/kitchen/views/KitchenBoardView'
import { AdminLayout } from '../features/admin/AdminLayout'
import { DashboardView } from '../features/admin/views/DashboardView'
import { OrdersView } from '../features/admin/views/OrdersView'
import { MenuAdminView } from '../features/admin/views/MenuAdminView'
import { IngredientsExtrasView } from '../features/admin/views/IngredientsExtrasView'
import { WaiterView } from '../features/waiter/views/WaiterView'
import { DinerProvider } from '../features/diner/DinerContext'
import { DinerStatusGate } from '../features/diner/DinerStatusGate'
import { SplashGate } from '../features/diner/SplashGate'
import { AccountView } from '../features/diner/views/AccountView'
import { CartView } from '../features/diner/views/CartView'
import { DishDetailView } from '../features/diner/views/DishDetailView'
import { MenuView } from '../features/diner/views/MenuView'

function DinerRoot() {
  const { token = '' } = useParams()
  return (
    <DinerProvider key={token} token={token}>
      <SplashGate>
        <DinerStatusGate>
          <Routes>
            <Route index element={<MenuView />} />
            <Route path="platillo/:itemId" element={<DishDetailView />} />
            <Route path="pedido" element={<CartView />} />
            <Route path="cuenta" element={<AccountView />} />
          </Routes>
        </DinerStatusGate>
      </SplashGate>
    </DinerProvider>
  )
}

function StaffRoot() {
  return <AuthProvider><Outlet /></AuthProvider>
}

function StaffIndex() {
  const { status, staff } = useAuth()
  if (status === 'loading') return <StaffLoading />
  return <Navigate to={staff ? homeFor(staff.role) : '/login'} replace />
}

function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bosque px-8 text-center text-white">
      <span className="text-4xl font-extrabold tracking-tight">foody<span className="text-[#D6A262]">.</span></span>
      <p className="m-0 text-[15px] text-[#D5E2D8]">Escanea el QR de tu mesa para ver el menú.</p>
    </main>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/mesa/:token/*" element={<DinerRoot />} />
      <Route element={<StaffRoot />}>
        <Route path="/login" element={<LoginView />} />
        <Route path="/personal" element={<StaffIndex />} />
        <Route path="/cocina" element={<RequireRole roles={['kitchen']}><KitchenBoardView /></RequireRole>} />
        <Route path="/cocina/disponibilidad"
          element={<RequireRole roles={['kitchen']}><AvailabilityView backTo="/cocina" /></RequireRole>} />
        <Route path="/mesero" element={<RequireRole roles={['waiter']}><WaiterView /></RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={['admin']}><AdminLayout /></RequireRole>}>
          <Route index element={<DashboardView />} />
          <Route path="ordenes" element={<OrdersView />} />
          <Route path="menu" element={<MenuAdminView />} />
          <Route path="ingredientes" element={<IngredientsExtrasView />} />
          <Route path="disponibilidad" element={<AvailabilityView />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
