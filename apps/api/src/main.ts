import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configureApp } from './configure-app'

export const API_PREFIX = 'api/v1'

async function bootstrap(): Promise<void> {
  // bodyParser: false because configureApp registers the parser with an explicit size limit.
  // Leaving Nest's default in place as well means the effective limit is whichever parser runs
  // first, which is not a limit anyone can point at in review.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  })

  configureApp(app)
  app.enableShutdownHooks()

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap()
}