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
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  // Roster lives under a team.
  @Post('teams/:teamId/players')
  create(
    @Param('teamId') teamId: string,
    @Body() dto: CreatePlayerDto,
    @CurrentUser() userId: string,
  ) {
    return this.players.create(teamId, dto, userId);
  }

  @Get('teams/:teamId/players')
  findAllForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() userId: string,
  ) {
    return this.players.findAllForTeam(teamId, userId);
  }

  // Individual players addressed directly.
  @Get('players/:id')
  findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.players.findOne(id, userId);
  }

  @Patch('players/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlayerDto,
    @CurrentUser() userId: string,
  ) {
    return this.players.update(id, dto, userId);
  }

  @Delete('players/:id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.players.remove(id, userId);
  }
}
