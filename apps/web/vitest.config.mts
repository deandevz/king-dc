import { defineConfig } from 'vitest/config';

/** Só a lógica pura do módulo `call/`: o e2e cobre a sala de verdade. */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
