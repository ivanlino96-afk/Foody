import { Route, Routes, useParams } from 'react-router'
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
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
