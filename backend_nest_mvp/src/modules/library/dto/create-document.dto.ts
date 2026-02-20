import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  sourceType: string;

  @IsOptional()
  @IsObject()
  contentByLang?: Record<string, string>;
}
