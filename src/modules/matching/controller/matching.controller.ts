import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalUser } from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { RequireFlag } from '../../../common/decorators/require-flag.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  matchingBriefDto,
  type MatchingBriefDto,
} from '../dto/matching.dto.js';
import { MatchingService } from '../service/matching.service.js';

@Controller()
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post('matching')
  @Public()
  @RequireFlag('v3')
  @HttpCode(200)
  match(
    @Body(new ZodPipe(matchingBriefDto)) dto: MatchingBriefDto,
    @OptionalUser() auth: AuthContext | undefined,
    @Req() req: Request,
  ) {
    return this.matching.match(dto, auth, req.ip ?? 'unknown');
  }
}
