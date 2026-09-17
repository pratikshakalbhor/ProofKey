import { db } from './db/client.js';
import { migrate } from './db/migrate.js';
import { admins, credentials, institutions, schemas, students } from './db/schema.js';
import { createAdmin } from './services/auth.service.js';
import { createSchema } from './services/credential-schema.service.js';
import { issueCredential } from './services/credential.service.js';
import {
  anchorIssuerOnChain,
  createInstitution,
  getPrimaryInstitution,
} from './services/institution.service.js';
import { createStudent } from './services/student.service.js';
import type { Student } from './db/schema.js';

/**
 * Seed script — `pnpm seed`.
 *
 * Creates one university (Savitribai Phule Pune University), three admins, two
 * credential schemas, 40 students and 15 issued credentials. Deterministic;
 * re-running is a no-op unless `SEED_RESET=1`.
 */

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Muhammad', 'Sai',
  'Arnav', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav',
  'Aadya', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra', 'Anika', 'Navya',
  'Kiara', 'Riya', 'Ishita', 'Tanvi', 'Shreya', 'Pooja', 'Neha', 'Sneha',
  'Priya', 'Kavya', 'Meera', 'Nisha', 'Ritika', 'Sanika', 'Devika', 'Ira',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Nair',
  'Iyer', 'Menon', 'Joshi', 'Desai', 'Kulkarni', 'Deshpande', 'Chavan', 'Patil',
  'Jadhav', 'Shinde', 'Rao', 'Ghosh',
];

const PROGRAMS = [
  { name: 'B.Tech Computer Engineering', code: 'CS' },
  { name: 'B.Tech Electronics & Telecom', code: 'ET' },
  { name: 'MBA', code: 'MBA' },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildStudents(): Array<Parameters<typeof createStudent>[1]> {
  return Array.from({ length: 40 }, (_, i) => {
    const program = PROGRAMS[i % PROGRAMS.length];
    const rollNumber = `SPPU${2021 + (i % 4)}${program.code}${String(i + 1).padStart(3, '0')}`;
    const month = String((i % 9) + 1).padStart(2, '0');
    const day = String((i % 27) + 2).padStart(2, '0');
    return {
      rollNumber,
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`,
      email: `${rollNumber.toLowerCase()}@students.sppu.ac.in`,
      dob: `2001-${month}-${day}`,
      program: program.name,
      graduationYear: i % 2 === 0 ? 2025 : 2026,
      cgpa: round2(6.2 + ((i * 37) % 35) / 10),
      status: i < 4 ? ('graduated' as const) : ('active' as const),
    };
  });
}

async function main(): Promise<void> {
  migrate();

  if (getPrimaryInstitution() && process.env.SEED_RESET !== '1') {
    console.log('[seed] data already present — skipping. Set SEED_RESET=1 to wipe and reseed.');
    return;
  }

  if (process.env.SEED_RESET === '1') {
    db.delete(credentials).run();
    db.delete(students).run();
    db.delete(schemas).run();
    db.delete(admins).run();
    db.delete(institutions).run();
    console.log('[seed] cleared existing rows');
  }

  const institution = await createInstitution({
    name: 'Savitribai Phule Pune University',
    type: 'university',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/2/2e/SPPU_Logo.png',
  });
  console.log(`[seed] institution: ${institution.name} (${institution.id})`);

  const admin = await createAdmin({
    institutionId: institution.id,
    email: 'admin@sppu.ac.in',
    password: 'Admin@12345',
    role: 'admin',
  });
  await createAdmin({
    institutionId: institution.id,
    email: 'registrar@sppu.ac.in',
    password: 'Registrar@12345',
    role: 'registrar',
  });
  await createAdmin({
    institutionId: institution.id,
    email: 'viewer@sppu.ac.in',
    password: 'Viewer@12345',
    role: 'viewer',
  });
  console.log('[seed] admins: admin@ / registrar@ / viewer@ sppu.ac.in');

  const anchor = await anchorIssuerOnChain(institution, admin.id, true);
  console.log(`[seed] issuer anchored on-chain${anchor.issuerId ? `: ${anchor.issuerId}` : ''}`);

  const degreeSchema = createSchema(
    {
      name: 'DegreeCertificate',
      version: 'v1',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'degree', type: 'string', required: true },
        { name: 'dateOfBirth', type: 'date', required: true },
        { name: 'cgpa', type: 'number', required: true },
        { name: 'graduationYear', type: 'number', required: true },
      ],
    },
    admin.id,
  );
  const licenseSchema = createSchema(
    {
      name: 'ProfessionalLicense',
      version: 'v1',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'licenseType', type: 'string', required: true },
        { name: 'licenseNumber', type: 'string', required: true },
        { name: 'validUntil', type: 'date', required: true },
      ],
    },
    admin.id,
  );
  console.log(`[seed] schemas: ${degreeSchema.name}@${degreeSchema.version}, ${licenseSchema.name}@${licenseSchema.version}`);

  const created: Student[] = [];
  for (const input of buildStudents()) {
    created.push(createStudent(institution.id, input, admin.id));
  }
  console.log(`[seed] students: ${created.length}`);

  let issued = 0;
  for (let i = 0; i < 15; i += 1) {
    const student = created[i];
    const schemaRow = i < 10 ? degreeSchema : licenseSchema;
    await issueCredential(institution, { studentId: student.id, schemaId: schemaRow.id }, admin.id);
    issued += 1;
  }
  console.log(`[seed] credentials issued: ${issued}`);

  console.log('\n[seed] done.');
  console.log('  login: admin@sppu.ac.in / Admin@12345 (admin)');
  console.log('         registrar@sppu.ac.in / Registrar@12345 (registrar)');
  console.log('         viewer@sppu.ac.in / Viewer@12345 (viewer)');
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
