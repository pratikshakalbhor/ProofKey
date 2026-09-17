export const NETWORKS = ['undeployed', 'preview', 'preprod', 'mainnet'] as const;

export const NETWORK_LABELS: Record<(typeof NETWORKS)[number], string> = {
  undeployed: 'Local Devnet',
  preview: 'Preview',
  preprod: 'Preprod',
  mainnet: 'Mainnet',
};

export const ISSUER_TYPES = ['university', 'government', 'regulator'] as const;

export const DEGREE_LEVELS = ['bachelor', 'master', 'phd', 'diploma'] as const;

export const SCHEMA_TYPES = {
  degree: 1,
  license: 2,
  id: 3,
} as const;

export const CLAIM_LABELS = {
  degree: 'Has a degree',
  license: 'Holds a license',
  id: 'Over 18',
} as const;

export const ROLE_LABELS = {
  issuer: 'Issuer',
  holder: 'Holder',
  verifier: 'Verifier',
} as const;