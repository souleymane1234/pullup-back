import { Module } from '@nestjs/common';
import { AuditRepository } from './repository/audit.repository.js';
import { AuditService } from './service/audit.service.js';

@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
