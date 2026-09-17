export const ROLES = ['admin', 'registrar', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Higher rank can do everything a lower rank can. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  registrar: 1,
  admin: 2,
};

export function hasRequiredRole(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** What a JWT session carries. */
export interface SessionClaims {
  sub: string;
  institutionId: string;
  role: Role;
  email: string;
}
