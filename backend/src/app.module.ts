import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './common/logging/logger.config';
import { DbModule } from './common/db/db.module';
import { AuthModule } from './common/auth/auth.module';
import { AuthMiddleware } from './common/auth/auth.middleware';
import { PrModule } from './modules/pr/pr.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { StockModule } from './modules/stock/stock.module';
import { PeopleModule } from './modules/people/people.module';
import { GovModule } from './modules/gov/gov.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PortalModule } from './modules/portal/portal.module';
import { ImportModule } from './modules/import/import.module';
import { EmailModule } from './modules/email/email.module';
import { AnomalyModule } from './modules/anomaly/anomaly.module';
import { BudgetModule } from './modules/budget/budget.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditModule } from './modules/audit/audit.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { PoModule } from './modules/po/po.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { PurchaseRequestModule } from './modules/purchase-request/purchase-request.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(loggerConfig),
    ScheduleModule.forRoot(),
    // Default budget for any unannotated route. Login/refresh override with
    // tighter limits via @Throttle in their controllers.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DbModule,
    AuthModule,
    UsersModule,
    SuppliersModule,
    SupplierModule, // New catalog module
    PurchaseRequestModule, // New PR workflow
    PrModule,
    ApprovalsModule,
    NotificationsModule,
    MarketplaceModule,
    HealthModule,
    AiModule,
    FinanceModule,
    ComplianceModule,
    StockModule,
    PeopleModule,
    GovModule,
    AnalyticsModule,
    PortalModule,
    ImportModule,
    EmailModule,
    AnomalyModule,
    BudgetModule,
    WebhooksModule,
    AuditModule,
    AttachmentsModule,
    PoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply JWT verification to every route...
    consumer
      .apply(AuthMiddleware)
      // ...except auth-public ones. Refresh is reachable without an access
      // token; both login and refresh are throttled in AuthController.
      .exclude(
        { path: 'health',                     method: RequestMethod.GET },
        { path: 'auth/login',                 method: RequestMethod.POST },
        { path: 'auth/refresh',               method: RequestMethod.POST },
        // Google OAuth: token verification IS the auth — no JWT yet.
        { path: 'auth/oauth/google',          method: RequestMethod.POST },
        // LINE webhook is authenticated by HMAC signature, not JWT.
        { path: 'notifications/line/webhook', method: RequestMethod.POST },
        // Supplier portal endpoints use a URL-embedded token instead of JWT.
        { path: 'portal/(.*)',                method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
