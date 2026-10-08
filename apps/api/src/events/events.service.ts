import { Injectable } from '@nestjs/common'
import { Subject, Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import type { MessageEvent } from '@nestjs/common'

export interface AppRealtimeEvent {
  type: 'NEW_OFFER' | 'OFFER_ACCEPTED' | 'OFFER_DECLINED' | 'VISIT_STATUS_CHANGED' | 'VISIT_COMPLETED' | 'NEW_REQUEST' | 'HEARTBEAT'
  targetUserId?: string
  targetRole?: 'CAREGIVER' | 'CUSTOMER' | 'ADMIN'
  data: Record<string, unknown>
  timestamp: string
}

@Injectable()
export class EventsService {
  private readonly eventSubject = new Subject<AppRealtimeEvent>()

  emit(event: Omit<AppRealtimeEvent, 'timestamp'>) {
    this.eventSubject.next({
      ...event,
      timestamp: new Date().toISOString(),
    })
  }

  emitToUser(userId: string, type: AppRealtimeEvent['type'], data: Record<string, unknown>) {
    this.emit({
      type,
      targetUserId: userId,
      data,
    })
  }

  emitToRole(role: AppRealtimeEvent['targetRole'], type: AppRealtimeEvent['type'], data: Record<string, unknown>) {
    this.emit({
      type,
      targetRole: role,
      data,
    })
  }

  broadcast(type: AppRealtimeEvent['type'], data: Record<string, unknown>) {
    this.emit({
      type,
      data,
    })
  }

  subscribeForUser(userId?: string, role?: string): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      filter(event => {
        if (!event.targetUserId && !event.targetRole) return true
        if (event.targetUserId && event.targetUserId === userId) return true
        if (event.targetRole && (event.targetRole === role || role === 'ADMIN')) return true
        return false
      }),
      map(event => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    )
  }
}
