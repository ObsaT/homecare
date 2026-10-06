import { Controller, Get } from '@nestjs/common'

@Controller()
export class HealthController {
  @Get('health')
  check(): { status: 'ok'; service: string; time: string } {
    return { status: 'ok', service: 'homecare-api', time: new Date().toISOString() }
  }

  @Get()
  root(): {
    service: string
    status: string
    api_prefix: string
    admin_ui_url: string
    endpoints: Record<string, string>
  } {
    return {
      service: 'Home Care Addis Ababa Backend API',
      status: 'online',
      api_prefix: '/api/v1',
      admin_ui_url: 'http://localhost:3001',
      endpoints: {
        health: '/health',
        services: '/api/v1/services',
        sub_cities: '/api/v1/sub-cities',
        quote: '/api/v1/pricing/quote',
      },
    }
  }
}