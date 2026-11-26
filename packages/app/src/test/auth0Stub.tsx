// Test-only Auth0 provider: an authenticated user with a fixed JWT-shaped token, so components that call useAuth0()
// (useApi, the page) run without an Auth0 tenant. The token has three segments because the API client validates
// that shape before it calls fetch.
import type { ReactNode } from 'react'
import { Auth0Context, initialContext } from '@auth0/auth0-react'
import type { Auth0ContextInterface } from '@auth0/auth0-react'

export const TEST_TOKEN = 'header.payload.signature'

export interface Auth0TestProviderProps {
  children: ReactNode
  /** Replaces parts of the stub, for example `loginWithRedirect: vi.fn()`. */
  overrides?: Partial<Auth0ContextInterface>
}

export function Auth0TestProvider({ children, overrides }: Auth0TestProviderProps) {
  const value: Auth0ContextInterface = {
    ...initialContext,
    isAuthenticated: true,
    isLoading: false,
    user: { sub: 'auth0|test-user', name: 'Test User', email: 'test@example.com' },
    getAccessTokenSilently: (async () => TEST_TOKEN) as Auth0ContextInterface['getAccessTokenSilently'],
    loginWithRedirect: async () => {},
    logout: async () => {},
    ...overrides,
  }
  return <Auth0Context.Provider value={value}>{children}</Auth0Context.Provider>
}
