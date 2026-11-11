import { Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { sendJsonNull } from '../../../common/http/json-null.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { PlatformService } from '../service/platform.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.platform.listNotifications(user);
  }

  @HttpCode(200)
  @Post('read')
  async read(@CurrentUser() user: AuthContext, @Res() res: Response) {
    await this.platform.markRead(user);
    return sendJsonNull(res);
  }
}
