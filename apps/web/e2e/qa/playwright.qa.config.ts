import { defineConfig, devices } from '@playwright/test';

/**
 * Config do QA adversarial contra a stack real (`docker compose up`): sem webServer, sem mock.
 * Rode com `QA_REAL=1 pnpm --filter web test:qa`. Screenshots vão para `test-results/qa/`.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [['list']],
  outputDir: '../../test-results/qa-artifacts',
  use: {
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium-real',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--auto-select-desktop-capture-source=Entire screen',
          ],
        },
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
