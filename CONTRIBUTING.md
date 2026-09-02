# Contribuindo

O King DC tem um mantenedor só. Tudo passa por ele, no tempo dele. As regras abaixo existem
para a revisão caber nesse tempo.

## Antes de escrever código

- **Bug ou problema: abra uma issue primeiro.** Diga o que fez, o que esperava e o que
  aconteceu. Versão do browser e do sistema, se for coisa de call. Log da API, se for coisa
  de servidor.
- **Funcionalidade nova: abra uma issue e espere resposta.** O que está fora de escopo em
  [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#3-decisões-de-projeto) continua fora. PR de
  feature sem issue aprovada é fechado.
- Erro de digitação ou correção de doc pode ir direto em PR.

## Pull request

- **Um PR resolve uma coisa.** Se resolve duas, são dois PRs.
- **Mínimo de linhas.** Sem refatoração de passagem, sem renomear o que não precisa, sem
  mexer em formatação de arquivo que você não alterou.
- **Descrição escrita por você, curta.** O que quebrava, o que o PR muda, como testou. Três
  frases costumam bastar. Texto gerado por ferramenta, com parágrafos genéricos e listas de
  "melhorias", vai ser fechado sem ler.
- **Código gerado por IA sem processo é fechado na hora.** Sinais: mudança gigante que toca
  dezenas de arquivos, abstração que nada usa, comentário explicando o óbvio, tratamento de
  erro para caso que não existe, estilo diferente do resto do repositório. Usar ferramenta
  para escrever não é o problema. Mandar o que ela cuspiu sem ler, entender e enxugar é.
- **Testes.** Rota nova ou alterada na API tem teste de integração. Bug corrigido tem teste
  que falhava antes. Rode o gate antes de abrir:

```sh
pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test
```

- **Docs no mesmo PR.** Mudou comportamento, rota, variável de ambiente, porta ou passo de
  setup: atualize `docs/SETUP.md`, `docs/ARQUITETURA.md` e os dois READMEs junto.
- **Sem PR de atualização de dependência.** Versões são fixadas de propósito (decisão D23).
  Se uma versão precisa subir, abra uma issue dizendo por quê.

## Código

Regras em [`CLAUDE.md`](CLAUDE.md): TypeScript strict sem `any`, arquivo até 300 linhas,
comentários em português só com o motivo, identificadores em inglês, strings de interface em
português, shapes da API em `packages/contracts`.

## Como o merge acontece

O mantenedor revisa, pede ajuste se precisar e faz squash merge. Não é preciso rebase nem
histórico limpo no PR. Depois do merge o branch pode ser apagado.
