import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TeamsModule,
    PlayersModule,
    MatchesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
