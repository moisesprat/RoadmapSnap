/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string
  readonly VITE_AUTH0_AUDIENCE: string
  readonly VITE_AUTH0_REDIRECT_URI?: string
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The app's package.json version, defined at build time in vite.config.ts. */
declare const __APP_VERSION__: string
/** The build date (YYYY-MM-DD), defined at build time in vite.config.ts. */
declare const __BUILD_DATE__: string
