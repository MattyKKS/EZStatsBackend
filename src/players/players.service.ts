import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  // A team must exist AND belong to the current user, else 404 (no leak).
  private async assertTeamOwned(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.ownerId !== userId) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
  }

  async create(teamId: string, dto: CreatePlayerDto, userId: string) {
    await this.assertTeamOwned(teamId, userId);
    try {
      return await this.prisma.player.create({ data: { ...dto, teamId } });
    } catch (e) {
      throw this.translateError(e);
    }
  }

  async findAllForTeam(teamId: string, userId: string) {
    await this.assertTeamOwned(teamId, userId);
    return this.prisma.player.findMany({
      where: { teamId },
      orderBy: { jerseyNumber: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);
    await this.assertTeamOwned(player.teamId, userId);
    return player;
  }

  async update(id: string, dto: UpdatePlayerDto, userId: string) {
    await this.findOne(id, userId);
    try {
      return await this.prisma.player.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.translateError(e);
    }
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.player.delete({ where: { id } });
  }

  // Surface the unique [teamId, jerseyNumber] constraint as a clean 409.
  private translateError(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(
        'A player with that jersey number already exists on this team',
      );
    }
    return e;
  }
}
