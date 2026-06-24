import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MatchStatus } from '@prisma/client';
import { CreateMatchDto } from './create-match.dto';

// Update also allows moving the analysis lifecycle forward and recording the
// worker run — used by Features #3/#4 later, but harmless now.
export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsString()
  videoPath?: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  reportPath?: string;
}
