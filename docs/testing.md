# Testes

## Dois grupos

| Grupo | Onde | Precisa de banco? | Comando |
|---|---|---|---|
| Unidade | `src/**/*.test.ts` | não | `npm run test:unit` |
| Integração | `tests/integration/*.test.ts` | sim, banco de **teste** | `npm run test:integration` |

`npm test` roda os dois. O CI roda os dois a cada PR, num Postgres descartável.

## Como os testes de integração funcionam

- `buildApp()` monta a API sem abrir porta; os testes chamam `app.inject()`.
- `tests/setup/integration.ts` troca a `DATABASE_URL` pela `TEST_DATABASE_URL` **antes** de
  qualquer import.
- Proteções contra apagar o banco errado:
  1. `TEST_DATABASE_URL` precisa existir, ter nome terminado em `_test` e ser diferente da
     `DATABASE_URL` (senão os testes nem começam);
  2. antes de esvaziar as tabelas, o próprio banco confirma `current_database()` com `_test`.
- O banco é esvaziado antes de **cada** teste (`resetDatabase`); os arquivos rodam um de cada vez.
- Os cenários são montados **pela API** (`tests/helpers/factories.ts`), o mesmo caminho do usuário.
- Nenhum dado real é usado.

## O que está coberto (2026-10-12)

- Todas as rotas atuais: animais, pesagens, ganho de peso, produtos, aplicações, alertas,
  compra, venda, preço estimado e resultado.
- Entradas inválidas: limites, casas decimais, datas futuras no fuso da fazenda, campos
  desconhecidos, IDs que não são UUID, JSON malformado, corpo grande, mídia errada.
- Manipulação de ID: pesagem de outro animal via URL → 404, sem alterar nada.
- Integridade: exclusão bloqueada com compra/venda, cascata de pesagens, venda + status em
  transação, duas vendas simultâneas (só uma grava), venda antes da compra.
- Plataforma: configuração inválida (sem vazar valores), CORS por lista, 429, `/docs` desligado,
  cabeçalhos de segurança, proteção do banco de teste.

## Textos da tela (G3)

- `tests/integration/validation-codes.test.ts`: todo erro de campo traz `code` (e `params`
  quando precisa), para cada tipo de problema (vazio, longo, formato, data futura, casas
  decimais, lista vazia/repetida, filtro na URL, regra de negócio).
- `web/src/i18n/i18n.test.ts` (projeto **web-unit** do Vitest): plural, troca de valores,
  **todo código de erro da API tem tradução**, erro de campo usa os números da regra, erro sem
  resposta = sem conexão, e a tela decide pelo `code`, nunca pelo `message`.
- `npm run lint` em `web/` inclui `scripts/check-i18n.mjs` (texto fixo no código das telas).
- Verificação manual com o idioma de teste (`?lang=test`): percorrer as telas e janelas e
  conferir que só aparecem chaves `⟦...⟧`, dados digitados, números e datas (feito em
  2026-10-13 em todas as telas, janelas e num erro vindo da API).

## Saída do animal e pesagens (G5a)

- `tests/integration/exit.test.ts`: morte com data/causa/certeza, vendido sem venda, data
  obrigatória e não no futuro, conflito com pesagem/aplicação/nascimento (diz qual e a data),
  no mesmo dia pode, corrigir a saída, voltar para ativo (limpa tudo), morto ↔ vendido recusado,
  com venda registrada recusado, o banco também recusa (`CHECK`s), venda grava a saída e
  desfazer apaga; pesagem e aplicação depois da saída recusadas (inclusive ao editar);
  pesagem repetida no dia (inclusive duas ao mesmo tempo: só uma grava); pesagem de
  negociação não é editada/apagada; outra fazenda não vê nada.
- `src/services/exit.service.test.ts`: regras puras (qual registro impede, mesmo dia, nascimento
  com/sem dia certo).
- A antiga checagem de GMD "primeira e última no mesmo dia" pela API ficou impossível (uma
  pesagem por dia); a regra continua coberta no teste de unidade do GMD.
- Verificado no navegador em 2026-10-13: erro de data citando a pesagem, faixa "Saiu em …",
  botão de pesagem desligado, voltar para ativo, pesagem repetida com atalho para editar,
  aplicação com animal que saiu, celular 360 px sem rolagem lateral e idioma de teste limpo.

## Categorias (G4)

- `categories.test.ts` (integração): as 7 combinações válidas aceitas e as 5 inválidas recusadas
  (nada gravado), categoria antiga recusada, o banco também recusa, castrado (padrão da fazenda,
  informado, fêmea), edição olhando a combinação final, nomes da fazenda (renomear, não apagar
  os outros, `null` volta ao padrão, repetido, limites).
- `src/lib/categories.test.ts` e `src/services/animal.service.test.ts`: regras puras.
- **Prova de que os testes protegem:** com a regra de sexo desligada de propósito, 17 testes
  falham (feito em 2026-10-13).

## Configurações da fazenda (G2)

- `farm.test.ts`: conta nova com todos os padrões (e os padrões do código iguais aos do banco),
  alterar só o que foi enviado, limites de cada campo (fator da arroba, antecedência, fuso fora
  do Brasil, nome vazio), campos fixos na 1.0 recusados, `id` de outra fazenda recusado,
  cada fazenda vê só as próprias configurações, e o efeito na hora: aumentar a antecedência
  faz a reaplicação aparecer em `GET /alerts`.
- `src/lib/farm.test.ts`: todos os fusos da lista existem; `sanitary.service.test.ts`:
  antecedência configurável (inclusive 0 = só no dia).

## Login e isolamento entre fazendas (G1)

- Cada teste começa com um usuário **já logado** numa fazenda nova (`t.client`,
  `tests/helpers/client.ts`); `t.app` é o "visitante" sem login.
- `auth.test.ts`: criar conta (fazenda + usuário juntos, só hash guardado, e-mail repetido,
  cadastros simultâneos), entrar, mesma resposta para senha errada e e-mail inexistente, sair
  revoga, limite de tentativas (429), todas as rotas de dados sem login → 401, sessão vencida
  por inatividade e por idade, renovação.
- `tenancy.test.ts`: duas fazendas; a fazenda A tenta ler, editar e excluir **cada** registro
  da fazenda B por **todas** as rotas (404) e o teste confere que **nada** de B mudou; aplicação
  com animal ou produto de outra fazenda; `farmId` vindo do navegador; mesmo brinco em fazendas
  diferentes.
- **Prova de que os testes protegem:** com o filtro por fazenda desligado de propósito, 3 testes
  de `tenancy.test.ts` falham (feito em 2026-10-12).
