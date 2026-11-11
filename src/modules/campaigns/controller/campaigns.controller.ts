import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  OptionalUser,
} from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { RequireFlag } from '../../../common/decorators/require-flag.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  briefUploadDto,
  campaignMessageDto,
  campaignReviewDto,
  createCampaignDto,
  type BriefUploadDto,
  type CampaignMessageDto,
  type CampaignReviewDto,
  type CreateCampaignDto,
} from '../dto/campaigns.dto.js';
import { CampaignLifecycleService } from '../service/campaign-lifecycle.service.js';
import { CampaignsService } from '../service/campaigns.service.js';
import { UploadService } from '../service/upload.service.js';

@Controller()
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly uploads: UploadService,
    private readonly lifecycle: CampaignLifecycleService,
  ) {}

  @Get('booking/:handle')
  @Public()
  @RequireFlag('v2')
  async booking(
    @Param('handle') handle: string,
    @OptionalUser() auth: AuthContext | undefined,
    @Res() res: Response,
  ) {
    const body = await this.campaigns.booking(handle, auth);
    res.status(200).json(body);
  }

  @Post('uploads/brief')
  @Roles('brand')
  @RequireFlag('v2')
  @HttpCode(200)
  presign(
    @Body(new ZodPipe(briefUploadDto)) dto: BriefUploadDto,
    @CurrentUser() auth: AuthContext,
  ) {
    return this.uploads.presignBrief(auth, dto);
  }

  @Post('campaigns')
  @Roles('brand')
  @RequireFlag('v2')
  @HttpCode(200)
  create(
    @Body(new ZodPipe(createCampaignDto)) dto: CreateCampaignDto,
    @CurrentUser() auth: AuthContext,
  ) {
    return this.campaigns.create(auth, dto);
  }

  @Get('campaigns')
  list(@CurrentUser() auth: AuthContext) {
    return this.campaigns.list(auth);
  }

  @Get('campaigns/:id/payment')
  @Roles('brand', 'influencer', 'admin')
  @RequireFlag('v2')
  payment(@Param('id') id: string, @CurrentUser() auth: AuthContext) {
    return this.campaigns.paymentStatus(id, auth);
  }

  @Get('campaigns/:id')
  async one(
    @Param('id') id: string,
    @CurrentUser() auth: AuthContext,
    @Res() res: Response,
  ) {
    res.status(200).json(await this.campaigns.getOne(id, auth));
  }

  @Post('campaigns/:id/review')
  @Roles('brand')
  @HttpCode(200)
  review(
    @Param('id') id: string,
    @Body(new ZodPipe(campaignReviewDto)) dto: CampaignReviewDto,
    @CurrentUser() auth: AuthContext,
  ) {
    return this.lifecycle.review(id, auth, dto);
  }

  @Post('campaigns/:id/messages')
  @Roles('brand', 'influencer', 'admin')
  @HttpCode(200)
  message(
    @Param('id') id: string,
    @Body(new ZodPipe(campaignMessageDto)) dto: CampaignMessageDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.lifecycle.message(id, auth, dto.text, req.ip ?? 'unknown');
  }

  @Post('campaigns/:id/:action')
  @HttpCode(200)
  act(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() payload: Record<string, unknown>,
    @CurrentUser() auth: AuthContext,
  ) {
    return this.lifecycle.act(id, action, auth, payload ?? {});
  }

  @Post('admin/campaigns/auto-validate')
  @Roles('admin')
  @HttpCode(200)
  autoValidate() {
    return this.lifecycle.autoValidatePublished();
  }

  @Get('r/:ref')
  @Public()
  async track(
    @Param('ref') ref: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const url = await this.lifecycle.redirect(
      ref,
      req.ip ?? 'unknown',
      String(req.headers['user-agent'] ?? ''),
    );
    res.redirect(302, url);
  }
}
