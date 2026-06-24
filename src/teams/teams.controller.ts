import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  MaxFileSizeValidator,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

// 2 MB cap; logos are small.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE = /^image\/(png|jpe?g|webp|svg\+xml)$/;

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Get()
  findAll() {
    return this.teams.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teams.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }

  // --- Logo upload ---
  // multipart/form-data with a single "file" field (the image).
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const id = (req.params as { id: string }).id;
          cb(null, `team-${id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_LOGO_BYTES },
      // Reject non-images BEFORE anything is written to disk (avoids orphan files).
      fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE.test(file.mimetype)) return cb(null, true);
        cb(
          new BadRequestException(
            'Only image files are allowed (png, jpg, webp, svg)',
          ),
          false,
        );
      },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    // Size is enforced by multer's limit above; this is a clear-message backstop.
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_LOGO_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.teams.setLogo(id, file.filename);
  }

  @Delete(':id/logo')
  removeLogo(@Param('id') id: string) {
    return this.teams.clearLogo(id);
  }
}
