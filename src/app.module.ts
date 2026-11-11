import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureGuard } from './common/guards/feature.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { OriginGuard } from './common/http/origin.guard.js';
import { CoreModule } from './config/core.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CampaignsModule } from './modules/campaigns/campaigns.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InfluencersModule } from './modules/influencers/influencers.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { ReferencesModule } from './modules/references/references.module.js';
import { SpacesModule } from './modules/spaces/spaces.module.js';
import { SystemModule } from './modules/system/system.module.js';

@Module({
  imports: [
    CoreModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    AdminModule,
    PlatformModule,
    AuthModule,
    BillingModule,
    CatalogModule,
    CampaignsModule,
    FinanceModule,
    InfluencersModule,
    MatchingModule,
    ReferencesModule,
    SpacesModule,
    HealthModule,
    SystemModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
