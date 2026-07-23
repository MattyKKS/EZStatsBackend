import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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

  // --- AI worker output (report JSON, overlay videos, player crops) ---

  @Get('matches/:id/report')
  report(@Param('id') id: string) {
    return this.matches.getReport(id);
  }

  @Get('matches/:id/video/stats')
  async statsVideo(@Param('id') id: string, @Res() res: Response) {
    // res.sendFile handles Content-Type and HTTP range requests (seeking).
    res.sendFile(await this.matches.videoFile(id, 'stats'));
  }

  @Get('matches/:id/video/spatial')
  async spatialVideo(@Param('id') id: string, @Res() res: Response) {
    res.sendFile(await this.matches.videoFile(id, 'spatial'));
  }

  // Crop paths are nested (player_crops/track_XXXX/frame_XXXXXX.jpg), so the
  // trailing segment is captured with a wildcard and read from req.params.
  @Get('matches/:id/crops/*')
  async crop(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const cropPath = (req.params as Record<string, string>)['0'] ?? '';
    res.sendFile(await this.matches.cropFile(id, cropPath));
  }
}
