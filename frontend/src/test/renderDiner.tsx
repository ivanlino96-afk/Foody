import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { DinerApi } from '../data/api/dinerApi'
import { DinerProvider } from '../features/diner/DinerContext'

export function DinerWrapper({ api, children, path = '/mesa/tok' }: { api: DinerApi; children: ReactNode; path?: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mesa/:token/*" element={<DinerProvider token="tok" api={api}>{children}</DinerProvider>} />
      </Routes>
    </MemoryRouter>
  )
}

export function renderDiner(ui: ReactNode, api: DinerApi, path?: string) {
  return render(<DinerWrapper api={api} path={path}>{ui}</DinerWrapper>)
}
