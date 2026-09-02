# Quantas pessoas cada VPS aguenta

[English version](CAPACITY.md)

**Isto é uma suposição.** Os números vêm do benchmark oficial do LiveKit e dos presets de mídia,
extrapolados para máquinas pequenas. Ninguém mediu uma VPS de 1 vCPU com 80 pessoas em call. O
correto é medir o gasto real com `docker stats` e o tráfego do provedor numa call cheia. Se você
rodar o King DC com um grupo maior e tiver números, abra uma issue com eles: é o que falta aqui.

## Como os números são calculados

| Medida | Regra |
|---|---|
| Fluxos de voz que o LiveKit repassa | ~240 por vCPU. Vem do [benchmark oficial](https://docs.livekit.io/transport/self-hosting/benchmark/): 16 vCPU aguentam ~3.000 assinaturas de áudio a 80% de CPU |
| Pico do pico em call | todo mundo falando ao mesmo tempo, em salas de 6. Cada pessoa custa 5 fluxos |
| Uso normal em call | 1,7× o pico: metade das pessoas calada a cada momento, e o Opus não transmite silêncio |
| Abas abertas antes da API pesar | ~120 por vCPU com o polling atual de 2 s. Acima de ~150 abas, o polling precisa virar push (SSE). É software, não máquina |
| Comunidade cadastrada | 5× o uso normal: 10 a 15% dos membros em voz no horário de pico, padrão de comunidades de jogo |
| Horas de espectador de tela por dia | franquia mensal ÷ 30 ÷ 0,84 GB. Um espectador em 720p30 custa 2 Mbps |
| Lives simultâneas | quantas transmissões de 5 espectadores cabem 4 h por dia, todo dia, dentro da franquia |

Por que "N × (N−1)": numa sala com N pessoas, cada uma manda 1 fluxo e recebe N−1. Uma sala de 20
são 380 fluxos; as mesmas 20 pessoas em 4 salas de 5 são 80. Salas pequenas custam quase 5 vezes menos.

## Tabela, da mais barata para a mais cara

Preços de setembro de 2026, aproximados. Na Vultr, São Paulo tem uma taxa extra sobre o preço base da mesma
máquina nos EUA: a de referência custa US$ 8 fora de São Paulo e US$ 18 lá.

| VPS | Região | Preço/mês | vCPU / RAM / banda | Pico do pico em call | Uso normal em call | Abas abertas | Comunidade | Tela: h de espectador/dia | Lives de 5 por 4 h/dia |
|---|---|---|---|---|---|---|---|---|---|
| Vultr HP vhp-1c-1gb | EUA / SP | US$ 6 / 9 | 1 / 1 GB / 2 TB | 48 | 80 | 120 | 400 | 79 | 4 |
| Hetzner CPX22 | EUA / UE | € 8 | 2 / 4 GB / 20 TB | 96 | 160 | 240 | 800 | 794 | 40 |
| Vultr HP vhp-1c-2gb | EUA / SP | US$ 8 / 18 | 1 / 2 GB / 3 TB | 48 | 80 | 120 | 400 | 119 | 6 |
| Hetzner CPX32 | EUA / UE | € 15 | 4 / 8 GB / 20 TB | 192 | 325 | 480 | 1.600 | 794 | 40 |
| Vultr HP vhp-2c-2gb | EUA / SP | US$ 18 / 27 | 2 / 2 GB / 4 TB | 96 | 160 | 240 | 800 | 159 | 8 |
| Hostinger KVM 8 | UE / BR | € 22 promo, € 50 renov. | 8 / 32 GB / 32 TB | 384 | 650 | 960 | 3.200 | 1.270 | 63 |
| DigitalOcean / Linode 4 GB | EUA | US$ 24 | 2 / 4 GB / 4 TB | 96 | 160 | 240 | 800 | 159 | 8 |
| Vultr HP vhp-2c-4gb | EUA / SP | US$ 24 / 36 | 2 / 4 GB / 5 TB | 96 | 160 | 240 | 800 | 198 | 10 |
| Oracle E4 Flex | SP | ~US$ 42 | 2 OCPU / 4 GB / 10 TB | 96 | 160 | 240 | 800 | 397 | 20 |
| Vultr HP vhp-4c-8gb | EUA / SP | US$ 48 / 72 | 4 / 8 GB / 6 TB | 192 | 325 | 480 | 1.600 | 238 | 12 |
| Vultr HP vhp-8c-16gb | EUA / SP | US$ 96 / 144 | 8 / 16 GB / 8 TB | 384 | 650 | 960 | 3.200 | 317 | 16 |

O projeto de referência roda na linha `vhp-1c-2gb` em São Paulo.

## O que estoura primeiro

1. **A franquia mensal de banda**, se o grupo faz live. Só voz quase não gasta: 240 fluxos cheios
   são 12 Mbps, 5,4 GB por hora.
2. **A API com muitas abas abertas**, por causa do polling de presença a cada 2 s. Trocar por push
   resolve sem trocar de máquina.
3. **A CPU do LiveKit**, por último. Ele só copia pacotes, não recodifica nada.

## Hipóteses que podem estar erradas

- **240 fluxos por vCPU.** O benchmark do LiveKit é de 2021, em CPU de servidor dedicada. Uma vCPU
  compartilhada de VPS pode render menos; uma AMD recente pode render mais.
- **Metade calada.** Em call de jogo é razoável. Em reunião com uma pessoa falando o tempo todo,
  o uso normal se aproxima do pico.
- **10 a 15% em voz no pico.** Comunidade pequena e ativa passa disso; comunidade grande e
  dormente fica bem abaixo.
- **2 Mbps por espectador.** É o preset `h720fps30`. Conteúdo estático (código, slides) gasta menos
  porque o encoder corta; jogo com muito movimento fica no teto.
- **1 GB de RAM** roda, mas não constrói as imagens na própria VPS sem swap.
- **Latência** não entra na tabela: EUA e Europa somam 120 a 150 ms para quem está na América do
  Sul. Usável, como o servidor americano do Discord, mas pior para jogo.

## Limites de configuração

- `max_participants: 30` por sala em `infra/livekit.yaml`. Ajustável.
- Polling de presença: `PRESENCE_POLL_MS` em `packages/contracts`.
- Preset de tela: 1280×720 a 30 fps e 2 Mbps, fixo em `apps/web/src/call`.

## De onde vem o custo da tela

O preset de tela do SDK do LiveKit é `h720fps30`: 1280×720, 30 quadros, 2,0 Mbps. Num SFU cada
espectador recebe uma cópia própria, então o servidor gasta 2 Mbps de saída por espectador:
2.000.000 × 3.600 ÷ 8 ÷ 1024³ ≈ 0,84 GB por hora. Dez pessoas com uma apresentando e nove
assistindo são 7,5 GB por hora só de tela. Áudio é desprezível perto disso: 0,1 Mbps por fluxo.

Não existe preset de 60 fps no SDK. Pela razão que o YouTube usa entre 720p30 e 720p60, seria
1,5 vez mais banda, por isso a tela é fixa em 30. Se a banda apertar, `h720fps15` (1,5 Mbps)
corta 25% sem trocar a resolução, e é um parâmetro do cliente, não da infra.

Provedores com região em São Paulo: Vultr, Magalu Cloud e Oracle. DigitalOcean e Contabo não
têm datacenter no Brasil. A Magalu cobra R$ 0,10 por GiB de saída desde o primeiro byte, o
que em uso intenso a torna a mais cara das três. A Oracle dá 10 TB por mês, mas o plano
gratuito perde capacidade sem aviso e não serve para produção.
