import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { RequestsService, type CreateBookingInput } from './requests.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1/requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly requests: RequestsService) {}

  @Post()
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBookingInput,
  ) {
    const result = await this.requests.createRequest(user.id, body)
    return { data: result }
  }

  @Get()
  async listCustomerRequests(@CurrentUser() user: AuthenticatedUser) {
    const list = await this.requests.listCustomerRequests(user.id)
    return { data: list }
  }

  @Get(':id')
  async getRequestDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const detail = await this.requests.getRequestDetail(user.id, id)
    return { data: detail }
  }

  @Post(':id/cancel')
  async cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    const res = await this.requests.cancelRequest(user.id, id, body?.reason)
    return { data: res }
  }
}
