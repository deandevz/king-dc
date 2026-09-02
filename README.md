<h1 align="center">King DC</h1>

<p align="center">
  Voz e tela compartilhada para o seu grupo, num servidor que é seu.
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-3b82f6"></a>
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-sim-10b981">
  <img alt="Docker Compose" src="https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white">
  <img alt="LiveKit" src="https://img.shields.io/badge/m%C3%ADdia-LiveKit-000000">
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-5FA04E?logo=node.js&logoColor=white">
</p>

<p align="center">
  <b>Português</b> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="docs/screenshot-call.png" alt="Tela de call do King DC: três pessoas no canal Geral, uma falando, uma mutada" width="100%">
</p>

King DC é um Discord mínimo para um grupo pequeno, de até uns 20 amigos ou colegas. Tem canais de voz, compartilhamento de tela, perfil com nick e foto e convites por código. Não tem chat de texto, câmera nem histórico, e isso é de propósito. Sobe numa VPS barata com um `.env` e um `docker compose up`.

## Por que existe

Em agosto de 2026 o Discord bloqueou compartilhamento de tela e câmera para usuários no Brasil, por exigência regulatória. De um dia para o outro, parte do nosso grupo perdeu a função que mais usava: mostrar a tela para os outros enquanto joga ou trabalha.

A saída foi VPN. Funciona, mas o preço é lag: a voz atrasa, o jogo engasga, e a call que era para ser leve vira uma negociação de quem está com o ping melhor. Para um grupo espalhado por países diferentes, isso não fecha.

O King DC é a resposta simples. Poucas funções, cada uma inteira, rodando num servidor que você mesmo escolhe, perto de onde o grupo está. Sem intermediário decidindo o que pode ou não ser compartilhado. O que ficou de fora ficou de fora por decisão, não por falta de tempo.

## O que faz e o que não faz

<table>
<tr>
<th align="left" width="50%">Faz</th>
<th align="left" width="50%">Não faz, de propósito</th>
</tr>
<tr>
<td valign="top">

- Canais de voz. O seed cria Geral, Jogos, Música e AFK; o admin cria mais.
- Compartilhamento de tela com áudio, fixo em 720p a 30 fps.
- Mudo, ensurdecer, push-to-talk ou detecção de voz.
- Indicador de quem está falando, quem está mutado e quem está compartilhando.
- Quem está em qual canal, na sidebar, atualizado a cada 2 s.
- Perfil com nick e foto. A foto vira WebP de 256 px no servidor.
- Convite por código de 6 caracteres, válido por 7 dias. O código é o login.
- Escolha de microfone e saída, teste de mic e volume geral de saída.
- TLS automático, migrações no boot, script de backup.

</td>
<td valign="top">

- Chat de texto, mensagens diretas ou histórico de qualquer tipo.
- Câmera.
- Gravação de call.
- Login com Google ou Discord, e-mail, recuperação de senha. Perdeu a senha? O admin gera um convite novo.
- Interface para celular. O layout é de desktop, com largura mínima de 1280 px. No celular, entrar na call, falar e ver a tela dos outros funciona; compartilhar a própria tela não.
- Vários servidores ou cargos além de admin.
- Volume por participante (está no roadmap).
- Tema claro ou outro idioma. A interface é só em português e só escura.

</td>
</tr>
</table>

## Como funciona

<p align="center">
  <img src="docs/arquitetura.png" alt="Arquitetura do King DC: browser fala com o Caddy por HTTPS, que repassa para o web e o api; a mídia vai por UDP direto do browser para o LiveKit" width="100%">
</p>

O **Caddy** recebe tudo o que chega por HTTPS, emite o certificado sozinho e repassa para o front ou para a sinalização do LiveKit. O **web** é o Next.js que serve a interface e reescreve as chamadas de `/api` para a API interna, então o browser só conhece uma origem e não existe CORS. A **API** cuida de login, perfil, convites, canais e presença, e assina o token que dá acesso a uma sala. O **LiveKit** é o servidor de mídia: recebe o áudio e a tela de cada pessoa uma vez e reenvia para as outras, sem recodificar. O **Postgres** guarda usuários, convites, sessões e canais. A presença não vai para o banco.

A mídia não passa pelo proxy porque WebRTC anda por UDP, em portas próprias por conexão, e forçar isso por um proxy TCP só adiciona atraso. Por isso o LiveKit roda com a rede do host e o browser fala direto com ele.

O caminho completo de uma call, o modelo de dados, a API HTTP e as decisões numeradas que o código cita estão em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Subir numa VPS

Cinco passos para uma VPS Ubuntu limpa. O passo a passo completo, com firewall, `.env` explicado, backup e atualização, está em [`docs/SETUP.md`](docs/SETUP.md). Se a VPS for na Vultr, o [`infra/vultr-cloud-init.md`](infra/vultr-cloud-init.md) tem um cloud-init que faz os passos 2 e 3 sozinho.

**1. DNS.** Crie dois registros A apontando para `<ip-da-vps>` antes de subir a stack, senão o Caddy não consegue emitir o certificado:

```
kingdc.seu-dominio.com   →  <ip-da-vps>
lk.seu-dominio.com       →  <ip-da-vps>
```

**2. Docker e firewall.** Use o cloud-init acima ou faça na mão:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Abra as portas 80 e 443 (TCP), 7881 (TCP), 3478 (UDP) e 50000 a 60000 (UDP). A lista completa e a regra da porta interna 7880 estão no [`docs/SETUP.md`](docs/SETUP.md#3-firewall).

**3. Código.**

```sh
sudo git clone https://github.com/deandevz/king-dc.git /opt/kingdc && sudo chown -R "$USER" /opt/kingdc
cd /opt/kingdc
```

**4. Configuração.**

```sh
cp .env.example .env && chmod 600 .env
```

Preencha os dois domínios, gere os segredos com `openssl rand -base64 32`, crie um par novo de chaves para o LiveKit e escolha o código e a senha do primeiro admin. Cada variável está explicada no próprio `.env.example`.

**5. Subir.**

```sh
docker compose -f docker-compose.yml --profile prod up -d --build
curl -s https://kingdc.seu-dominio.com/api/health    # {"ok":true,"db":true,"livekit":true}
```

Abra `https://kingdc.seu-dominio.com`, entre com o código e a senha do admin, escolha um nick e uma foto e gere convites no botão "Convidar".

## Quanto aguenta

Numa sala com N pessoas, cada uma manda um fluxo de áudio e recebe N−1, então o servidor movimenta **N × (N−1)** fluxos. Uma sala de 20 são 380 fluxos; as mesmas 20 pessoas em 4 salas de 5 são 80, quase 5 vezes menos. Voz é barata. O que pesa é tela compartilhada, e aí o limite é a franquia de banda, não o processador.

**Isto é suposição, não medição.** Os números vêm do [benchmark oficial do LiveKit](https://docs.livekit.io/transport/self-hosting/benchmark/) extrapolado para máquinas pequenas, com hipóteses sobre quanta gente fica calada e quantos membros estão em voz no pico. O correto é medir o gasto real com `docker stats` e o gráfico de tráfego do provedor numa call cheia. Se você rodar o King DC com um grupo maior e tiver números, **abra uma issue**: é o que falta aqui.

| VPS | Preço/mês | Em call, uso normal | Comunidade que comporta | Tela: h de espectador/dia |
|---|---|---|---|---|
| Vultr 1 vCPU / 2 GB / 3 TB, São Paulo (a de referência) | ~US$ 18 (US$ 8 fora de SP) | ~80 pessoas | ~400 membros | ~120 |
| Hetzner 2 vCPU / 4 GB / 20 TB, EUA ou Europa | ~€ 8 | ~160 pessoas | ~800 membros | ~800 |
| Vultr 4 vCPU / 8 GB / 6 TB, São Paulo | ~US$ 72 | ~325 pessoas | ~1.600 membros | ~240 |

Em uso normal, até a VPS de US$ 6 aguenta uns 80 em call só com voz. Tela é o que separa as máquinas: a Hetzner de 8 euros dá 40 lives de 5 espectadores por dia; a de referência dá 6. Fora do Brasil a latência sobe 120 a 150 ms.

Tabela completa com 11 máquinas, regras de cálculo, o que estoura primeiro e as hipóteses que podem estar erradas: [`docs/CAPACIDADE.md`](docs/CAPACIDADE.md).

## Desenvolvimento local

Em desenvolvimento a mídia vai para um projeto gratuito do [LiveKit Cloud](https://cloud.livekit.io), porque o `livekit-server` em modo host não roda no Docker Desktop do Mac ou Windows. Só o Postgres, a API e o web sobem em container.

```sh
cp .env.example .env         # chaves do LiveKit Cloud + segredos
pnpm install
docker compose up -d --build # api em :3000, web em :3001
```

Ou rode a API e o web fora do container com `pnpm dev:api` e `pnpm dev:web`, com só o Postgres no Docker.

```sh
pnpm typecheck && pnpm lint
pnpm test                                  # api: vitest + Postgres efêmero via testcontainers; web: vitest
E2E_PORT=4567 pnpm --filter web test:e2e   # next build + Playwright contra um mock da API
```

O e2e sobe o build standalone do Next na porta `E2E_PORT` e um mock da API na `MOCK_PORT` (padrão 3900). Os testes marcados `@livekit` abrem dois browsers numa sala real do projeto configurado no `.env`; sem as chaves, eles são pulados. Há ainda um roteiro contra a stack completa com `QA_REAL=1`. Tudo isso, mais as armadilhas de Prisma, Playwright e Alpine, está no [`docs/SETUP.md`](docs/SETUP.md#testes).

## Stack

| Peça | Escolha |
|---|---|
| Front | Next.js 16 (App Router), React 19, CSS Modules, SWR |
| API | Fastify 5, Prisma 7, Zod 4, argon2 |
| Banco | Postgres 18 |
| Mídia | LiveKit server 1.13 self-hosted, `livekit-client`, `@livekit/components-react` (só hooks, sem os componentes prontos) |
| Borda | Caddy 2 com TLS automático |
| Monorepo | pnpm workspaces, TypeScript strict, ESM em tudo |
| Testes | vitest + testcontainers na API; vitest + Playwright no front |

```
apps/api            Fastify + Prisma
apps/web            Next.js
packages/contracts  schemas Zod e tipos compartilhados entre api e web
infra               livekit.yaml, Caddyfile, backup.sh, cloud-init
design              mockups HTML das telas
docs                setup, arquitetura, interface e capacidade
```

## Decisões de design

- **O código de convite é o login.** Primeiro uso com senha nova cria a conta; depois, código e senha autenticam. Sem e-mail, sem nome de usuário.
- **Não existe tabela de membros.** É um servidor só, e todo mundo vê todos os canais. Menos uma tabela, menos uma tela.
- **Presença vem do LiveKit.** A API pergunta quem está em cada sala, guarda por 2 s e serve o valor antigo enquanto atualiza por trás. O webhook do LiveKit apaga a entrada do canal que mudou. Nada disso vai para o banco.
- **Ensurdecer é no cliente.** O LiveKit não tem esse conceito, então o front zera o volume de todo mundo e muta o microfone. Ninguém mais fica sabendo.
- **Tela fixa em 720p30.** É o preset oficial do SDK. Sessenta quadros custariam 1,5 vez mais banda para uma melhora que não importa em tela compartilhada, e banda é a conta que chega.
- **O token da sala é assinado localmente.** A API não consulta o LiveKit para dar acesso; se o LiveKit cair, quem já está na call continua e quem tenta entrar descobre na hora.
- **Preferências de áudio ficam no browser.** Dispositivo, volume, modo do microfone e tecla do push-to-talk vivem no `localStorage`. Não vale um endpoint para isso.
- **Nenhum segredo chega ao bundle.** O front recebe a URL do LiveKit junto com o token, não por variável de ambiente pública.

As 24 decisões, com o motivo de cada uma, estão em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#3-decisões-de-projeto).

## Limites conhecidos

- **F5 no meio da call volta para a sala de espera.** O estado vive na aba; recarregar desconecta e não há rejoin automático.
- **Push-to-talk só funciona com a aba em foco.** Não existe atalho global de teclado numa página web.
- **A mesma conta em duas abas na mesma sala derruba a primeira.** O LiveKit aceita uma identidade por sala.
- **Os outros canais atrasam até 2 s.** O canal em que você está é tempo real, direto da sala. Para os demais ficarem nesse ritmo em produção, ligue o webhook em `infra/livekit.yaml`.
- **API fora do ar não derruba a call.** A sidebar congela com um aviso e volta sozinha quando a API reaparece.
- **Compartilhar tela não funciona no celular.** Isso é limite do browser, não do King DC: Safari e Chrome no celular não expõem `getDisplayMedia`. Ver a tela dos outros e falar funciona.
- **Microfone "permitido" no site, mas sem som, no macOS.** O sistema pede permissão por app; ligue o browser em Ajustes do Sistema, Privacidade e Segurança, Microfone.

A lista completa, com os sintomas e o que fazer, está em [`docs/SETUP.md`](docs/SETUP.md#comportamentos-conhecidos).

## Roadmap

Curto e sem promessa de data.

- Trocar o polling de 2 s por SSE, para a presença dos outros canais chegar na hora e a API aguentar mais gente online.
- Volume por participante.
- Chat de texto opcional, desligado por padrão, sem histórico longo.
- Portar a interface para o celular, com layout responsivo. Voz e ver a tela já funcionam no browser do celular hoje; falta a UI acompanhar.

## Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR, rode o gate:

```sh
pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test \
  && E2E_PORT=4567 pnpm --filter web test:e2e
```

Regras que o código segue e que o PR precisa seguir: TypeScript strict sem `any`, arquivo até 300 linhas, toda rota da API com teste de integração, strings de interface em português e identificadores em inglês. O que está fora de escopo está listado em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#3-decisões-de-projeto); funcionalidade nova que mexa nisso começa com uma issue, não com código.

## Licença

[MIT](LICENSE).
