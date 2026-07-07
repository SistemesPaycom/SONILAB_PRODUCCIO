import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsObject()
  contentByLang?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  /** SRT editor: ID del document de media vinculat manualment per l'usuari. Null per desvincular. */
  @ValidateIf((o) => o.linkedMediaId !== null)
  @IsOptional()
  @IsString()
  linkedMediaId?: string | null;
}
