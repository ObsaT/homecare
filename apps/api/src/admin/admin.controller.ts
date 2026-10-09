import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AdminService } from './admin.service'
import { CatalogService, type CreateServiceInput, type UpdateServiceInput } from '../catalog/catalog.service'
import { ReviewsService } from '../reviews/reviews.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
  ) {}

  @Get('dashboard/summary')
  async getSummary() {
    return { data: await this.admin.getDashboardSummary() }
  }

  @Get('requests')
  async listRequests(@Query('status') status?: string) {
    return { data: await this.admin.listRequests(status) }
  }

  @Get('appointments/:id/candidates')
  async getCaregiverCandidates(@Param('id') appointmentId: string) {
    return { data: await this.admin.getCaregiverCandidates(appointmentId) }
  }

  @Post('appointments/:id/assign')
  async assignCaregiver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
    @Body() body: { caregiver_id: string },
  ) {
    return { data: await this.admin.assignCaregiver(appointmentId, body.caregiver_id, user.id) }
  }

  @Get('caregivers')
  async listCaregivers() {
    return { data: await this.admin.listCaregivers() }
  }

  @Post('caregivers/:id/approve')
  async approveCaregiver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') caregiverId: string,
  ) {
    return { data: await this.admin.updateCaregiverApproval(caregiverId, 'APPROVED', user.id) }
  }

  @Get('services')
  async listServices() {
    return { data: await this.catalog.listServices(true) }
  }

  @Post('services')
  async createService(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateServiceInput,
  ) {
    return { data: await this.catalog.createService(body, user.id) }
  }

  @Patch('services/:id')
  async updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateServiceInput,
  ) {
    return { data: await this.catalog.updateService(id, body, user.id) }
  }

  @Delete('services/:id')
  async deleteService(@Param('id') id: string) {
    return { data: await this.catalog.deleteService(id) }
  }

  @Post('requests/:id/quote')
  async updateCustomQuote(
    @Param('id') requestId: string,
    @Body() body: { price_santim: number; duration_minutes?: number; notes?: string },
  ) {
    return { data: await this.catalog.updateCustomQuote(requestId, body) }
  }

  @Get('settings/registration-fee')
  async getRegistrationFee() {
    return { data: await this.admin.getRegistrationFee() }
  }

  @Post('settings/registration-fee')
  async updateRegistrationFee(
    @Body() body: { fee_etb: number; description?: string },
  ) {
    return { data: await this.admin.updateRegistrationFee(body.fee_etb, body.description) }
  }

  @Get('caregiver-registration-payments')
  async listCaregiverRegistrationPayments() {
    return { data: await this.admin.listCaregiverRegistrationPayments() }
  }

  @Get('reviews')
  async listReviews() {
    return { data: await this.reviews.listAllReviews() }
  }
}

