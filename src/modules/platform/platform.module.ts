import { Global, Module } from '@nestjs/common';
import { NOTIFY } from '../../common/notify.js';
import { AuditModule } from '../audit/audit.module.js';
import { AdminFlagsController } from './controller/admin-flags.controller.js';
import { NotificationsController } from './controller/notifications.controller.js';
import { PlatformController } from './controller/platform.controller.js';
import { PreferencesController } from './controller/preferences.controller.js';
import { FlagsRepository } from './repository/flags.repository.js';
import { NotificationsRepository } from './repository/notifications.repository.js';
import { PreferencesRepository } from './repository/preferences.repository.js';
import { FlagsService } from './service/flags.service.js';
import { NotifyService } from './service/notify.service.js';
import { PlatformService } from './service/platform.service.js';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [
    PlatformController,
    PreferencesController,
    NotificationsController,
    AdminFlagsController,
  ],
  providers: [
    FlagsRepository,
    PreferencesRepository,
    NotificationsRepository,
    FlagsService,
    PlatformService,
    NotifyService,
    { provide: NOTIFY, useExisting: NotifyService },
  ],
  exports: [FlagsService, NotifyService, NOTIFY],
})
export class PlatformModule {}
