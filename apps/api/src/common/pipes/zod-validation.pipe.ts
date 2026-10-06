import type { PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * Builds a Nest pipe from a zod schema in `@homecare/contracts`.
 *
 * Used as `@Body(ZodValidationPipe(CreateRequestSchema))`.
 *
 * Validation lives in `contracts` so the mobile app and the admin dashboard enforce the same rules
 * the server does, instead of keeping hand-copied duplicates that drift apart.
 *
 * The `ZodError` is deliberately allowed to propagate rather than being wrapped in a Nest
 * `BadRequestException`: the global exception filter already knows how to turn a `ZodError` into the
 * documented `422 VALIDATION_ERROR` envelope with per-field messages. Wrapping it here would throw
 * away that grouping, and would return 400 where the contract specifies 422.
 */
export function ZodValidationPipe<T>(schema: ZodType<T>): PipeTransform<unknown, T> {
  return {
    transform(value: unknown): T {
      return schema.parse(value)
    },
  }
}