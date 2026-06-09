import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateDanmakuDto {
  @IsString()
  content: string;

  @IsString()
  pageId: string;

  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsInt()
  @IsOptional()
  position?: number;
}
