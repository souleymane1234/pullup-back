import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ZodPipe } from '../../../common/http/zod.pipe.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  catalogKindParamDto,
  createCatalogDto,
  updateCatalogDto,
  type CatalogKindParamDto,
  type CreateCatalogDto,
  type UpdateCatalogDto,
} from '../dto/catalog.dto.js';
import { CatalogService } from '../service/catalog.service.js';

@Roles('admin')
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.adminList();
  }

  @Post()
  @HttpCode(200)
  create(
    @Body(new ZodPipe(createCatalogDto)) dto: CreateCatalogDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.catalog.create(dto, auth, req.ip);
  }

  @Put(':kind/:key')
  @HttpCode(200)
  update(
    @Param(new ZodPipe(catalogKindParamDto)) params: CatalogKindParamDto,
    @Body(new ZodPipe(updateCatalogDto)) dto: UpdateCatalogDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.catalog.update(params.kind, params.key, dto, auth, req.ip);
  }

  @Delete(':kind/:key')
  @HttpCode(200)
  hide(
    @Param(new ZodPipe(catalogKindParamDto)) params: CatalogKindParamDto,
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
  ) {
    return this.catalog.hide(params.kind, params.key, auth, req.ip);
  }
}
