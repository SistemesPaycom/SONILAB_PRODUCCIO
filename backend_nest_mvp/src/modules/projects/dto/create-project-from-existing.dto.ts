import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectFromExistingDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  mediaDocumentId: string;

  // Flux A: SRT de plataforma (nou)
  @IsOptional()
  @IsString()
  sourceSrtDocumentId?: string;

  @IsOptional()
  @IsBoolean()
  deleteOriginalSrt?: boolean;  // default false — mai esborrar per omissió

  // Flux B: SRT extern (retrocompatible)
  @IsOptional()
  @IsString()
  srtText?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}