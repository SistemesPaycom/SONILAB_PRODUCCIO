import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectFromExistingDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  mediaDocumentId: string;

  @IsString()
  @MinLength(1)
  srtText: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}