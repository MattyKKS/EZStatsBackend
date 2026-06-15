import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTeamExists(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
  }

  async create(teamId: string, dto: CreateMatchDto) {
    await this.assertTeamExists(teamId);
    return this.prisma.match.create({
      data: {
        teamId,
        opponent: dto.opponent,
        teamColor: dto.teamColor,
        opponentColor: dto.opponentColor,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async findAllForTeam(teamId: string) {
    await this.assertTeamExists(teamId);
    return this.prisma.match.findMany({
      where: { teamId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.findOne(id);
    const { date, ...rest } = dto;
    return this.prisma.match.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.match.delete({ where: { id } });
  }
}
