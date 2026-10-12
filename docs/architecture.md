# Arquitetura do backend

> Estado em 2026-10-12 (Fase 3 — fundação técnica). O que é **atual** está marcado como tal;
> o que ainda **depende da parte G1** está marcado como 🔒 *planejado*.

## Visão geral (atual)

Monólito modular: uma API Fastify + um banco PostgreSQL. Sem filas, cache ou serviços
separados — não há necessidade real ainda.

```
requisição
  → Fastify (helmet, rate limit, CORS por lista de origens)
  → validação Zod do schema da rota (params, query, body)   → 400 VALIDATION_ERROR
  → handler da rota (src/routes)                             → AppError com código
      → regra pura (src/services, testada)                    
      → Prisma (src/lib/prisma.ts)  → PostgreSQL
  → tratador central de erros (src/lib/error-handler.ts)
```

| Arquivo | Papel |
|---|---|
| `src/server.ts` | Ponto de entrada: lê a config, monta a app, sobe, desliga limpo (SIGTERM/SIGINT) |
| `src/app.ts` | `buildApp(config)`: monta a aplicação **sem** abrir porta (usado pelos testes) |
| `src/config/env.ts` | Lê e **valida** as variáveis de ambiente; erro diz o **nome**, nunca o valor |
| `src/lib/errors.ts` | `AppError` e a lista de **códigos de erro** estáveis |
| `src/lib/error-handler.ts` | Converte qualquer erro na resposta `{ code, message, errors? }` |
| `src/lib/dates.ts` | Datas de calendário e "hoje" no fuso da fazenda |
| `src/lib/prisma.ts` | Conexão única com o banco |
| `src/schemas/` | Schemas Zod (fonte única de validação e do Swagger); limites em `common.schema.ts` |
| `src/routes/` | Rotas HTTP: `animals`, `sanitary`, `finance` |
| `src/services/` | Regras de cálculo puras (GMD, alertas, resultado) + testes unitários |

## Convenções

- Código, arquivos, rotas e campos em **inglês**. Mensagens ao usuário em **português**.
- Toda entrada passa por um schema Zod `.strict()` (campo desconhecido → 400).
- Limites coerentes com o banco: peso ≤ 9999,99 kg e preço ≤ 99.999.999,99 (2 casas);
  brinco ≤ 50, nomes ≤ 100, observações ≤ 1000 caracteres; aplicação ≤ 5000 animais.
  (Limites técnicos — mudar aqui se o produto pedir.)
- Datas de calendário entram como `AAAA-MM-DD` e são gravadas como meia-noite UTC
  (`toDbDate`). "Hoje/futuro/vencido" usam o fuso `America/Sao_Paulo` (D-16) até a fazenda
  ter cadastro próprio (G1/G2).
- Regras que podem falhar lançam `AppError` (`notFound`, `conflict`, `unprocessable`,
  `badRequest`); a rota não monta resposta de erro na mão.
- Operações que precisam andar juntas usam `prisma.$transaction` (venda + status).
- Exclusões e edições condicionais usam uma instrução só com filtro
  (`deleteMany/updateMany where …`) em vez de "busca e depois apaga".

## Formato de erro (atual)

```json
{ "code": "DUPLICATE_TAG", "message": "Já existe um animal cadastrado com este brinco." }
{ "code": "VALIDATION_ERROR", "message": "Dados inválidos.", "errors": [{ "field": "weightKg", "error": "..." }] }
```

O **`code` é o contrato** (regra transversal 7). O `message` existe enquanto os textos do
frontend não saem do código (G3). Lista completa em `src/lib/errors.ts`.

| Situação | Status | Código |
|---|---|---|
| Schema inválido | 400 | `VALIDATION_ERROR` |
| JSON malformado / requisição ruim | 400 | `BAD_REQUEST` |
| Registro não existe | 404 | `*_NOT_FOUND` / `RECORD_NOT_FOUND` |
| Rota não existe | 404 | `ROUTE_NOT_FOUND` |
| Unicidade (brinco, compra, venda) | 409 | `DUPLICATE_TAG`, `DUPLICATE_PURCHASE`, `DUPLICATE_SALE`, `DUPLICATE_RECORD` |
| Estado não permite | 409 | `ANIMAL_HAS_TRANSACTIONS`, `ANIMAL_HAS_SALE`, `DEAD_ANIMAL_CANNOT_BE_SOLD` |
| Regra de data/cálculo | 422 | `SALE_BEFORE_PURCHASE`, `INSUFFICIENT_WEIGHINGS`, `SAME_DAY_WEIGHINGS` |
| Corpo grande / mídia | 413 / 415 | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` |
| Limite de requisições | 429 | `RATE_LIMITED` |
| Qualquer outra falha | 500 | `INTERNAL_ERROR` (detalhe só no log) |

## Saúde do serviço (atual)

- `GET /health` — o processo está vivo (não toca no banco).
- `GET /ready` — o banco responde (`SELECT 1`); 503 se não.

## 🔒 Isolamento por fazenda (planejado — G1, aguardando decisões)

Hoje **não existe** autenticação nem separação por fazenda: todas as rotas são públicas
(F-01). **Não publicar a API na internet antes da G1.**

Modelo aprovado no escopo (Release 1.0, G1):

- Banco compartilhado, `farmId` em **todas** as tabelas de dados; brinco único por fazenda.
- O `farmId` vem **só da sessão** — nunca do corpo, da URL ou de query.
- Filtro por fazenda aplicado em **um ponto só** do código.
- 🟡 Relações compostas `[id, farmId]` para o banco impedir ligação entre fazendas.
- Acesso a registro de outra fazenda responde **404** (não revela que existe).

## 🔒 Fluxo de autenticação (planejado — G1, aguardando decisões)

Proposta no escopo (🟡, pendente de aprovação): sessão em cookie `HttpOnly`, `Secure`,
`SameSite=Lax`, registrada no banco (permite sair e revogar); senha com hash Argon2id;
limite de tentativas de login; mensagem que não revela se o e-mail existe; recuperação de
senha por e-mail com token de uso único. Os testes exigidos já estão listados como
pendentes em `tests/integration/platform.test.ts`.
