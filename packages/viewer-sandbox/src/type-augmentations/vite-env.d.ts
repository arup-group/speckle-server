/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly FORCE_VUE_DEVTOOLS: boolean
  readonly VITE_POSTHOG_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
