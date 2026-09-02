// Healthcheck do compose: bate no /health do próprio processo, sem curl na imagem.
const port = process.env.PORT ?? '3000';

try {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
