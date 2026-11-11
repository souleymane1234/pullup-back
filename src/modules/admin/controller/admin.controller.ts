import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  auditQueryDto,
  creditDto,
  ledgerQueryDto,
  reasonDto,
  scoresDto,
  suspendDto,
  withdrawalsQueryDto,
  type CreditDto,
  type ReasonDto,
  type ScoresDto,
  type SuspendDto,
} from '../dto/admin.dto.js';
import { AdminService } from '../service/admin.service.js';

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() auth: AuthContext) {
    return this.admin.dashboard(auth);
  }

  @Post('influencers/:id/verify')
  @HttpCode(200)
  verify(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.verify(id, auth, req.ip);
  }

  @Post('influencers/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id') id: string,
    @Body(new ZodPipe(reasonDto)) dto: ReasonDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.reject(id, auth, dto.reason, req.ip);
  }

  @Post('influencers/:id/suspend')
  @HttpCode(200)
  suspend(
    @Param('id') id: string,
    @Body(new ZodPipe(suspendDto)) dto: SuspendDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.suspend(id, auth, dto.reason, req.ip);
  }

  @Post('influencers/:id/certify')
  @HttpCode(200)
  certify(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.certify(id, auth, req.ip);
  }

  @Put('influencers/:id/scores')
  @HttpCode(200)
  scores(
    @Param('id') id: string,
    @Body(new ZodPipe(scoresDto)) dto: ScoresDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.updateScores(id, auth, dto, req.ip);
  }

  @Get('finance/summary')
  financeSummary() {
    return this.admin.financeSummary();
  }

  @Get('finance/ledger.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async ledgerCsv(
    @Query(new ZodPipe(ledgerQueryDto)) query: { from?: string; to?: string },
    @Res() res: Response,
  ) {
    const csv = await this.admin.ledgerCsv(query.from, query.to);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pullup-grand-livre.csv"',
    );
    res.status(200).send(csv);
  }

  @Get('withdrawals')
  withdrawals(
    @Query(new ZodPipe(withdrawalsQueryDto))
    query: {
      status?: 'pending' | 'sent' | 'failed';
    },
  ) {
    return this.admin.withdrawals(query.status);
  }

  @Post('withdrawals/:id/retry')
  @HttpCode(200)
  retryWithdrawal(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.retryWithdrawal(id, auth, req.ip);
  }

  @Get('audit')
  audit(
    @Query(new ZodPipe(auditQueryDto))
    query: {
      actor?: string;
      target?: string;
    },
  ) {
    return this.admin.auditLog(query);
  }

  @Post('brands/:id/credit')
  @HttpCode(200)
  credit(
    @Param('id') id: string,
    @Body(new ZodPipe(creditDto)) dto: CreditDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.admin.creditBrand(id, auth, dto, req.ip);
  }
}
