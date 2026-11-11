import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  OptionalUser,
} from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  carouselQueryDto,
  contactRequestDto,
  listQueryDto,
  photoDto,
  vitrineDto,
  type ContactRequestDto,
  type ListQueryDto,
  type PhotoDto,
  type VitrineDto,
} from '../dto/influencers.dto.js';
import { InfluencersService } from '../service/influencers.service.js';

@Controller('influencers')
export class InfluencersController {
  constructor(private readonly influencers: InfluencersService) {}

  @Get()
  @Public()
  list(
    @Query(new ZodPipe(listQueryDto)) query: ListQueryDto,
    @OptionalUser() auth?: AuthContext,
  ) {
    return this.influencers.list(query, auth);
  }

  @Get('directory')
  @Public()
  directory(@OptionalUser() auth?: AuthContext) {
    return this.influencers.directory(auth);
  }

  @Get('carousel')
  @Public()
  carousel(
    @Query(new ZodPipe(carouselQueryDto)) query: { filter: string },
    @OptionalUser() auth?: AuthContext,
  ) {
    return this.influencers.carousel(query.filter, auth);
  }

  @Get(':handle')
  @Public()
  async profile(
    @Param('handle') handle: string,
    @OptionalUser() auth: AuthContext | undefined,
    @Res() res: Response,
  ) {
    const body = await this.influencers.profile(handle, auth);
    res.status(200).json(body);
  }

  @HttpCode(200)
  @Post(':id/visits')
  @Public()
  async visits(
    @Param('id') id: string,
    @OptionalUser() auth: AuthContext | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const body = await this.influencers.recordVisit(
      id,
      auth,
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? '',
    );
    res.status(200).json(body);
  }

  @HttpCode(200)
  @Post(':id/favorite')
  @Public()
  favorite(@Param('id') id: string, @OptionalUser() auth?: AuthContext) {
    return this.influencers.toggleFavorite(id, auth);
  }

  @HttpCode(200)
  @Post(':id/requests')
  @Public()
  requests(
    @Param('id') id: string,
    @Body(new ZodPipe(contactRequestDto)) dto: ContactRequestDto,
    @OptionalUser() auth: AuthContext | undefined,
    @Req() req: Request,
  ) {
    return this.influencers.sendRequest(id, dto, auth, req.ip ?? 'unknown');
  }

  @Put(':id/vitrine')
  vitrine(
    @Param('id') id: string,
    @Body(new ZodPipe(vitrineDto)) dto: VitrineDto,
    @CurrentUser() auth: AuthContext,
  ) {
    return this.influencers.updateVitrine(id, dto, auth);
  }

  @Put(':id/photo')
  photo(
    @Param('id') id: string,
    @Body(new ZodPipe(photoDto)) dto: PhotoDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.influencers.updatePhoto(id, dto, auth, req.ip);
  }
}
