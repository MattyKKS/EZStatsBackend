import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
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

  // --- Team logo (uploaded file on disk) ---

  /** Point the team at a freshly uploaded logo file, deleting any previous one. */
  async setLogo(id: string, filename: string) {
    const team = await this.findOne(id);
    this.deleteLogoFile(team.logoUrl);
    return this.prisma.team.update({
      where: { id },
      data: { logoUrl: `/uploads/${filename}` },
    });
  }

  /** Remove the team's logo (clears the field and deletes the file). */
  async clearLogo(id: string) {
    const team = await this.findOne(id);
    this.deleteLogoFile(team.logoUrl);
    return this.prisma.team.update({ where: { id }, data: { logoUrl: null } });
  }

  // Best-effort delete of the backing file so old logos don't pile up.
  private deleteLogoFile(logoUrl: string | null) {
    if (!logoUrl) return;
    const file = join(process.cwd(), logoUrl.replace(/^\/uploads\//, 'uploads/'));
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      // ignore — a missing/locked file should not block the request
    }
  }
}
