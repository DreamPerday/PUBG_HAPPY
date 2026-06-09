import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '玩家昵称' })
  @IsString()
  nickname: string;

  @ApiProperty({ description: 'PUBG ID' })
  @IsString()
  pubgId: string;
}
