/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Target Midnight network id passed to the 1AM wallet `connect()` call. */
  readonly VITE_NETWORK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
