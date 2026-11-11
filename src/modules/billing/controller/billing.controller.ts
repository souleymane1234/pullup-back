import { Body, Controller, HttpCode, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  boostDto,
  planDto,
  type BoostDto,
  type PlanDto,
} from '../dto/billing.dto.js';
import { BillingService } from '../service/billing.service.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Put('plan')
  @Roles('brand')
  @HttpCode(200)
  setPlan(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(planDto)) dto: PlanDto,
  ) {
    return this.billing.setPlan(auth, dto);
  }

  @Post('boosts')
  @Roles('influencer')
  @HttpCode(200)
  purchaseBoost(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(boostDto)) dto: BoostDto,
  ) {
    return this.billing.purchaseBoost(auth, dto);
  }
}
