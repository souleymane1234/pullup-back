import { Body, Controller, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { sendJsonNull } from '../../../common/http/json-null.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { PlatformService } from '../service/platform.service.js';

const onboardedDto = z.object({
  onboarded: z.literal(true),
});

@Controller('me')
export class PreferencesController {
  constructor(private readonly platform: PlatformService) {}

  @Put('preferences')
  async preferences(
    @CurrentUser() user: AuthContext,
    @Body(new ZodPipe(onboardedDto)) _dto: { onboarded: true },
    @Res() res: Response,
  ) {
    await this.platform.setOnboarded(user.userId);
    return sendJsonNull(res);
  }
}
