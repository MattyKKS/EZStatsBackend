import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// A little sample data so the frontend has something to render immediately.
async function main() {
  const team = await prisma.team.create({
    data: {
      name: 'CMU Lions',
      description: 'Sample team seeded for local development',
      primaryColor: '#1E40AF',
      secondaryColor: '#FFFFFF',
      players: {
        create: [
          { name: 'Somchai P.', jerseyNumber: 10, position: 'Forward' },
          { name: 'Anucha K.', jerseyNumber: 7, position: 'Midfielder' },
          { name: 'Wirat S.', jerseyNumber: 1, position: 'Goalkeeper' },
        ],
      },
      matches: {
        create: [
          {
            opponent: 'KKU Tigers',
            date: new Date('2026-06-10'),
            teamColor: '#1E40AF',
            opponentColor: '#DC2626',
          },
        ],
      },
    },
    include: { players: true, matches: true },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded team "${team.name}" with ${team.players.length} players and ${team.matches.length} match(es).`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
