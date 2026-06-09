import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '昵称 或 PUBG ID' })
  @IsString()
  input: string;
}
