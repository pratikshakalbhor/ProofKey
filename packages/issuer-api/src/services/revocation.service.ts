import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { credentials } from '../db/schema.js';
import {
  buildMerkleTree,
  getNonMembershipProof,
  normalizeLeaf,
  type MerkleNonMembershipProof,
  type MerkleTree,
} from '../lib/merkle.js';

/**
 * RevocationService — maintains the off-chain Merkle accumulator of revoked
 * credential commitments and produces non-membership witnesses.
 *
 * The authoritative in-circuit check remains the contract's revocation set;
 * this tree is the compact public anchor the issuer publishes on-chain.
 */

export function revokedLeaves(institutionId: string): string[] {
  return db
    .select({ payloadHash: credentials.payloadHash })
    .from(credentials)
    .where(and(eq(credentials.institutionId, institutionId), eq(credentials.status, 'revoked')))
    .all()
    .map((row) => row.payloadHash);
}

export function revocationTree(institutionId: string): MerkleTree {
  return buildMerkleTree(revokedLeaves(institutionId));
}

export interface RevocationStatus {
  revoked: boolean;
  root: string;
  revokedCount: number;
  /** Non-membership witness, present only when the credential is not revoked. */
  proof: MerkleNonMembershipProof | null;
}

export function getRevocationStatus(institutionId: string, payloadHash: string): RevocationStatus {
  const tree = revocationTree(institutionId);
  if (tree.leaves.includes(normalizeLeaf(payloadHash))) {
    return { revoked: true, root: tree.root, revokedCount: tree.leaves.length, proof: null };
  }
  return {
    revoked: false,
    root: tree.root,
    revokedCount: tree.leaves.length,
    proof: getNonMembershipProof(tree, payloadHash),
  };
}
