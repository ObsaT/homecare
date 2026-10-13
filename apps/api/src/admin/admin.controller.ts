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

  @Post('appointments/:id/dispatch')
  async dispatchAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
  ) {
    return { data: await this.admin.dispatchAppointment(appointmentId, user.id) }
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

  @Post('caregivers/:id/status')
  async updateCaregiverStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') caregiverId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; reason?: string },
  ) {
    return {
      data: await this.admin.updateCaregiverApproval(caregiverId, body.status, user.id, body.reason),
    }
  }

  @Delete('caregivers/:id')
  async deleteCaregiver(@Param('id') caregiverId: string) {
    return { data: await this.admin.deleteCaregiver(caregiverId) }
  }

  @Get('customers')
  async listCustomers() {
    return { data: await this.admin.listCustomers() }
  }

  @Post('customers/:id/status')
  async updateCustomerStatus(
    @Param('id') customerId: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' },
  ) {
    return { data: await this.admin.updateCustomerStatus(customerId, body.status) }
  }

  @Delete('customers/:id')
  async deleteCustomer(@Param('id') customerId: string) {
    return { data: await this.admin.deleteCustomer(customerId) }
  }

  @Get('invoices')
  async listAllInvoices() {
    return { data: await this.admin.listAllInvoices() }
  }

  @Post('invoices')
  async createCustomerInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { customer_user_id: string; request_id?: string; total_etb: number; notes?: string },
  ) {
    return { data: await this.admin.createCustomerInvoice(user.id, body) }
  }

  @Patch('invoices/:id/adjust')
  async adjustCustomerInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body()
    body: {
      total_etb?: number
      discount_etb?: number
      surcharge_etb?: number
      status?: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID'
      notes?: string
    },
  ) {
    return { data: await this.admin.adjustCustomerInvoice(invoiceId, user.id, body) }
  }

  @Post('data-management/clear')
  async clearPlatformData(
    @Body() body: { mode: 'ALL_NON_ADMIN' | 'CAREGIVERS_ONLY' | 'CUSTOMERS_AND_REQUESTS_ONLY' },
  ) {
    return { data: await this.admin.clearPlatformData(body.mode || 'ALL_NON_ADMIN') }
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

