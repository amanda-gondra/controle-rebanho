# Arquitetura do backend

> Estado em 2026-10-13: Fase 3 (fundação técnica) + G1 (fazenda, usuário, login e separação
> por fazenda) + G2 (configurações da fazenda) + G4 (categorias).

## Visão geral (atual)

Monólito modular: uma API Fastify + um banco PostgreSQL. Sem filas, cache ou serviços
separados — não há necessidade real ainda.

```
requisição
  → Fastify (helmet, rate limit, CORS por lista de origens, cookies)
  → [rotas protegidas] authenticate: cookie → sessão no banco → request.auth + request.db
                                                             → 401 UNAUTHENTICATED / SESSION_EXPIRED
  → validação Zod do schema da rota (params, query, body)   → 400 VALIDATION_ERROR
  → handler da rota (src/routes)                             → AppError com código
      → regra pura (src/services, testada)                    
      → request.db (Prisma filtrado pela fazenda — src/lib/tenant.ts) → PostgreSQL
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
| `src/lib/tenant.ts` | `forFarm(farmId)`: o **ponto único** do filtro por fazenda |
| `src/lib/auth.ts` | Gancho `authenticate` das rotas protegidas |
| `src/lib/session.ts` | Criar, conferir, renovar e apagar sessões; cookie |
| `src/lib/password.ts` | Hash e verificação de senha (scrypt) |
| `src/lib/farm.ts` | Fazenda e configurações (G2): campos lidos, formato da resposta, padrões e fusos do Brasil |
| `src/schemas/` | Schemas Zod (fonte única de validação e do Swagger); limites em `common.schema.ts` |
| `src/routes/` | Rotas HTTP: `auth` (pública), `animals`, `sanitary`, `finance`, `farm` (protegidas) |
| `src/services/` | Regras de cálculo puras (GMD, alertas, resultado) + testes unitários |

## Convenções

- Código, arquivos, rotas e campos em **inglês**. Mensagens ao usuário em **português**.
- Toda entrada passa por um schema Zod `.strict()` (campo desconhecido → 400).
- Limites coerentes com o banco: peso ≤ 9999,99 kg e preço ≤ 99.999.999,99 (2 casas);
  brinco ≤ 50, nomes ≤ 100, observações ≤ 1000 caracteres; aplicação ≤ 5000 animais.
  (Limites técnicos — mudar aqui se o produto pedir.)
- Datas de calendário entram como `AAAA-MM-DD` e são gravadas como meia-noite UTC
  (`toDbDate`). "Hoje/futuro/vencido" usam o **fuso da fazenda** (`Farm.timezone`, padrão
  `America/Sao_Paulo` — D-16), escolhido nas Configurações entre os fusos do Brasil (D-31).
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
| Sem login / sessão inexistente | 401 | `UNAUTHENTICATED` |
| Sessão vencida | 401 | `SESSION_EXPIRED` |
| E-mail ou senha errados (mesma resposta nos dois casos) | 401 | `INVALID_CREDENTIALS` |
| E-mail já cadastrado | 409 | `EMAIL_ALREADY_REGISTERED` |
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

## Isolamento por fazenda (G1)

- Banco compartilhado; **todas** as tabelas do rebanho têm `farmId` (Animal, Weighing, Product,
  Application, ApplicationAnimal, AnimalPurchase, AnimalSale). Brinco único **por fazenda**.
- O `farmId` vem **só da sessão**. Os schemas `.strict()` recusam `farmId` no corpo ou na query.
- **Ponto único:** `forFarm(farmId)` (`src/lib/tenant.ts`) é uma extensão do Prisma que acrescenta
  `where.farmId` em toda leitura/edição/exclusão e `data.farmId` em toda criação. As rotas
  protegidas só usam `request.db` (já filtrado); o `prisma` "cru" fica para conta/sessão/saúde.
- Operação do Prisma que o filtro não conhece → erro (falha fechada, nunca vaza).
- Criações **aninhadas** (ex.: aplicação + animais) informam o `farmId` do filho explicitamente.
- Ao gravar uma ligação (aplicação → animais/produto), a rota confere pelos dados **da fazenda**:
  id de outra fazenda → `ANIMALS_NOT_FOUND` / `PRODUCT_NOT_FOUND`.
- Registro de outra fazenda responde **404** (não revela que existe).
- 🟡 Ainda não há chaves compostas `[id, farmId]` no banco (defesa extra prevista no escopo);
  a garantia hoje é o filtro único + os testes de acesso cruzado.

## Autenticação (G1 — D-23, D-24, D-25)

| Rota | Faz |
|---|---|
| `POST /auth/register` | cria fazenda + usuário numa instrução só e já entra (201) |
| `POST /auth/login` | entra; erro igual para e-mail inexistente e senha errada (401) |
| `POST /auth/logout` | apaga a sessão no banco e o cookie (204) |
| `GET /auth/me` | usuário e fazenda da sessão (protegida) |

- **Senha:** scrypt nativo do Node (N=2^15, r=8, p=1, sal de 16 bytes), parâmetros guardados
  junto do hash; comparação em tempo constante; login de e-mail inexistente confere contra um
  hash "de mentira" (mesmo tempo de resposta). Senha de 8 a 128 caracteres.
- **Sessão:** token aleatório de 256 bits no cookie `rebanho_session` (`HttpOnly`,
  `SameSite=Lax`, `Path=/`, `Secure` em produção). O banco guarda só o **SHA-256** do token.
  Vence após **7 dias sem uso** (renovada com o uso, no máximo 1 escrita/hora) e, de qualquer
  jeito, **30 dias** após o login. Sair apaga a sessão (revogação imediata).
- **Força bruta:** limite de `AUTH_RATE_LIMIT_MAX` tentativas/minuto por IP em entrar e criar conta.
- **CSRF:** `SameSite=Lax` + CORS com lista fechada de origens (`credentials: true`) + a API só
  aceita corpo JSON (formulário de outro site não consegue enviar).
- **Fora desta etapa (D-25):** recuperação de senha (precisa de serviço de e-mail), troca de
  senha, vários usuários por fazenda.

## Configurações da fazenda (G2 — D-21, D-30, D-31)

- Colunas em `Farm`, todas com padrão (conta nova funciona sem configurar nada):
  `currency` (BRL, fixa na 1.0), `weightUnit` (kg, fixa na 1.0), `arrobaLiveFactorKg` (30),
  `preferredPriceUnit` (`PER_KG`), `reapplyAlertDays` (7, de 0 a 60), `defaultCastrated` (não).
- `src/lib/farm.ts` é a fonte única: `FARM_SELECT` (o que a sessão, `/auth/*` e `/farm` leem),
  `toFarmView` (formato da resposta), `FARM_DEFAULTS` (iguais aos `@default` do banco — um teste
  confere) e `BRAZIL_TIME_ZONES` (os únicos fusos aceitos).
- `request.auth.farm` já traz as configurações (`settings`): as rotas usam o fuso e a
  antecedência da fazenda sem consulta extra. Mudar uma configuração vale na próxima requisição
  (nada é recalculado nem regravado).
- `GET /farm` e `PATCH /farm` **não têm id na rota**: a fazenda é sempre a da sessão. O schema
  `.strict()` recusa `id`, `country`, `currency` e `weightUnit`.
- `GET /alerts` usa `reapplyAlertDays` e o fuso da fazenda (`classifyReapplication`).
- Ainda sem efeito (esperando a G5): `arrobaLiveFactorKg` e `preferredPriceUnit`. Ficam
  guardados e editáveis pela API; o cartão "Negociações" entra com a G5.

## Categorias (G4 — D-02)

- `Category`: `CALF` (bezerro/bezerra), `HEIFER` (novilha), `COW` (vaca), `YEARLING` (garrote),
  `ADULT_MALE` (boi), `BULL` (touro). `src/lib/categories.ts` é a fonte única da regra de sexo
  (`CALF` serve aos dois; `HEIFER`/`COW` só fêmea; `YEARLING`/`ADULT_MALE`/`BULL` só macho).
- `resolveAnimalProfile` (`src/services/animal.service.ts`) decide categoria e castrado no
  cadastro e na edição, olhando a combinação FINAL (o que o animal já tem + o que mudou).
  Erros: `CATEGORY_INCOMPATIBLE_WITH_SEX`, `CASTRATED_ONLY_FOR_MALES` (400, com o campo).
- Castrado: só machos; sem valor no cadastro → `Farm.defaultCastrated`; fêmea → `null`.
- A mesma regra está no banco (`CHECK`), como defesa extra.
- Nomes exibidos: 7 chaves (`CALF_MALE`, `CALF_FEMALE`, `YEARLING`, `ADULT_MALE`, `BULL`,
  `HEIFER`, `COW`). `Farm.categoryLabels` guarda só os que a fazenda mudou; a API devolve os 7
  já resolvidos em `settings.categoryLabels`. `PATCH /farm { categoryLabels: { CHAVE: "nome" | null } }`
  muda só as chaves enviadas (`null` = padrão); nomes repetidos → `DUPLICATE_CATEGORY_LABEL`.
  O código da categoria nunca muda. No frontend, o hook `useCategoryLabels` dá o nome certo.
