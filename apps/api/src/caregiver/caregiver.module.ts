import { Module } from '@nestjs/common'
import { CaregiverController } from './caregiver.controller'
import { CaregiverService } from './caregiver.service'
import { AuthModule } from '../auth/auth.module'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [CaregiverController],
  providers: [CaregiverService],
  exports: [CaregiverService],
})
export class CaregiverModule {}
