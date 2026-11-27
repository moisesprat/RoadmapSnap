// Parity harness only, never part of the default build: renders the real SaaS page (DashboardPage with its header,
// TanStack Query hooks and useTheme) with a stub Auth0 context, so the Playwright suite can compare the whole page with
// Lite pixel by pixel while the API routes are stubbed by the harness. Built only with `vite build --mode parity`
// (parity.html into dist-parity). The API still requires real JWTs; the stub token never leaves the harness.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Context, initialContext } from '@auth0/auth0-react'
import type { Auth0ContextInterface } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '../pages/DashboardPage'
import '@roadmapsnap/tokens/css'
import '@roadmapsnap/tokens/components.css'
import '@roadmapsnap/tokens/lite.css'
import '../index.css'

document.documentElement.dataset.parity = '__ROADMAPSNAP_PARITY__'

// The API client only checks that the token has three segments before it calls fetch.
const STUB_TOKEN = 'parity.stub.token'

const auth0Stub: Auth0ContextInterface = {
  ...initialContext,
  isAuthenticated: true,
  isLoading: false,
  user: { sub: 'parity|user', name: 'Parity User', email: 'parity@example.test' },
  getAccessTokenSilently: (async () => STUB_TOKEN) as Auth0ContextInterface['getAccessTokenSilently'],
  loginWithRedirect: async () => {},
  logout: async () => {},
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Context.Provider value={auth0Stub}>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </Auth0Context.Provider>
  </React.StrictMode>,
)
