import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('登录认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.input);
  }

  @Post('register')
  @ApiOperation({ summary: '注册新用户' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.nickname, dto.pubgId);
  }
}
