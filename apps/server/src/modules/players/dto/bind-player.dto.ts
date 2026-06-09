import { IsString, IsOptional } from 'class-validator';

export class BindPlayerDto {
  @IsString()
  pubgId: string;

  @IsString()
  nickname: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  platform?: string;
}
