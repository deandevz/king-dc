# Interface

Referência do sistema visual para quem for mexer na UI. A fonte de verdade em código é
`apps/web/src/ui/tokens.css` (variáveis com prefixo `--kd-`). Os mockups originais, em
1440×900, estão em [`../design/minimal/`](../design/minimal/).

A direção é "vidro escuro": fundo quase preto, painéis translúcidos com blur, um único accent
menta. Duas colunas, sem barra de servidores, porque existe um servidor só.

## Paleta

| Uso | Valor |
|---|---|
| Fundo | `#0B0B0F` |
| Vidro | branco a 4% com `backdrop-filter: blur(24px)` |
| Borda | branco a 8%, 1 px. Campos 10%, painéis sutis 7%, forte 12% |
| Accent | `#7EE7C4`. Fraco 12%, borda 22%, foco 55% |
| Texto | `#ECEEF1` principal, `#9A9CA8` secundário, `#6B6D79` terciário, `#55575F` apagado |
| Perigo | `#FF7A7A`. Fundo 14%, borda 35% |
| Overlay | `rgba(20, 20, 26, 0.72)` |
| Texto sobre accent | `#06120E` |

Toda tela tem um glow radial menta a 7 a 10% e um grão SVG com opacidade em torno de 0,035.

## Tipografia

Manrope, pesos 400 a 800, via `next/font/google`. Fallback SF Pro e Segoe UI.

| Papel | Tamanho / peso / tracking |
|---|---|
| Display | 32 / 700 / -3% |
| Título | 24 / 700 / -2% |
| Subtítulo | 16 / 700 |
| Corpo | 14 / 500 |
| Rótulo | 13 / 600 |
| Micro | 11 / 600 / +10%, maiúsculas |

## Espaço, raio, altura

- Espaçamento: 4, 8, 12, 16, 24, 32, 48.
- Raios: 8 em chips, 12 em campos, botões e tiles, 16 em painéis, 999 em pílulas e avatares.
- Altura de controle: 48 padrão, 38 compacto, 46 nos botões redondos da call.

## Sombras

| Nome | Valor |
|---|---|
| Botão accent | `0 8px 28px` menta 22% |
| Card | `0 24px 60px` preto 45% |
| Barra de controles | `0 20px 50px` preto 55% |
| Frame de tela | `0 30px 80px` preto 55% |
| Tile falando | `0 0 26px` menta 22% |
| Avatar grande falando | `0 0 34px` menta 40% |
| Anel falando pequeno | `0 0 0 1.5px #7EE7C4` mais `0 0 14px` menta 45% |
| Anel de foco | `0 0 0 3px` menta 10% |

## Dimensões do layout

| Elemento | Medida |
|---|---|
| Sidebar | 260 px de largura. Header 76, dock do usuário 68 |
| Linha de canal | 36 px, raio 10 |
| Linha de participante | 30 px, indentada 34 px sob o canal |
| Header do conteúdo | 64 px |
| Card de login | 420 px, padding 40/40/32, raio 20 |
| Card de onboarding | 520 px |
| Caixas do código | até 52×60. Seis caixas com 8 px de vão passam dos 340 úteis do card, então a largura é flexível |
| Frame de tela em foco | 996×560, raio 16 |
| Miniaturas | 104 px de altura |
| Barra de controles | pílula de 64 px a 34 px do rodapé, botões de 46 px |
| Sala de espera | colunas de 132 px, avatar de 88 px |
| Largura mínima | 1280 px. Abaixo disso, scroll horizontal |

## Avatar

Sem foto, o avatar é um gradiente com a inicial do apelido em maiúscula. São 7 gradientes
(`--kd-avatar-0` a `--kd-avatar-6`), escolhidos por hash do id do usuário mod 7, então a cor
de cada pessoa é estável.

Tamanhos: 22 na sidebar, 34 no dock, 44 no tile, 80 nas configurações, 88 na sala de espera.

Estados: falando é anel e glow. Mudo é opacidade 0,5 e ícone de microfone cortado.
Ensurdecido reaproveita o visual de mudo com ícone de fone.

## Estados

**Linha de canal.** Repouso sem fundo e texto secundário. Expandido com branco a 5%. Em call
com borda accent a 20% e fundo accent a 7%.

**Tile.** Neutro com borda 8% e fundo 3,5%. Falando com borda accent de 1,5 px, fundo 6% e
glow. Compartilhando com borda accent a 22% e ícone de monitor.

**Não desenhados no mockup.** Loading, erro, vazio, reconectando e "clique para ativar o
áudio" usam os mesmos tokens: vidro, texto secundário e accent. Erro de rede é um toast só,
no canto inferior direito.

## Componentes em `ui/`

Button e IconButton, Field, CodeInput, Avatar, Glass, Slider, Segmented, Badge, Toast, Modal,
Screen, Select, Icon (20 SVGs inline).

O Modal fecha com ESC e clique no fundo, devolve o foco ao botão que o abriu e empilha: a
confirmação de sair da conta abre por cima das configurações, e ESC fecha só o do topo.

Regras: toda cor, raio, sombra e espaço sai de `tokens.css`. Um CSS Module por componente.
`cx()` junta classes. Nada de lógica de domínio dentro de `ui/`.

## Onde a implementação difere do mockup

- Configurações é um modal de um painel só, sem a navegação lateral "Aparência, Atalhos,
  Sobre".
- O dock do usuário não tem botões de microfone e fone. A barra de controles da call é a
  dona do mudo.
- O limite da foto é 5 MB, não 2.
- O contador do apelido fica abaixo do campo.
- Não existe slider de volume do microfone.
- O botão "Entrar" desabilitado aparece esmaecido. O mockup não desenhava esse estado.
- A contagem de pessoas no header também aparece fora da call.
