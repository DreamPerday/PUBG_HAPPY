import { IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content: string;

  @IsString()
  pageId: string;

  @IsString()
  userId: string;
}
