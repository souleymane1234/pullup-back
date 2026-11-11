import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthController } from './controller/auth.controller.js';
import { MeController } from './controller/me.controller.js';
import { BrandsRepository } from './repository/brands.repository.js';
import { InfluencersRepository } from './repository/influencers.repository.js';
import { PasswordResetsRepository } from './repository/password-resets.repository.js';
import { SessionsRepository } from './repository/sessions.repository.js';
import { UsersRepository } from './repository/users.repository.js';
import { AuthService } from './service/auth.service.js';
import { LoginThrottleService } from './service/login-throttle.service.js';

@Module({
  imports: [AuditModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    LoginThrottleService,
    UsersRepository,
    BrandsRepository,
    InfluencersRepository,
    SessionsRepository,
    PasswordResetsRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
