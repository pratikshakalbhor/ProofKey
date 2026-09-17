import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { admins, institutions, type Admin } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { signSession } from '../lib/tokens.js';
import type { Role } from '../types/auth.js';
import { recordAudit } from './audit.service.js';

export interface AuthResult {
  token: string;
  admin: { id: string; email: string; role: Role; institutionId: string };
  institution: { id: string; name: string; type: string };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const admin = db.select().from(admins).where(eq(admins.email, email.toLowerCase())).get();
  if (!admin) throw AppError.unauthorized('Invalid email or password');

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) throw AppError.unauthorized('Invalid email or password');

  const institution = db
    .select()
    .from(institutions)
    .where(eq(institutions.id, admin.institutionId))
    .get();
  if (!institution) throw AppError.internal('Admin is not attached to an institution');

  const role = admin.role as Role;
  const token = signSession({
    sub: admin.id,
    institutionId: admin.institutionId,
    role,
    email: admin.email,
  });

  recordAudit(admin.id, 'auth.login', admin.id, { email: admin.email });

  return {
    token,
    admin: { id: admin.id, email: admin.email, role, institutionId: admin.institutionId },
    institution: { id: institution.id, name: institution.name, type: institution.type },
  };
}

export function getAdminById(id: string): Admin | undefined {
  return db.select().from(admins).where(eq(admins.id, id)).get();
}

export interface CreateAdminInput {
  institutionId: string;
  email: string;
  password: string;
  role: Role;
}

export async function createAdmin(input: CreateAdminInput): Promise<Admin> {
  const existing = db.select().from(admins).where(eq(admins.email, input.email.toLowerCase())).get();
  if (existing) throw AppError.conflict('An admin with that email already exists');

  const row: Admin = {
    id: `adm_${nanoid(16)}`,
    institutionId: input.institutionId,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: input.role,
    createdAt: new Date(),
  };
  db.insert(admins).values(row).run();
  return row;
}
