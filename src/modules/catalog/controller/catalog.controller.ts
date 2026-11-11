import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CatalogService } from '../service/catalog.service.js';

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  snapshot() {
    return this.catalog.publicSnapshot();
  }
}
