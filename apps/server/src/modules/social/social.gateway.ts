import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocialService } from './social.service';
import { CreateDanmakuDto } from './dto/danmaku.dto';
import { CreateCommentDto } from './dto/comment.dto';

@WebSocketGateway({ namespace: '/ws/social', cors: true })
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly socialService: SocialService) {}

  handleConnection(client: Socket) {
    console.log(`Social client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Social client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, pageId: string) {
    client.join(pageId);
    console.log(`Client ${client.id} joined room: ${pageId}`);
  }

  @SubscribeMessage('danmaku')
  async handleDanmaku(client: Socket, dto: CreateDanmakuDto) {
    const danmaku = await this.socialService.createDanmaku(dto);
    this.server.to(dto.pageId).emit('danmaku', danmaku);
  }

  @SubscribeMessage('comment')
  async handleComment(client: Socket, dto: CreateCommentDto) {
    const comment = await this.socialService.createComment(dto);
    this.server.to(dto.pageId).emit('comment', comment);
  }
}
