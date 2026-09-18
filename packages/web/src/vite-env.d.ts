/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Target Midnight network id passed to the 1AM wallet `connect()` call. */
  readonly VITE_NETWORK?: string;
  /** On-chain anchor displayed by the demo ledger (cosmetic). */
  readonly VITE_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
