import { Module } from '@nestjs/common';
import { ReferencesRepository } from './repository/references.repository.js';
import { ReferencesService } from './service/references.service.js';

@Module({
  providers: [ReferencesRepository, ReferencesService],
  exports: [ReferencesService],
})
export class ReferencesModule {}
