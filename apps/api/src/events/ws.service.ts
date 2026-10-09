import { Injectable, Inject, Logger } from '@nestjs/common'
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server } from 'http'
import type { Subscription } from 'rxjs'
import { EventsService, type AppRealtimeEvent } from './events.service'
import { TokenService } from '../auth/token.service'

interface AuthenticatedClient {
  ws: WebSocket
  userId?: string
  role?: string
  isAlive: boolean
}

@Injectable()
export class WsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WebSocketServer')
  private wss: WebSocketServer | null = null
  private readonly clients = new Set<AuthenticatedClient>()
  private eventsSub: Subscription | null = null
  private pingInterval: NodeJS.Timeout | null = null

  constructor(
    @Inject(HttpAdapterHost) private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  onModuleInit() {
    const server: Server | undefined = this.httpAdapterHost.httpAdapter?.getHttpServer()
    if (!server) {
      this.logger.warn('HTTP server instance not available for WebSocket mounting')
      return
    }

    this.wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const pathname = url.pathname

        if (pathname === '/ws' || pathname === '/api/v1/ws') {
          this.wss?.handleUpgrade(request, socket, head, (ws) => {
            this.wss?.emit('connection', ws, request)
          })
        }
      } catch (err) {
        this.logger.error(`WebSocket upgrade error: ${err}`)
        socket.destroy()
      }
    })

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request)
    })

    // Subscribe to internal event bus and broadcast to WebSocket clients
    this.eventsSub = this.eventsService.getEvents$().subscribe((event) => {
      this.broadcastEvent(event)
    })

    // 25-second heartbeat to clean stale connections
    this.pingInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate()
          this.clients.delete(client)
          continue
        }
        client.isAlive = false
        try {
          client.ws.ping()
        } catch {
          // Socket write failed, will be cleaned up next cycle
        }
      }
    }, 25000)

    this.logger.log('WebSocket service initialized on /ws and /api/v1/ws')
  }

  onModuleDestroy() {
    this.eventsSub?.unsubscribe()
    if (this.pingInterval) clearInterval(this.pingInterval)

    for (const client of this.clients) {
      try {
        client.ws.close()
      } catch {
        // Ignore close errors during shutdown
      }
    }
    this.clients.clear()
    this.wss?.close()
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const tokenFromQuery = url.searchParams.get('token')
    const authHeader = request.headers.authorization
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const rawToken = tokenFromQuery || tokenFromHeader

    const client: AuthenticatedClient = {
      ws,
      isAlive: true,
    }

    if (rawToken) {
      this.authenticateClient(client, rawToken)
    }

    this.clients.add(client)

    ws.on('pong', () => {
      client.isAlive = true
    })

    ws.on('message', (message: string) => {
      client.isAlive = true
      try {
        const parsed = JSON.parse(message.toString())
        if (parsed.type === 'AUTH' && typeof parsed.token === 'string') {
          this.authenticateClient(client, parsed.token)
        } else if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }))
        }
      } catch {
        // Ignore unparseable frames
      }
    })

    ws.on('close', () => {
      this.clients.delete(client)
    })

    ws.on('error', () => {
      this.clients.delete(client)
    })

    // Welcome handshake
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        data: {
          authenticated: Boolean(client.userId),
          userId: client.userId,
          role: client.role,
          message: 'HomeCare Addis Real-Time WebSocket connected',
        },
        timestamp: new Date().toISOString(),
      }),
    )
  }

  private authenticateClient(client: AuthenticatedClient, token: string) {
    try {
      const claims = this.tokenService.verifyAccessToken(token)
      client.userId = claims.sub
      client.role = claims.role
      this.logger.log(`WebSocket authenticated: user=${client.userId} role=${client.role}`)

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(
          JSON.stringify({
            type: 'AUTH_SUCCESS',
            data: { userId: client.userId, role: client.role },
            timestamp: new Date().toISOString(),
          }),
        )
      }
    } catch {
      this.logger.warn('WebSocket invalid authentication token provided')
    }
  }

  private broadcastEvent(event: AppRealtimeEvent) {
    const payload = JSON.stringify({
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    })

    const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'CLINICAL_SUPERVISOR', 'OPERATIONS']

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue

      const clientRole = (client.role || '').toUpperCase()
      const isStaff = STAFF_ROLES.includes(clientRole)

      // Filtering logic
      if (event.targetUserId && client.userId !== event.targetUserId) {
        // Staff get visibility into user notifications for real-time monitoring
        if (!isStaff) continue
      }

      if (event.targetRole) {
        if (event.targetRole === 'ADMIN') {
          if (!isStaff) continue
        } else if (clientRole !== event.targetRole.toUpperCase() && !isStaff) {
          continue
        }
      }

      try {
        client.ws.send(payload)
      } catch (err) {
        this.logger.warn(`Failed to send WebSocket message: ${err}`)
      }
    }
  }
}
