import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AuthModule } from '../auth/auth.module'
import { CatalogModule } from '../catalog/catalog.module'
import { EventsModule } from '../events/events.module'
import { ReviewsModule } from '../reviews/reviews.module'

@Module({
  imports: [AuthModule, CatalogModule, EventsModule, ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
