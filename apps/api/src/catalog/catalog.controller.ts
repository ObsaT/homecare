import { Controller, Get, Inject, Query } from '@nestjs/common'
import { CatalogService } from './catalog.service'

@Controller('api/v1')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('services')
  async getServices() {
    return { data: await this.catalog.listServices() }
  }

  @Get('sub-cities')
  async getSubCities() {
    return { data: await this.catalog.listSubCities() }
  }

  @Get('pricing/quote')
  async getQuote(
    @Query('service_code') serviceCode: string,
    @Query('duration_minutes') durationMinutes?: string,
  ) {
    const minutes = durationMinutes ? parseInt(durationMinutes, 10) : 60
    return { data: await this.catalog.calculateQuote(serviceCode, minutes) }
  }

  @Get('pricing/registration-fee')
  async getRegistrationFee() {
    return { data: await this.catalog.getCaregiverRegistrationFee() }
  }
}

