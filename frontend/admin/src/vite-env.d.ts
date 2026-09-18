/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNLEASH_URL?: string;
  readonly VITE_UNLEASH_CLIENT_KEY?: string;
  readonly VITE_OPENPANEL_ENABLED?: string;
  readonly VITE_OPENPANEL_API_URL?: string;
  readonly VITE_OPENPANEL_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
