import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CaregiverService, type CompleteVisitInput } from './caregiver.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1/caregiver')
@UseGuards(JwtAuthGuard)
export class CaregiverController {
  constructor(@Inject(CaregiverService) private readonly caregiver: CaregiverService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.caregiver.getProfile(user.id) }
  }

  @Patch('availability')
  async setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { is_available: boolean },
  ) {
    return { data: await this.caregiver.setAvailability(user.id, body.is_available) }
  }

  @Get('offers')
  async getOffers(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.caregiver.getOffers(user.id) }
  }

  @Post('offers/:id/accept')
  async acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
  ) {
    return { data: await this.caregiver.acceptOffer(user.id, appointmentId) }
  }

  @Post('offers/:id/decline')
  async declineOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
    @Body() body?: { reason?: string },
  ) {
    return { data: await this.caregiver.declineOffer(user.id, appointmentId, body?.reason) }
  }

  @Post('appointments/:id/en-route')
  async markEnRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
  ) {
    return { data: await this.caregiver.markEnRoute(user.id, appointmentId) }
  }

  @Post('appointments/:id/arrive')
  async startVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
    @Body() body?: { lat?: number; lng?: number },
  ) {
    return { data: await this.caregiver.startVisit(user.id, appointmentId, body?.lat, body?.lng) }
  }

  @Post('appointments/:id/complete')
  async completeVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
    @Body() body: CompleteVisitInput,
  ) {
    return { data: await this.caregiver.completeVisit(user.id, appointmentId, body) }
  }
}
