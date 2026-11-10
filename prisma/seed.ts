// Seed a demo tenant for local development.
//   npm run db:seed
// Login: demo@acme.test / password123

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@acme.test";
  const passwordHash = await bcrypt.hash("password123", 11);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists; skipping.");
    return;
  }

  const user = await prisma.user.create({ data: { email, name: "Demo Admin", passwordHash } });
  const org = await prisma.organization.create({
    data: { name: "Acme Corp", slug: "acme-demo", auditCredits: 3 },
  });
  await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });

  await prisma.target.createMany({
    data: [
      { orgId: org.id, label: "Localhost test printer", value: "127.0.0.1", authorized: true, notes: "Use with scripts/mock-printer.ts" },
      { orgId: org.id, label: "HQ MFP range", value: "10.0.4.0/28", authorized: true },
      { orgId: org.id, label: "Unverified branch range", value: "192.168.50.0/24", authorized: false },
    ],
  });

  console.log("Seeded demo tenant:");
  console.log("  login: demo@acme.test / password123");
  console.log(`  org:   ${org.name} (3 audit credits)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
