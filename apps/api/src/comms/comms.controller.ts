import { Controller, Post, Get, Body, Param, UseGuards, Inject, Query } from '@nestjs/common'
import { CommunicationsService, type SendMessageInput } from './comms.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1/comms')
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(
    @Inject(CommunicationsService) private readonly comms: CommunicationsService,
  ) {}

  @Post('messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SendMessageInput,
  ) {
    const res = await this.comms.sendMessage(user.id, body)
    return { data: res }
  }

  @Get('appointments/:id/messages')
  async getAppointmentMessages(@Param('id') targetId: string) {
    const messages = await this.comms.getMessagesForAppointment(targetId)
    return { data: messages }
  }

  @Get('admin/feed')
  async getAdminFeed(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50
    const feed = await this.comms.getLiveFeedForAdmin(parsedLimit)
    return { data: feed }
  }

  @Post('admin/broadcast')
  async broadcastAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title: string; message: string; target_role?: 'CAREGIVER' | 'CUSTOMER' | 'ALL' },
  ) {
    const res = await this.comms.sendMessage(user.id, {
      content: `📢 [${body.title}]: ${body.message}`,
      message_type: 'BROADCAST_ANNOUNCEMENT',
      metadata: {
        title: body.title,
        target_role: body.target_role || 'ALL',
        broadcast_by: user.id,
      },
    })
    return { data: res }
  }
}
