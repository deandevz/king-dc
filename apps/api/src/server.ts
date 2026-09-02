import { buildApp } from './app.js';

const app = await buildApp();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: app.env.HOST, port: app.env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'falha ao subir a API');
  process.exit(1);
}
