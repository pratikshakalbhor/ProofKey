/**
 * Browser access to the compiled contract artifacts (zkIR, prover and
 * verifier keys) that live in `@verishield/contracts/managed/...`.
 *
 * Vite resolves the `?url` asset imports at build time, so the URLs below are
 * real served assets, never synthetic paths. Artifacts are fetched on demand
 * (the prover keys are ~5 MB each) and cached for the session.
 */

const ARTIFACT_URLS = import.meta.glob<string>(
  '../../../../contracts/managed/credential-registry/**/*.{bzkir,prover,verifier}',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

export type CircuitArtifactKind = 'zkir' | 'prover' | 'verifier';

const KIND_EXT: Record<CircuitArtifactKind, string> = {
  zkir: 'bzkir',
  prover: 'prover',
  verifier: 'verifier',
};

const cache = new Map<string, Uint8Array>();

export function hasCircuitArtifacts(): boolean {
  return Object.keys(ARTIFACT_URLS).length > 0;
}

export function registeredArtifactUrls(): string[] {
  return Object.values(ARTIFACT_URLS)
    .filter((url, index, arr) => arr.indexOf(url) === index)
    .slice(0, 12);
}

/**
 * Resolves the built asset URL for a circuit artifact by matching the
 * artifact directory/extension conventions used by `compactc`.
 */
export function resolveCircuitArtifactUrl(
  circuitKeyLocation: string,
  kind: CircuitArtifactKind,
): string {
  const ext = KIND_EXT[kind];
  const suffix = `${circuitKeyLocation}.${ext}`;
  for (const key of Object.keys(ARTIFACT_URLS)) {
    if (key.endsWith(suffix)) return ARTIFACT_URLS[key];
  }
  throw new Error(
    `No ${ext} artifact found for circuit "${circuitKeyLocation}". ` +
      `Compile with \`npm run compile:contracts\` and confirm the artifact is present in ` +
      `packages/contracts/managed/credential-registry.`,
  );
}

/** Fetches a circuit artifact once and caches it for the session. */
export async function fetchCircuitArtifact(
  circuitKeyLocation: string,
  kind: CircuitArtifactKind,
): Promise<Uint8Array> {
  if (!window) {
    throw new Error('fetchCircuitArtifact is browser-only');
  }
  const cacheKey = `${kind}:${circuitKeyLocation}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const url = resolveCircuitArtifactUrl(circuitKeyLocation, kind);
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`artifacts HTTP ${response.status} for ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  cache.set(cacheKey, bytes);
  return bytes;
}