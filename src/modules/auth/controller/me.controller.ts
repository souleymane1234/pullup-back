import { Body, Controller, Delete, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../domain/session.js';
import { deleteMeDto } from '../dto/auth.dto.js';
import { AuthService } from '../service/auth.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get('export')
  export(@CurrentUser() user: AuthContext) {
    return this.auth.exportMe(user);
  }

  @Delete()
  remove(
    @CurrentUser() user: AuthContext,
    @Body(new ZodPipe(deleteMeDto)) dto: { password: string },
    @Req() req: Request,
  ) {
    return this.auth.deleteMe(user, dto.password, req);
  }
}
