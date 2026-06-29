import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TranscriptionSettingsDto } from './create-project.dto';

export class CreateProjectFromExistingDto {
  @IsString()
  name: string;

  @IsString()
  mediaDocumentId: string;

  @IsOptional()
  @IsString()
  sourceSrtDocumentId?: string;

  @IsOptional()
  @IsString()
  srtText?: string;

  @IsOptional()
  @IsBoolean()
  deleteOriginalSrt?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranscriptionSettingsDto)
  settings?: TranscriptionSettingsDto;

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
