/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MIXPANEL_TOKEN?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
