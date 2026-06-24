import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({ data: dto });
  }

  findAll() {
    return this.prisma.team.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true, matches: true } } },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        matches: { orderBy: { date: 'desc' } },
      },
    });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findOne(id);
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // players & matches cascade-delete (see schema relations).
    return this.prisma.team.delete({ where: { id } });
  }
}
