import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TranscriptionSettingsDto {
  @IsOptional()
  @IsIn(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3', 'large-v3-turbo'])
  model?: string;

  @IsOptional()
  @IsIn(['VE', 'VCAT'])
  profile?: string;

  @IsOptional()
  @IsString()
  language?: string; // "es" o "" para autodetect

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  batchSize?: number;

  @IsOptional()
  @IsIn(['cpu', 'cuda'])
  device?: string;

  @IsOptional()
  @IsBoolean()
  diarization?: boolean;

  @IsOptional()
  @IsBoolean()
  offline?: boolean;
}

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  mediaDocumentId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranscriptionSettingsDto)
  settings?: TranscriptionSettingsDto;
}
