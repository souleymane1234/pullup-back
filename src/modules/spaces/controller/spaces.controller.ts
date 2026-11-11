import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { SpacesService } from '../service/spaces.service.js';

const brandProfileDto = z.object({
  name: z.string(),
  contact: z.string(),
  sector: z.string(),
});

@Controller('me')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get('brand-space')
  @Roles('brand')
  brandSpace(@CurrentUser() auth: AuthContext) {
    return this.spaces.brandSpace(auth);
  }

  @Get('influencer-space')
  @Roles('influencer')
  influencerSpace(@CurrentUser() auth: AuthContext) {
    return this.spaces.influencerSpace(auth);
  }

  @Put('brand')
  @Roles('brand')
  @HttpCode(200)
  updateBrand(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(brandProfileDto))
    dto: { name: string; contact: string; sector: string },
  ) {
    return this.spaces.updateBrand(auth, dto);
  }

  @Get('campaigns.csv')
  @Roles('brand')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@CurrentUser() auth: AuthContext, @Res() res: Response) {
    const csv = await this.spaces.exportCampaignsCsv(auth);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pullup-campagnes.csv"',
    );
    res.status(200).send(csv);
  }
}
