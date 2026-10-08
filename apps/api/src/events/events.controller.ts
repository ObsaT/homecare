import { Controller, Sse, Post, Body, Query, Req, Inject } from '@nestjs/common'
import { EventsService } from './events.service'
import { TokenService } from '../auth/token.service'
import { Observable, interval, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import type { MessageEvent } from '@nestjs/common'

@Controller('api/v1/events')
export class EventsController {
  constructor(
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  @Sse('stream')
  stream(
    @Query('token') token?: string,
    @Req() req?: { headers?: Record<string, string | string[] | undefined> },
  ): Observable<MessageEvent> {
    let userId: string | undefined
    let role: string | undefined

    const authHeader = req?.headers?.authorization as string | undefined
    const rawToken = token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined)

    if (rawToken) {
      try {
        const claims = this.tokenService.verifyAccessToken(rawToken)
        userId = claims.sub
        role = claims.role
      } catch {
        // Fall back to untargeted broadcast stream
      }
    }

    const heartbeat$ = interval(20000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() }),
      } as MessageEvent)),
    )

    return merge(this.eventsService.subscribeForUser(userId, role), heartbeat$)
  }

  @Post('test-offer')
  triggerTestOffer(
    @Body() body?: { caregiver_id?: string; patient_name?: string; service_name?: string; sub_city?: string },
  ) {
    const payload = {
      appointment_id: `APT-${Date.now()}`,
      service_name: body?.service_name || 'Emergency Wound Dressing & Vitals',
      patient_name: body?.patient_name || 'Ato Kebede Michael (74 yrs)',
      sub_city: body?.sub_city || 'Bole',
      address: 'Bole Rwanda, Near Edna Mall',
      scheduled_for: 'Immediate / Next 2 Hours',
      duration_hours: 2,
      price_etb: 1000,
      clinical_notes: 'Post-op dressing care required. Sterile protocol requested.',
      created_at: new Date().toISOString(),
    }

    if (body?.caregiver_id) {
      this.eventsService.emitToUser(body.caregiver_id, 'NEW_OFFER', payload)
    } else {
      this.eventsService.emitToRole('CAREGIVER', 'NEW_OFFER', payload)
    }

    return {
      success: true,
      message: 'Test offer event dispatched to caregiver(s)',
      event: payload,
    }
  }
}
