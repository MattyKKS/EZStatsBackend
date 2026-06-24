import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  jerseyNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  position?: string;
}
