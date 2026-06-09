import { Controller, Post, Get, Body, Param, Delete, Put, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SyncService } from '../sync/sync.service';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pubg123';

@ApiTags('管理员')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly syncService: SyncService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录验证' })
  login(@Body() body: { password: string }) {
    if (body.password !== ADMIN_PASSWORD) {
      throw new HttpException('密码错误', HttpStatus.UNAUTHORIZED);
    }
    return { token: Buffer.from('admin:' + Date.now()).toString('base64') };
  }

  @Get('users')
  @ApiOperation({ summary: '获取所有注册用户' })
  getUsers() {
    return this.adminService.getUsers();
  }

  @Get('stats')
  @ApiOperation({ summary: '获取服务器状态' })
  getStats() {
    return this.adminService.getServerStats();
  }

  @Post('sync/:pubgId')
  @ApiOperation({ summary: '强制同步用户数据' })
  async syncUser(@Param('pubgId') pubgId: string) {
    this.logger.log(`管理员触发用户 ${pubgId} 数据同步`);
    try {
      await this.syncService.syncPlayerMatches(pubgId);
      await this.adminService.recalcUserStats(pubgId);
      return { message: `用户 ${pubgId} 同步完成，请刷新页面查看` };
    } catch (err: any) {
      const msg = err.response?.status === 404
        ? `PUBG 中未找到玩家 "${pubgId}"，请确认：1) 昵称拼写是否正确  2) 所属平台是否为 Steam  3) 是否已有比赛记录`
        : `同步失败: ${err.message}`;
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('user/:pubgId')
  @ApiOperation({ summary: '删除用户' })
  deleteUser(@Param('pubgId') pubgId: string) {
    return this.adminService.deleteUser(pubgId);
  }

  @Put('user/:pubgId')
  @ApiOperation({ summary: '修改用户信息' })
  updateUser(
    @Param('pubgId') pubgId: string,
    @Body() body: { nickname?: string; newPubgId?: string },
  ) {
    return this.adminService.updateUser(pubgId, body);
  }

  @Get('config')
  @ApiOperation({ summary: '获取所有系统配置' })
  getAllConfigs() {
    return this.adminService.getAllConfigs();
  }

  @Post('config')
  @ApiOperation({ summary: '保存系统配置' })
  setConfig(@Body() body: { key: string; value: string }) {
    return this.adminService.setConfig(body.key, body.value);
  }
}
