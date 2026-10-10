import { Module } from '@nestjs/common'
import { CommunicationsController } from './comms.controller'
import { CommunicationsService } from './comms.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}

