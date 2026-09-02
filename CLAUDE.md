# King DC

Discord mínimo self-hosted: voz, tela, perfil, convites. Monorepo pnpm: `apps/api` (Fastify 5,
Prisma 7), `apps/web` (Next 16, React 19, CSS Modules), `packages/contracts` (Zod, único dono
dos shapes da API), `infra/`, `docs/`.

Leia antes de mexer: `docs/ARQUITETURA.md` (decisões D1 a D24, API, modelo de dados) e
`docs/SETUP.md` (armadilhas de Prisma, Playwright, Alpine).

## Código

- O mínimo de linhas que resolve o problema. Sem abstração para um caso só, sem
  configuração para o futuro, sem código morto.
- TypeScript `strict`. Zero `any` fora de teste. Zero `@ts-ignore`. Arquivo até 300 linhas,
  função até 60.
- Comentários em português, só onde o código não se explica: o motivo, não o quê.
  Identificadores em inglês. Strings de interface em português.
- Shape novo da API entra em `packages/contracts` primeiro; api e web só consomem.
- Lógica testável fora do React e do LiveKit (padrão de `apps/web/src/call/lib`).
- Nenhum componente visual pronto do `@livekit/components-react`. Só hooks.
- Cor, raio, sombra e espaço vêm de `apps/web/src/ui/tokens.css`. Nada de valor solto no CSS.
- Nada de `NEXT_PUBLIC_*` com segredo. Nada de `.env` no git.

## Decisões

- Mudar uma decisão numerada (`decisão D5` nos comentários) começa por atualizar a tabela em
  `docs/ARQUITETURA.md`, no mesmo commit.
- O que está fora de escopo lá continua fora. Feature nova pede conversa antes de código.

## Docs

- Mudou comportamento, rota, variável de ambiente, porta ou passo de setup: atualize
  `docs/SETUP.md`, `docs/ARQUITETURA.md` e os dois READMEs no mesmo commit.
- Mudou token visual ou medida: `docs/INTERFACE.md`.
- Sem doc de processo no repo. Notas de trabalho vão em `context/`, que é ignorado.

## Testes

- Toda rota da API tem teste de integração (vitest + testcontainers). Fluxo crítico do front
  tem e2e (Playwright).
- Gate antes de commitar: `pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test`.

## Git

- Commits pequenos, mensagem em português, sem trailer de ferramenta.
- PR e commit são escritos na voz do mantenedor (o usuário), em primeira pessoa. Nunca como
  contribuidor externo, nunca "combinado com o mantenedor". Sem link de sessão em nenhum dos dois.
  Mostrar o texto do PR antes de abrir.
- Autor é o `git config` local do repo (e-mail noreply do GitHub). Não mudar.
