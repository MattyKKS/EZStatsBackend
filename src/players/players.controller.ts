import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Controller()
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  // Roster lives under a team.
  @Post('teams/:teamId/players')
  create(@Param('teamId') teamId: string, @Body() dto: CreatePlayerDto) {
    return this.players.create(teamId, dto);
  }

  @Get('teams/:teamId/players')
  findAllForTeam(@Param('teamId') teamId: string) {
    return this.players.findAllForTeam(teamId);
  }

  // Individual players addressed directly.
  @Get('players/:id')
  findOne(@Param('id') id: string) {
    return this.players.findOne(id);
  }

  @Patch('players/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.players.update(id, dto);
  }

  @Delete('players/:id')
  remove(@Param('id') id: string) {
    return this.players.remove(id);
  }
}
