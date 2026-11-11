import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { withdrawDto, type WithdrawDto } from '../dto/billing.dto.js';
import { WalletService } from '../service/wallet.service.js';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Post('withdrawals')
  @Roles('influencer')
  @HttpCode(200)
  withdraw(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(withdrawDto)) dto: WithdrawDto,
  ) {
    return this.wallet.withdraw(auth, dto);
  }
}
