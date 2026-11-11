import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { PlatformService } from '../service/platform.service.js';

@Public()
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  snapshot(@Req() req: Request) {
    const userId = req.session?.userId;
    const role = req.session?.role;
    const profileId = req.session?.profileId;
    const auth =
      userId && role && profileId ? { userId, role, profileId } : undefined;
    return this.platform.snapshot(auth);
  }
}
