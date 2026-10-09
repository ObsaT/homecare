import { Global, Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { WsService } from './ws.service'
import { AuthModule } from '../auth/auth.module'

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventsService, WsService],
  exports: [EventsService, WsService],
})
export class EventsModule {}
