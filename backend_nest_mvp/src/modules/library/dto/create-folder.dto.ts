import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsIn(['files', 'media'])
  category?: 'files' | 'media';
}
