import { PrismaClient } from '@prisma/client';

// Seeds ~20 famous footballers onto the team owned by the logged-in test user
// (matched by email) so player-ID mapping can be tested against a full roster.
// Also cleans up an earlier accidental seed on the admin's "Manchester United".
//
//   npx ts-node prisma/seed-manutd-players.ts
//
// Idempotent: skips any jersey number the team already has.

const OWNER_EMAIL_MATCH = 'kaungkhantsan'; // the user's login email
const CLEANUP_TEAM_NAME = 'Manchester United'; // admin team seeded by mistake

// Positions use the short codes the PositionBadge colors: GK / DEF / MID / FW.
const PLAYERS: { name: string; jerseyNumber: number; position: string }[] = [
  { name: 'Peter Schmeichel', jerseyNumber: 1, position: 'GK' },
  { name: 'Gary Neville', jerseyNumber: 2, position: 'DEF' },
  { name: 'Patrice Evra', jerseyNumber: 3, position: 'DEF' },
  { name: 'Sergio Ramos', jerseyNumber: 4, position: 'DEF' },
  { name: 'Rio Ferdinand', jerseyNumber: 5, position: 'DEF' },
  { name: 'Roy Keane', jerseyNumber: 6, position: 'MID' },
  { name: 'Cristiano Ronaldo', jerseyNumber: 7, position: 'FW' },
  { name: 'Paul Scholes', jerseyNumber: 8, position: 'MID' },
  { name: 'Andriy Shevchenko', jerseyNumber: 9, position: 'FW' },
  { name: 'Lionel Messi', jerseyNumber: 10, position: 'FW' },
  { name: 'Ryan Giggs', jerseyNumber: 11, position: 'MID' },
  { name: 'Diego Maradona', jerseyNumber: 12, position: 'FW' },
  { name: 'Johan Cruyff', jerseyNumber: 14, position: 'FW' },
  { name: 'Zinedine Zidane', jerseyNumber: 15, position: 'MID' },
  { name: 'Ronaldinho', jerseyNumber: 16, position: 'FW' },
  { name: 'Kylian Mbappe', jerseyNumber: 17, position: 'FW' },
  { name: 'Neymar Jr', jerseyNumber: 18, position: 'FW' },
  { name: 'Pele', jerseyNumber: 19, position: 'FW' },
  { name: 'Andres Iniesta', jerseyNumber: 20, position: 'MID' },
  { name: 'Xavi Hernandez', jerseyNumber: 21, position: 'MID' },
];

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.findFirst({
    where: { owner: { email: { contains: OWNER_EMAIL_MATCH } } },
    orderBy: { createdAt: 'asc' },
    include: { owner: { select: { email: true } } },
  });
  if (!team) {
    throw new Error(`No team owned by a user whose email contains "${OWNER_EMAIL_MATCH}".`);
  }

  const existing = await prisma.player.findMany({
    where: { teamId: team.id },
    select: { jerseyNumber: true },
  });
  const taken = new Set(existing.map((p) => p.jerseyNumber));
  const toCreate = PLAYERS.filter((p) => !taken.has(p.jerseyNumber));

  const { count } = await prisma.player.createMany({
    data: toCreate.map((p) => ({ ...p, teamId: team.id })),
    skipDuplicates: true,
  });
  const total = await prisma.player.count({ where: { teamId: team.id } });
  // eslint-disable-next-line no-console
  console.log(
    `Added ${count} player(s) to "${team.name}" (owner ${team.owner?.email}). Roster now: ${total}.`,
  );

  // Fix positions on already-seeded famous players so the badge colors show
  // (GK/DEF/MID/FW). Matched by name, so the user's own players are untouched.
  let fixed = 0;
  for (const p of PLAYERS) {
    const r = await prisma.player.updateMany({
      where: { teamId: team.id, name: p.name },
      data: { position: p.position },
    });
    fixed += r.count;
  }
  // eslint-disable-next-line no-console
  console.log(`Set short-code positions on ${fixed} player(s).`);

  // Undo the earlier accidental seed on the admin's team.
  const wrong = await prisma.team.findFirst({ where: { name: CLEANUP_TEAM_NAME } });
  if (wrong && wrong.id !== team.id) {
    const del = await prisma.player.deleteMany({
      where: { teamId: wrong.id, name: { in: PLAYERS.map((p) => p.name) } },
    });
    // eslint-disable-next-line no-console
    console.log(`Cleaned up ${del.count} mistakenly-seeded player(s) from "${wrong.name}".`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
