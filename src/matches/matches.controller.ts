import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { SetTrackMapsDto } from './dto/set-track-maps.dto';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

// 500 MB cap for match footage; adjust as needed.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  // Match sessions live under a team.
  @Post('teams/:teamId/matches')
  create(
    @Param('teamId') teamId: string,
    @Body() dto: CreateMatchDto,
    @CurrentUser() userId: string,
  ) {
    return this.matches.create(teamId, dto, userId);
  }

  @Get('teams/:teamId/matches')
  findAllForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() userId: string,
  ) {
    return this.matches.findAllForTeam(teamId, userId);
  }

  @Get('matches/:id')
  findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.matches.findOne(id, userId);
  }

  @Patch('matches/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
    @CurrentUser() userId: string,
  ) {
    return this.matches.update(id, dto, userId);
  }

  @Delete('matches/:id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.matches.remove(id, userId);
  }

  // --- Video upload (stored on the backend disk for now; processed locally) ---
  @Post('matches/:id/video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/videos',
        filename: (req, file, cb) => {
          const id = (req.params as { id: string }).id;
          cb(null, `match-${id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_VIDEO_BYTES },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) return cb(null, true);
        cb(new BadRequestException('Only video files are allowed'), false);
      },
    }),
  )
  uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() userId: string,
  ) {
    if (!file) throw new BadRequestException('No video file provided');
    // Transcodes to H.264 when needed so the browser can play it back.
    return this.matches.ingestVideo(id, file.filename, userId);
  }

  // --- Player ID mapping (Feature #6) ---

  @Get('matches/:id/track-maps')
  getTrackMaps(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.matches.getTrackMaps(id, userId);
  }

  @Post('matches/:id/track-maps')
  setTrackMaps(
    @Param('id') id: string,
    @Body() dto: SetTrackMapsDto,
    @CurrentUser() userId: string,
  ) {
    return this.matches.setTrackMaps(id, dto.maps, userId);
  }

  // --- AI worker output (public: loaded directly via <img>/<video>) ---

  @Public()
  @Get('matches/:id/report')
  report(@Param('id') id: string) {
    return this.matches.getReport(id);
  }

  @Public()
  @Get('matches/:id/video/stats')
  async statsVideo(@Param('id') id: string, @Res() res: Response) {
    // res.sendFile handles Content-Type and HTTP range requests (seeking).
    res.sendFile(await this.matches.videoFile(id, 'stats'));
  }

  @Public()
  @Get('matches/:id/video/spatial')
  async spatialVideo(@Param('id') id: string, @Res() res: Response) {
    res.sendFile(await this.matches.videoFile(id, 'spatial'));
  }

  // Crop paths are nested (player_crops/track_XXXX/frame_XXXXXX.jpg), so the
  // trailing segment is captured with a wildcard and read from req.params.
  @Public()
  @Get('matches/:id/crops/*')
  async crop(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const cropPath = (req.params as Record<string, string>)['0'] ?? '';
    res.sendFile(await this.matches.cropFile(id, cropPath));
  }
}
