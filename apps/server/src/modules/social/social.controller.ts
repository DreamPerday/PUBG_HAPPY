import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { CreateCommentDto } from './dto/comment.dto';
import { CreateDanmakuDto } from './dto/danmaku.dto';

@ApiTags('社交互动')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('comments')
  @ApiOperation({ summary: '创建评论' })
  createComment(@Body() dto: CreateCommentDto) {
    return this.socialService.createComment(dto);
  }

  @Get('comments/:pageId')
  @ApiOperation({ summary: '获取评论列表' })
  getComments(
    @Param('pageId') pageId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.getComments(pageId, page ? +page : undefined, limit ? +limit : undefined);
  }

  @Post('danmaku')
  @ApiOperation({ summary: '发送弹幕' })
  createDanmaku(@Body() dto: CreateDanmakuDto) {
    return this.socialService.createDanmaku(dto);
  }

  @Get('danmaku/:pageId')
  @ApiOperation({ summary: '获取弹幕列表' })
  getDanmaku(
    @Param('pageId') pageId: string,
    @Query('since') since?: string,
  ) {
    return this.socialService.getDanmaku(pageId, since);
  }
}
