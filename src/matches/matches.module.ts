import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { AiWorkerService } from './ai-worker.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, AiWorkerService],
})
export class MatchesModule {}
