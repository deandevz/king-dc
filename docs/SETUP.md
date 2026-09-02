# Setup e operação

Guia de desenvolvimento, produção e operação. A apresentação do projeto está no
[README](../README.md). Como o sistema funciona por dentro está em
[`ARQUITETURA.md`](ARQUITETURA.md).

## Estrutura

```
apps/api            Fastify 5 + Prisma 7 (ESM, NodeNext)
apps/web            Next.js 16 App Router (React 19, CSS Modules)
packages/contracts  Schemas Zod e tipos compartilhados entre api e web
infra               livekit.yaml, Caddyfile, backup.sh, cloud-init da Vultr
design              Mockups HTML das telas
docs                Este guia, arquitetura, interface e capacidade
```

## Pré-requisitos

- Node 22 ou mais novo e pnpm 11 (`corepack enable`).
- Docker rodando. O Postgres de desenvolvimento e os testes da API dependem dele.
- Um projeto no [LiveKit Cloud](https://cloud.livekit.io) para desenvolvimento. O
  `livekit-server` em modo host não roda no Docker Desktop do Mac ou Windows. O plano
  gratuito tem 5.000 minutos por mês, o que dá para desenvolver, não para o grupo usar.

## Primeiro setup

```sh
cp .env.example .env      # preencha as chaves do LiveKit e gere os segredos
pnpm install
docker compose up -d postgres
pnpm --filter api exec prisma migrate deploy
pnpm --filter api run seed
```

Gere o `SESSION_SECRET` com `openssl rand -base64 32` e escolha um `SEED_ADMIN_PASSWORD`. O
`SEED_ADMIN_CODE` precisa usar só o alfabeto do convite (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`,
sem 0, O, 1 e I). Fora disso o admin nunca consegue logar. Se a porta 5432 já estiver
ocupada, defina `POSTGRES_HOST_PORT` no `.env`.

## Desenvolvimento

Tudo em container:

```sh
docker compose up -d --build
# api  http://localhost:3000/health
# web  http://localhost:3001
```

Ou os processos direto na máquina, com só o Postgres em container:

```sh
docker compose up -d postgres
pnpm dev:api      # http://localhost:3000
pnpm dev:web      # http://localhost:3001
```

O browser só fala com o `web`. As chamadas a `/api/*` e `/avatars/*` são reescritas pelo
Next para a API, então não existe CORS nem cookie cross-site.

Para desenvolver o front sem a API, aponte o Next para o mock:

```sh
node apps/web/mocks/server.mjs &            # porta 3900
API_INTERNAL_URL=http://localhost:3900 pnpm dev:web
```

O mock tem o admin `ADMKNG` / `admin123` sem apelido, o membro `BRUCE7` / `bruce123`, o
convite `KNG742` e o vencido `EXPRD2`. Com as chaves do LiveKit no ambiente ele assina token
de verdade; sem elas, a sala fica em "conectando".

## Testes

```sh
pnpm typecheck                             # tsc --noEmit em todos os pacotes
pnpm lint                                  # eslint
pnpm --filter api test                     # vitest + Postgres efêmero via testcontainers
pnpm --filter web test                     # vitest: lógica pura do módulo call/ (happy-dom)
E2E_PORT=4567 pnpm --filter web test:e2e   # next build + Playwright contra o mock da API
QA_REAL=1 pnpm --filter web test:qa        # roteiro contra a stack real (abaixo)
```

| Suíte | O que cobre | Testes |
|---|---|---|
| API | Toda rota, com Postgres real. Token e webhook assinados de verdade e verificados com o SDK. | 66 |
| Web, unitário | `call/lib`: metadata, tiles, políticas de reconexão, push-to-talk, presença. | 35 |
| Web, e2e | Login, onboarding, shell, call. Os marcados `@livekit` abrem dois browsers numa sala real. | 23 |
| QA real | Stack inteira no Docker, 2 a 3 browsers, incluindo tela compartilhada. | 14 |

- O e2e precisa do Chromium do Playwright: `pnpm --filter web exec playwright install chromium`.
- O e2e sobe o mock da API (`apps/web/mocks`, porta `MOCK_PORT`, padrão 3900) e o build
  standalone do Next em `E2E_PORT` (padrão 4567). Os testes `@livekit` entram nas salas
  `geral` e `jogos` do projeto configurado no `.env`; sem as chaves eles são pulados. Não
  rode duas execuções ao mesmo tempo: a mesma identidade derruba a anterior.
- Uma execução interrompida deixa processo na porta e a próxima falha com "port already
  used": `lsof -ti:4567 -ti:3900 | xargs kill -9`.
- `test:qa` não sobe nada. Precisa de `docker compose up -d --build` no ar, lê
  `SEED_ADMIN_CODE`, `SEED_ADMIN_PASSWORD` e `WEB_HOST_PORT` do `.env` e gasta minutos da
  cota do LiveKit. Screenshots ficam em `apps/web/test-results/qa/`.
- O gate completo, antes de abrir um PR:

```sh
pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test \
  && E2E_PORT=4567 pnpm --filter web test:e2e
```

## Armadilhas de desenvolvimento

- **Prisma 7.** A URL do banco vai em `apps/api/prisma.config.ts`, não em `datasource`
  (erro P1012). O client não embute motor e usa `@prisma/adapter-pg`. Depois de mudar o
  schema, rode `prisma generate`, senão o editor fica com o tipo antigo. O CLI vem da
  dist-tag `prev`; a 8 ainda é release candidate.
- **`@kingdc/contracts` é consumido de `dist/`.** Depois de mexer em
  `packages/contracts/src`, rode `pnpm --filter @kingdc/contracts build`. O `prepare` da raiz
  faz isso no `pnpm install`.
- **ESM.** A API é `NodeNext` (imports relativos com extensão `.js`); o web é `Bundler` (sem
  extensão). Não misturar.
- **TypeScript fixo em 5.9.** O `typescript-eslint` 8 aceita até a 6.0; com TS 7 o lint não
  roda.
- **`eslint-config-next` não é usado.** Ele arrasta o `eslint-plugin-react` 7, que quebra no
  ESLint 10. O `eslint.config.mjs` do web monta `@next/eslint-plugin-next` e
  `eslint-plugin-react-hooks` 7 direto.
- **`const enum` do `@node-rs/argon2`** com `verbatimModuleSyntax`: só o tipo pode ser
  importado, não o valor.
- **Playwright serve o build standalone.** `next start` não funciona com
  `output: 'standalone'`. O `test:e2e` roda `next build` antes, com `NEXT_PUBLIC_DEV_CALL=1`
  embutido. `reuseExistingServer` é falso de propósito: o build apaga `.next` inteiro e um
  servidor antigo serviria chunks que não existem mais.
- **Chromium com mídia falsa.** `--use-fake-device-for-media-stream` e
  `--use-fake-ui-for-media-stream`. Para tela, `--auto-select-desktop-capture-source`. Para
  testar autoplay bloqueado, `--autoplay-policy=user-gesture-required`, e qualquer
  `page.evaluate` antes do `play()` dá ativação à página e esconde o cenário. Só Chromium.
- **Seletores estáveis para teste.** Tiles expõem `data-identity`, `data-muted`,
  `data-speaking` e `data-sharing`. Controles usam `control-mic`, `control-deaf`,
  `control-share` e `control-leave`.
- **Vários worktrees na mesma máquina.** Defina `POSTGRES_HOST_PORT`, `API_HOST_PORT` e
  `WEB_HOST_PORT` no `.env` de cada um.
- **Alpine.** `sharp` e `@node-rs/argon2` são instalados dentro da imagem `node:24-alpine`.
  Nunca copie `node_modules` do Mac. O `standalone` do Next não inclui `public/` nem
  `.next/static`; o Dockerfile copia por fora.

## Comportamentos conhecidos

- **F5 no meio da call volta para a sala de espera.** O estado da call vive só na memória
  da aba; recarregar desconecta (os outros veem o tile sumir em menos de 1 s) e não há
  rejoin automático. Clique em "Entrar no canal" de novo.
- **Push-to-talk só funciona com a aba do King DC em foco.** Limite do browser: não existe
  atalho global de teclado numa página web. Perder o foco ou esconder a aba solta a tecla.
- **A mesma conta em duas abas na mesma sala derruba a primeira.** O LiveKit aceita uma
  identidade por sala; a aba expulsa volta para a sala de espera em vez de tentar reentrar.
- **Ensurdecer zera o volume de todo mundo e muta o microfone.** Os outros veem o fone
  cortado na sidebar, na sala de espera e no tile. Desensurdecer religa o microfone, menos em
  push-to-talk.
- **API fora do ar.** A sidebar congela na última presença conhecida com o aviso "Presença
  pode estar desatualizada", um toast avisa uma vez e a call em andamento continua (ela fala
  direto com o LiveKit). Quando a API volta, o polling recupera sozinho, sem F5.
- **LiveKit fora do ar.** `GET /channels` responde na hora com a presença antiga e o mesmo
  aviso; entrar num canal falha ao conectar (o token é assinado localmente, sem consultar o
  LiveKit).
- **O canal em que você está é tempo real; os outros atrasam até 2 s** (polling) mais o
  cache de 2 s da API. Dentro da call a lista daquele canal vem direto da sala do LiveKit,
  então entrar, sair, mutar e compartilhar tela aparecem na hora. Para os outros canais
  ficarem nesse ritmo em produção, o **webhook do LiveKit precisa estar ligado** (ele apaga
  a entrada do canal no cache); como ligar está em `infra/livekit.yaml`.
- **Microfone "permitido" no site, mas sem som (macOS).** O macOS pede permissão de
  microfone por app (Chrome, Arc, Safari…). Se o aviso do sistema foi fechado ou ignorado, o
  app fica bloqueado e o site continua mostrando "permitido". Resolver em Ajustes do Sistema
  → Privacidade e Segurança → Microfone, ligar o browser, fechar com Cmd+Q e abrir de novo.
  Sintoma típico: o "Testar microfone" das configurações não mexe, e funciona em outro
  browser.
- **Sons da call.** Mudo, ensurdecer, entrar, sair e início ou fim de tela tocam os MP3 de
  `apps/web/public/sounds/` (nomes fixos, decisão D25). Para trocar um som, substitua o
  arquivo mantendo o nome. Os que vêm no repo são bipes gerados com ffmpeg.
- **Compartilhar tela não funciona no celular.** Safari e Chrome no celular não expõem
  `getDisplayMedia`. Ver a tela dos outros e falar funciona.

## Produção (VPS Ubuntu)

Passo a passo para uma VPS Ubuntu LTS limpa. Os comandos assumem o repositório em
`/opt/kingdc` e o usuário com `sudo`. Se a VPS for na Vultr,
[`../infra/vultr-cloud-init.md`](../infra/vultr-cloud-init.md) tem um cloud-init que faz os
passos 2 e 3 sozinho.

### 1. DNS

Crie dois registros A apontando para o IP da VPS **antes** de subir a stack, senão o Caddy
falha ao emitir o certificado e fica tentando de novo:

- `kingdc.seudominio.com` → IP da VPS (`PUBLIC_DOMAIN`)
- `lk.seudominio.com` → IP da VPS (`LIVEKIT_DOMAIN`)

### 2. Docker

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # saia e entre de novo para valer
docker compose version            # precisa ser Compose v2
```

### 3. Firewall

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp             # Caddy: desafio ACME e redirect para HTTPS
sudo ufw allow 443/tcp            # Caddy: HTTPS e WSS
sudo ufw allow 443/udp            # Caddy: HTTP/3 (opcional)
sudo ufw allow 7881/tcp           # LiveKit: fallback TCP do WebRTC
sudo ufw allow 3478/udp           # LiveKit: TURN/STUN embutido
sudo ufw allow 50000:60000/udp    # LiveKit: mídia RTC
# A sinalização (7880) NÃO é pública: só o Caddy e a API, de dentro do Docker, falam com ela.
sudo ufw allow from 172.16.0.0/12 to any port 7880 proto tcp
sudo ufw enable
```

A última regra existe porque o `livekit` roda em `network_mode: host` e os outros serviços
o alcançam pelo gateway do Docker (`host.docker.internal:7880`). O `ufw` bloqueia esse
tráfego por padrão e o sintoma é o Caddy devolvendo 502 em `lk.seudominio.com` e a API
sem conseguir listar participantes. As portas publicadas pelo Docker (80/443) passam pelo
`ufw` de qualquer jeito, o que aqui é o comportamento desejado.

### 4. Código e `.env`

```sh
sudo git clone <url-do-repo> /opt/kingdc && sudo chown -R "$USER" /opt/kingdc
cd /opt/kingdc
cp .env.example .env
chmod 600 .env
```

Preencha o `.env` com os valores de produção:

| Variável | Valor em produção |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | par **novo** (`openssl rand -hex 8` e `openssl rand -base64 32`), não o do LiveKit Cloud |
| `LIVEKIT_URL` | `wss://lk.seudominio.com` |
| `LIVEKIT_HOST_HTTP` | `http://host.docker.internal:7880` (a API está em bridge; o livekit, em host) |
| `SEED_ADMIN_CODE` | 6 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; é o login do admin. Não use o do exemplo |
| `SEED_ADMIN_PASSWORD` | senha do admin (o seed roda a cada boot e converge para ela) |
| `PUBLIC_DOMAIN` / `LIVEKIT_DOMAIN` | os dois domínios do passo 1 |

`DATABASE_URL`, `AVATAR_DIR` e `API_INTERNAL_URL` do `.env` só valem fora do container: o
compose define os valores certos para a rede interna. Deixe as portas `*_HOST_PORT`
comentadas.

### 5. Subir

```sh
docker compose -f docker-compose.yml --profile prod up -d --build
docker compose -f docker-compose.yml --profile prod ps
docker compose -f docker-compose.yml logs -f api      # migrações → seed → "Server listening"
```

O `-f docker-compose.yml` é obrigatório: sem ele o Compose carrega o
`docker-compose.override.yml` de desenvolvimento, que publica portas no host. O profile
`prod` sobe também o `livekit` (em `network_mode: host`, único jeito de expor o range UDP de
WebRTC sem NAT) e o `caddy`, que emite o TLS sozinho.

A API aplica as migrações de `apps/api/prisma/migrations` no entrypoint e, quando
`SEED_ADMIN_CODE` e `SEED_ADMIN_PASSWORD` estão definidos, roda o seed idempotente antes de
subir. Se a migração falhar o container sai e o Docker o religa em loop: leia `logs api`.
Migração nova continua sendo criada em desenvolvimento com `pnpm --filter api prisma:migrate`.

Conferências depois do primeiro `up`:

```sh
curl -s https://kingdc.seudominio.com/api/health      # {"ok":true,"db":true,"livekit":true}
curl -sI https://lk.seudominio.com | head -1          # HTTP/2 200 (é o livekit atrás do Caddy)
docker compose -f docker-compose.yml exec caddy wget -qO- http://host.docker.internal:7880
```

Se o último comando falhar, é a regra de firewall da 7880 do passo 3.

Uma VPS de 1 GB roda a stack, mas não constrói as imagens sem swap. O cloud-init da Vultr
cria 1 GB de swap por isso.

### 6. Primeiro login

Abra `https://kingdc.seudominio.com/login`, entre com `SEED_ADMIN_CODE` e
`SEED_ADMIN_PASSWORD`, complete o onboarding e gere os convites no botão "Convidar".

### 7. Backup

`infra/backup.sh` faz `pg_dump` do banco e um tar do volume de avatares em `./backups/`,
com retenção de 14 dias. Agende no cron do host e copie a pasta para fora da VPS:

```sh
sudo crontab -e
# 0 3 * * * /opt/kingdc/infra/backup.sh >> /var/log/kingdc-backup.log 2>&1
# 30 3 * * * rclone sync /opt/kingdc/backups remoto:kingdc-backups
```

Restaurar está descrito no cabeçalho do próprio script.

### 8. Atualizar

```sh
cd /opt/kingdc && git pull
docker compose -f docker-compose.yml --profile prod pull        # postgres, livekit, caddy
docker compose -f docker-compose.yml --profile prod up -d --build   # reconstrói api e web
docker image prune -f
```

## Operação

- Logs: `docker compose -f docker-compose.yml logs -f api` (rotação em 3 arquivos de 10 MB por
  serviço, inclusive `livekit` e `caddy`).
- Estado: `docker compose -f docker-compose.yml --profile prod ps` mostra `healthy` para
  `postgres` e `api`. O `/health` da API responde 200 mesmo com o banco fora (`db:false`),
  então uma queda do Postgres não derruba a API: ela volta a responder sozinha quando o
  banco reaparece.
- `docker compose stop api` não religa sozinho: parada pelo daemon conta como manual. Uma
  queda real do processo religa em uns 6 s.
- Consumo em repouso: API 76 MiB, web 42 MiB, Postgres 30 MiB. Imagens: API 445 MB, web
  315 MB.
- Se alguém atrás de VPN ou firewall corporativo não conecta na call, o plano B é TURN/TLS
  na 443 (`infra/livekit.yaml` explica como ligar).
