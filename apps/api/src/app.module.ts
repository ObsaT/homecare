import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { AuthModule } from './auth/auth.module'
import { DbModule } from './db/db.module'
import { RedisModule } from './redis/redis.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { HealthModule } from './health/health.module'
import { CatalogModule } from './catalog/catalog.module'
import { PatientsModule } from './patients/patients.module'
import { RequestsModule } from './requests/requests.module'
import { CaregiverModule } from './caregiver/caregiver.module'
import { ReviewsModule } from './reviews/reviews.module'
import { AdminModule } from './admin/admin.module'
import { PaymentsModule } from './payments/payments.module'
import { EventsModule } from './events/events.module'

@Module({
  imports: [
    HealthModule,
    AuthModule,
    DbModule,
    RedisModule,
    CatalogModule,
    PatientsModule,
    RequestsModule,
    CaregiverModule,
    ReviewsModule,
    AdminModule,
    PaymentsModule,
    EventsModule,
  ],
  providers: [
    // Global, so no controller can accidentally leak a raw error by forgetting a try/catch.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}