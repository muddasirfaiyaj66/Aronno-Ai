import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { LookupsModule } from './lookups/lookups.module';
import { SeedModule } from './seed/seed.module';
import { DiagnosesModule } from './diagnoses/diagnoses.module';
import { TreatmentModule } from './treatment/treatment.module';
import { CostModule } from './cost/cost.module';
import { HistoryModule } from './history/history.module';
import { ReportsModule } from './reports/reports.module';
import { ToolsModule } from './tools/tools.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { FertilizerModule } from './fertilizer/fertilizer.module';
import { YieldModule } from './yield/yield.module';
import { PlanningModule } from './planning/planning.module';
import { MarketModule } from './market/market.module';
import { LoansModule } from './loans/loans.module';
import { StorageModule } from './storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL', 60)) * 1000,
            limit: Number(config.get('THROTTLE_LIMIT', 60)),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AdminModule,
    LookupsModule,
    SeedModule,
    StorageModule,
    DiagnosesModule,
    TreatmentModule,
    CostModule,
    HistoryModule,
    ReportsModule,
    ToolsModule,
    ReceiptsModule,
    FertilizerModule,
    YieldModule,
    PlanningModule,
    MarketModule,
    LoansModule,
    HealthModule,
    WeatherModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class AppModule {}
