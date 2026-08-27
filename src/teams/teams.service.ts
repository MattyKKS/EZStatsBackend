import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTeamDto, userId: string) {
    // The authenticated user always owns what they create — ignore any
    // client-supplied ownerId.
    const { ownerId: _ignored, ...rest } = dto;
    return this.prisma.team.create({ data: { ...rest, ownerId: userId } });
  }

  findAll(userId: string) {
    return this.prisma.team.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true, matches: true } } },
    });
  }

  async findOne(id: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        matches: { orderBy: { date: 'desc' } },
      },
    });
    // Same 404 whether it doesn't exist or isn't yours — don't leak existence.
    if (!team || team.ownerId !== userId) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, userId: string) {
    await this.findOne(id, userId);
    const { ownerId: _ignored, ...rest } = dto;
    return this.prisma.team.update({ where: { id }, data: rest });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    // players & matches cascade-delete (see schema relations).
    return this.prisma.team.delete({ where: { id } });
  }

  // --- Team logo (uploaded file on disk) ---

  /** Point the team at a freshly uploaded logo file, deleting any previous one. */
  async setLogo(id: string, filename: string, userId: string) {
    const team = await this.findOne(id, userId);
    this.deleteLogoFile(team.logoUrl);
    return this.prisma.team.update({
      where: { id },
      data: { logoUrl: `/uploads/${filename}` },
    });
  }

  /** Remove the team's logo (clears the field and deletes the file). */
  async clearLogo(id: string, userId: string) {
    const team = await this.findOne(id, userId);
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
