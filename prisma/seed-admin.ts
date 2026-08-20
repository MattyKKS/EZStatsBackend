import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Creates the shared admin account and hands it every currently-unowned team,
// so logging in as admin shows the existing mock data.
//
//   npx ts-node prisma/seed-admin.ts
//
// Login: admin@admin.com / 1234ab

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = '1234ab';
const ADMIN_NAME = 'Admin';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, name: ADMIN_NAME },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, passwordHash },
  });

  const { count } = await prisma.team.updateMany({
    where: { ownerId: null },
    data: { ownerId: admin.id },
  });

  const total = await prisma.team.count({ where: { ownerId: admin.id } });

  // eslint-disable-next-line no-console
  console.log(
    `Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}\n` +
      `Assigned ${count} previously-unowned team(s); admin now owns ${total} team(s).`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
