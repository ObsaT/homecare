import { Module } from '@nestjs/common'
import { RequestsController } from './requests.controller'
import { RequestsService } from './requests.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
