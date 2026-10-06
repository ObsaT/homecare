import { defineConfig } from 'vitest/config'

/**
 * Controllers use explicit `@Inject()` decorators rather than relying on
 * `design:paramtypes` reflection metadata. The metadata is emitted by `tsc` but not by esbuild,
 * which is what Vitest transforms with, so implicit constructor injection silently yields
 * `undefined` under test while working in a `tsc` build. Explicit injection behaves identically in
 * both, at the cost of one decorator per dependency.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
  },
})