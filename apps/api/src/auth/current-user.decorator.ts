import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from './jwt-auth.guard'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | null => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    return request.user ?? null
  },
)