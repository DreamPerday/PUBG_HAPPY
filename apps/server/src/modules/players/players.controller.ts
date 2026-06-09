import { Controller, Get, Post, Body, Param, Delete, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { BindPlayerDto } from './dto/bind-player.dto';

@ApiTags('玩家管理')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: '获取玩家列表' })
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取玩家详情' })
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  @Post('bind')
  @ApiOperation({ summary: '绑定PUBG玩家' })
  bind(@Body() dto: BindPlayerDto) {
    return this.playersService.bind(dto);
  }

  @Patch(':id/avatar')
  @ApiOperation({ summary: '更新玩家头像' })
  updateAvatar(@Param('id', ParseUUIDPipe) id: string, @Body() body: { avatar: string }) {
    return this.playersService.updateAvatar(id, body.avatar);
  }

  @Delete(':id')
  @ApiOperation({ summary: '解绑玩家' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.remove(id);
  }
}
