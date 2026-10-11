import type { INestApplication } from '@nestjs/common'
import express from 'express'
import { requestIdMiddleware } from './common/middleware/request-id.middleware'

/**
 * Outer ceiling on a request body. Per-file upload limits live in the upload module (10 MB per
 * file, docs/07-api-contract.md § 0); this is the guard above them, because an unbounded body is a
 * cheap memory-exhaustion vector and this service handles wound photos.
 */
export const JSON_BODY_LIMIT = '12mb'

/**
 * Everything that must be true of the app regardless of how it was constructed.
 *
 * This is extracted from main.ts because wiring that only runs in a real boot is wiring no test
 * covers. An earlier version of this file had a global ValidationPipe that made the process fail to
 * start under `NODE_ENV=production`, while every unit and e2e test passed, because the tests built
 * their own app and never touched the bootstrap path.
 *
 * `configureApp` must be called by every entry point that serves traffic, including tests.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Enable CORS for web admin dashboard and mobile client across all local and cloud origins
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin || '*'
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Vary', 'Origin')
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, Authorization, X-Request-Id, Idempotency-Key',
    )
    res.header('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    credentials: true,
    optionsSuccessStatus: 204,
  })

  // Middleware, not an interceptor: interceptors skip unmatched routes, so a 404 would carry no
  // request id at all, which is precisely the request you need to correlate.
  app.use(requestIdMiddleware)

  // Body parsing is registered explicitly rather than left to Nest's default. Note there is no
  // global ValidationPipe: request bodies are validated by ZodValidationPipe at the controller,
  // from the schemas in @homecare/contracts, so the server and client cannot drift.
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  return app
}