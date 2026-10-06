import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'
import { PaymentsService, type PaymentClaimInput } from './payments.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.payments.listCustomerInvoices(user.id) }
  }

  @Post('invoices/:id/payment-claim')
  @UseGuards(JwtAuthGuard)
  async submitPaymentClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body() body: PaymentClaimInput,
  ) {
    return { data: await this.payments.submitPaymentClaim(user.id, invoiceId, body) }
  }

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard)
  async listPayments(@Query('status') status?: string) {
    return { data: await this.payments.listAllPayments(status) }
  }

  @Post('admin/payments/:id/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body?: { note?: string },
  ) {
    return { data: await this.payments.confirmPayment(paymentId, user.id, body?.note) }
  }
}
