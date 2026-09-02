// Enxuga a pasta de produção gerada por `pnpm deploy --prod` (Dockerfile, estágio build).
//
// O `@prisma/client` declara o CLI `prisma` como peer, então o `deploy --prod` o traz
// junto com Studio, PGlite, TypeScript e motores: ~230 MB que o runtime nunca carrega
// (as migrações rodam por `dist/migrate.js`). Em vez de uma lista do que apagar, fica
// só o que é alcançável a partir de `dependencies` do package.json, andando pela
// árvore do pnpm (`.pnpm/<pacote>/node_modules/<dep>` são os deps de cada pacote).
import { readdirSync, realpathSync, rmSync, readFileSync, lstatSync } from 'node:fs';
import { join, sep } from 'node:path';

const root = process.argv[2];
if (root === undefined) throw new Error('uso: docker-prune.mjs <pasta do deploy>');
const store = join(root, 'node_modules', '.pnpm');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/**
 * Peers de build do `@prisma/client` que o pnpm liga ao lado dele: o CLI (o runtime migra
 * por conta própria) e o TypeScript (só tipos). Ignorados em qualquer nível da árvore.
 */
const BUILD_ONLY = new Set(['prisma', 'typescript']);

/** Entradas de um node_modules, com os escopos `@x/y` abertos e os peers de build fora. */
function packagesIn(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || BUILD_ONLY.has(entry)) continue;
    if (entry.startsWith('@')) {
      for (const inner of readdirSync(join(dir, entry))) found.push(join(dir, entry, inner));
    } else {
      found.push(join(dir, entry));
    }
  }
  return found;
}

/** `.pnpm/<hash>` de um caminho real dentro da árvore virtual. */
function storeEntryOf(realPath) {
  const parts = realPath.split(sep);
  const index = parts.lastIndexOf('.pnpm');
  return index >= 0 && parts[index + 1] !== undefined ? parts.slice(0, index + 2).join(sep) : null;
}

const keep = new Set();
const queue = packagesIn(join(root, 'node_modules')).filter((path) =>
  Object.hasOwn(pkg.dependencies ?? {}, path.slice(join(root, 'node_modules').length + 1)),
);

while (queue.length > 0) {
  const link = queue.pop();
  let real;
  try {
    real = realpathSync(link);
  } catch {
    continue;
  }
  if (keep.has(real)) continue;
  keep.add(real);
  const entry = storeEntryOf(real);
  if (entry === null) continue;
  for (const sibling of packagesIn(join(entry, 'node_modules'))) {
    if (realpathSync(sibling) !== real) queue.push(sibling);
  }
}

const keptEntries = new Set([...keep].map(storeEntryOf).filter((entry) => entry !== null));
let removed = 0;
for (const entry of readdirSync(store)) {
  const full = join(store, entry);
  if (entry === 'lock.yaml' || entry === 'node_modules' || keptEntries.has(full)) continue;
  if (!lstatSync(full).isDirectory()) continue;
  rmSync(full, { recursive: true, force: true });
  removed += 1;
}
for (const name of BUILD_ONLY) {
  rmSync(join(root, 'node_modules', name), { recursive: true, force: true });
  rmSync(join(root, 'node_modules', '.bin', name), { force: true });
}
console.warn(`prune: ${keptEntries.size} pacotes mantidos, ${removed} removidos`);
