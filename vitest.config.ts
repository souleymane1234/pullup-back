import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/common/money.ts',
        'src/common/format.ts',
        'src/common/logging/**/*.ts',
        'src/common/metrics/**/*.ts',
        'src/modules/**/domain/**/*.ts',
        'src/modules/finance/payment/**/*.ts',
      ],
      exclude: [
        'src/**/*.spec.ts',
        'src/modules/finance/payment/cinetpay.provider.ts',
        'src/modules/finance/payment/central-apis.provider.ts',
        'src/modules/finance/domain/events.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        'src/modules/billing/domain/**': { lines: 90 },
        'src/modules/matching/domain/**': { lines: 90 },
        'src/modules/influencers/domain/metrics.ts': { lines: 90 },
        'src/common/money.ts': { lines: 90 },
        'src/common/format.ts': { lines: 90 },
      },
    },
  },
});
