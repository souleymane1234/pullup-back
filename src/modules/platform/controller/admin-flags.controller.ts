import { Body, Controller, HttpCode, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { FlagsService } from '../service/flags.service.js';

const valueDto = z.object({
  value: z.boolean(),
});

@Roles('admin')
@Controller('admin/flags')
export class AdminFlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Put(':key')
  @HttpCode(200)
  set(
    @Param('key') key: string,
    @Body(new ZodPipe(valueDto)) dto: { value: boolean },
    @CurrentUser() user: AuthContext,
  ) {
    return this.flags.set(key, dto.value, user.userId);
  }
}
