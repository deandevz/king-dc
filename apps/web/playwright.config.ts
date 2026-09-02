import { defineConfig, devices } from '@playwright/test';
import { livekitEnv } from './e2e/livekitEnv';

// 3101 e 3131 costumam estar ocupadas nesta máquina; sobrescreva com E2E_PORT se precisar.
const PORT = Number(process.env.E2E_PORT ?? 4567);
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 3900);
const baseURL = `http://127.0.0.1:${PORT}`;

// O mock emite token de verdade quando recebe as chaves; sem elas volta ao token falso.
const livekit = livekitEnv();

export default defineConfig({
  testDir: './e2e',
  // O mock guarda estado em memória e cada teste começa dando reset nele: um worker só.
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Mídia falsa: getUserMedia responde sem prompt e sem hardware.
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: 'node mocks/server.mjs',
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      env: { MOCK_PORT: String(MOCK_PORT), ...livekit },
      // Nunca reaproveitar: um mock antigo em pé serve dados de outra versão do arquivo.
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // `next start` não serve build standalone: rodamos o mesmo server.js da imagem Docker,
      // com os estáticos copiados para o lugar que o standalone espera.
      command:
        'rm -rf .next/standalone/apps/web/.next/static .next/standalone/apps/web/public ' +
        '&& cp -R .next/static .next/standalone/apps/web/.next/ ' +
        '&& cp -R public .next/standalone/apps/web/ ' +
        '&& node .next/standalone/apps/web/server.js',
      url: baseURL,
      env: { PORT: String(PORT), HOSTNAME: '127.0.0.1' },
      // `next build` apaga `.next`: um server antigo serve chunks que não existem mais.
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
