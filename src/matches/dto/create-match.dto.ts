import {
  IsDateString,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMatchDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  opponent?: string;

  @IsOptional()
  @IsHexColor()
  teamColor?: string;

  @IsOptional()
  @IsHexColor()
  opponentColor?: string;
}
