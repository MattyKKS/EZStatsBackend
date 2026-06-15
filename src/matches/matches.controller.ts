import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  // Match sessions live under a team.
  @Post('teams/:teamId/matches')
  create(@Param('teamId') teamId: string, @Body() dto: CreateMatchDto) {
    return this.matches.create(teamId, dto);
  }

  @Get('teams/:teamId/matches')
  findAllForTeam(@Param('teamId') teamId: string) {
    return this.matches.findAllForTeam(teamId);
  }

  @Get('matches/:id')
  findOne(@Param('id') id: string) {
    return this.matches.findOne(id);
  }

  @Patch('matches/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matches.update(id, dto);
  }

  @Delete('matches/:id')
  remove(@Param('id') id: string) {
    return this.matches.remove(id);
  }
}
