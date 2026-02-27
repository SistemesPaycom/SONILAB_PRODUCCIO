import { IsString, MinLength } from 'class-validator';

export class UpdateSrtDto {
  @IsString()
  @MinLength(1)
  srtText: string;
}