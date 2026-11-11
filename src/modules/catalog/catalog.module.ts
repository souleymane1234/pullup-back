import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AdminCatalogController } from './controller/admin-catalog.controller.js';
import { CatalogController } from './controller/catalog.controller.js';
import { CatalogRepository } from './repository/catalog.repository.js';
import { CatalogService } from './service/catalog.service.js';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogRepository, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
