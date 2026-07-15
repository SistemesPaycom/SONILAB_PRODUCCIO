import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TranscriptionSettingsDto {
  @IsOptional()
  @IsIn(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3', 'large-v3-turbo'])
  model?: string;

  @IsOptional()
  @IsIn(['faster-whisper', 'whisperx', 'purfview-xxl', 'script-align'])
  engine?: string;

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

  @IsOptional()
  @IsBoolean()
  timingFix?: boolean;

  @IsOptional()
  @IsString()
  scriptText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  minSpeakers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSpeakers?: number;

  /** Marge mínim entre subtítols consecutius (ms). Default: 160 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  minSubGapMs?: number;

  /** Si el pipeline ha d'aplicar el marge mínim automàticament. Default: true */
  @IsOptional()
  @IsBoolean()
  enforceMinSubGap?: boolean;

  /**
   * Frames per segon del projecte (perfil de temps: TV 25 / Cine 24). S'emmagatzema
   * dins project.settings via el flux de creació existent. Permet expressar els
   * llindars de temps en frames per projecte. Valors broadcast habituals.
   */
  @IsOptional()
  @IsNumber()
  @IsIn([23.976, 24, 25, 29.97, 30])
  fps?: number;
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

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
