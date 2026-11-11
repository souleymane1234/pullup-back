import { Global, Module } from '@nestjs/common';
import { MAIL, LogMail } from '../infrastructure/mail/mail.port.js';
import { PHOTO } from '../infrastructure/photo/photo.port.js';
import { PhotoService } from '../infrastructure/photo/photo.service.js';
import { EnvService } from './env.service.js';

@Global()
@Module({
  providers: [
    EnvService,
    { provide: MAIL, useClass: LogMail },
    { provide: PHOTO, useClass: PhotoService },
  ],
  exports: [EnvService, MAIL, PHOTO],
})
export class CoreModule {}
