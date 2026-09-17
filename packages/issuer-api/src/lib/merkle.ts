import { createHash } from 'node:crypto';

/**
 * Off-chain revocation accumulator.
 *
 * The authoritative in-circuit revocation check is the contract's
 * `revokedCredentials` Set. This Merkle tree exists so the issuer can publish a
 * compact public audit anchor (`updateRevocationRoot`) and hand holders a
 * non-membership witness. Hashing here uses SHA-256 with domain separation
 * (0x00 leaf, 0x01 node) — it is an operational artifact, not a ZK primitive.
 *
 * Leaves are sorted, so non-membership is proven with the two adjacent leaves
 * that bracket the absent value.
 */

export interface MerkleProofStep {
  sibling: string;
  position: 'left' | 'right';
}

export interface MerkleMembershipProof {
  leaf: string;
  root: string;
  path: MerkleProofStep[];
}

export interface MerkleNonMembershipProof {
  root: string;
  target: string;
  /** Largest revoked id less than `target`, or null if none. */
  left: MerkleMembershipProof | null;
  /** Smallest revoked id greater than `target`, or null if none. */
  right: MerkleMembershipProof | null;
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  layers: string[][];
}

export const EMPTY_MERKLE_ROOT = '00'.repeat(32);

export function normalizeLeaf(value: string): string {
  return value.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

function hashLeaf(hex: string): string {
  return createHash('sha256')
    .update(Buffer.concat([Buffer.from([0x00]), Buffer.from(hex, 'hex')]))
    .digest('hex');
}

function hashNode(left: string, right: string): string {
  return createHash('sha256')
    .update(Buffer.concat([Buffer.from([0x01]), Buffer.from(left, 'hex'), Buffer.from(right, 'hex')]))
    .digest('hex');
}

export function buildMerkleTree(input: string[]): MerkleTree {
  const leaves = [...new Set(input.map(normalizeLeaf))].sort();
  if (leaves.length === 0) {
    return { root: EMPTY_MERKLE_ROOT, leaves, layers: [[]] };
  }

  let layer = leaves.map(hashLeaf);
  const layers: string[][] = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) next.push(hashNode(layer[i], layer[i + 1]));
      else next.push(layer[i]); // promote an odd trailing node
    }
    layers.push(next);
    layer = next;
  }
  return { root: layer[0], leaves, layers };
}

export function getMembershipProof(tree: MerkleTree, value: string): MerkleMembershipProof | null {
  const leaf = normalizeLeaf(value);
  const index = tree.leaves.indexOf(leaf);
  if (index < 0) return null;

  const path: MerkleProofStep[] = [];
  let i = index;
  for (let level = 0; level < tree.layers.length - 1; level += 1) {
    const layer = tree.layers[level];
    if (i % 2 === 0) {
      if (i + 1 < layer.length) path.push({ sibling: layer[i + 1], position: 'right' });
    } else {
      path.push({ sibling: layer[i - 1], position: 'left' });
    }
    i = Math.floor(i / 2);
  }
  return { leaf, root: tree.root, path };
}

export function verifyMembershipProof(proof: MerkleMembershipProof, root = proof.root): boolean {
  let hash = hashLeaf(proof.leaf);
  for (const step of proof.path) {
    hash = step.position === 'right' ? hashNode(hash, step.sibling) : hashNode(step.sibling, hash);
  }
  return hash === root;
}

/**
 * Proves `target` is NOT revoked: it must fall strictly between two revoked
 * neighbours (both membership-proven), or outside the min/max boundary.
 */
export function getNonMembershipProof(
  tree: MerkleTree,
  value: string,
): MerkleNonMembershipProof {
  const target = normalizeLeaf(value);
  if (tree.leaves.includes(target)) {
    throw new Error('Value is revoked; non-membership cannot be proven');
  }

  // First index whose leaf is >= target.
  let lo = 0;
  let hi = tree.leaves.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tree.leaves[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const leftLeaf = lo > 0 ? tree.leaves[lo - 1] : null;
  const rightLeaf = lo < tree.leaves.length ? tree.leaves[lo] : null;

  return {
    root: tree.root,
    target,
    left: leftLeaf ? getMembershipProof(tree, leftLeaf) : null,
    right: rightLeaf ? getMembershipProof(tree, rightLeaf) : null,
  };
}

export function verifyNonMembershipProof(proof: MerkleNonMembershipProof): boolean {
  const { target } = proof;
  if (proof.left && !verifyMembershipProof(proof.left, proof.root)) return false;
  if (proof.right && !verifyMembershipProof(proof.right, proof.root)) return false;

  const leftOk = proof.left === null || proof.left.leaf < target;
  const rightOk = proof.right === null || target < proof.right.leaf;
  if (!leftOk || !rightOk) return false;
  // A gap between adjacent sorted leaves proves absence.
  return proof.left !== null || proof.right !== null;
}
