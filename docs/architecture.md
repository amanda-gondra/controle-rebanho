# Arquitetura do backend

> Estado em 2026-10-13: Fase 3 (fundação técnica) + G1 (fazenda, usuário, login e separação
> por fazenda) + G2 (configurações da fazenda) + G4 (categorias) + G3 (textos fora do código) + G5a (saída do animal e
> pesagens com origem) + G5b (negociações de compra e venda).

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
| `src/routes/` | Rotas HTTP: `auth` (pública), `animals`, `sanitary`, `trades`, `finance` (resultado), `farm` (protegidas) |
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
{ "code": "VALIDATION_ERROR", "message": "Dados inválidos.",
  "errors": [{ "field": "tag", "code": "TOO_LONG", "params": { "max": 50 }, "error": "Use no máximo 50 caracteres." }] }
```

O **`code` é o contrato** (regra transversal 7). Desde a G3 a tela **nunca** mostra o
`message` nem o `error` (são textos em português para quem lê a API): ela traduz o `code`.
Cada erro de campo traz o próprio `code` e, quando a frase precisa de número, `params`
(`src/lib/validation-errors.ts` converte os problemas do Zod; regras próprias informam o
código em `refine(..., { params: { code } })`; `fieldError(campo, código, texto)` e
`ruleError(...)` para regras na rota). Lista completa em `src/lib/errors.ts`.

Códigos de campo: `REQUIRED`, `INVALID_TYPE`, `TOO_SHORT {min}`, `TOO_LONG {max}`,
`TOO_SMALL {min, inclusive}`, `TOO_BIG {max, inclusive}`, `TOO_FEW {min}`, `TOO_MANY {max}`,
`NOT_INTEGER`, `MAX_2_DECIMALS`, `INVALID_FORMAT {format}`, `INVALID_OPTION`, `UNKNOWN_FIELD`,
`DUPLICATE_ITEMS`, `FUTURE_DATE`, `REAPPLY_BEFORE_DATE`, `EMPTY_UPDATE`, `INVALID` — e os de
regra de negócio (`CATEGORY_INCOMPATIBLE_WITH_SEX`, `CASTRATED_ONLY_FOR_MALES`,
`DUPLICATE_CATEGORY_LABEL`).

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
| Unicidade (brinco, compra, venda, pesagem no dia) | 409 | `DUPLICATE_TAG`, `DUPLICATE_PURCHASE`, `DUPLICATE_WEIGHING_DATE`, `DUPLICATE_RECORD` |
| Estado não permite | 409 | `ANIMAL_HAS_TRANSACTIONS`, `ANIMAL_HAS_SALE`, `INVALID_STATUS_TRANSITION`, `WEIGHING_FROM_TRADE`, `ANIMAL_ALREADY_SOLD`, `ANIMAL_ALREADY_PURCHASED` (corrida entre duas negociações) |
| Regra de data/cálculo | 422 | `SALE_BEFORE_PURCHASE`, `INSUFFICIENT_WEIGHINGS`, `SAME_DAY_WEIGHINGS`, `EXIT_DATE_CONFLICT`, `WEIGHING_DATE_OUT_OF_RANGE`, `ANIMALS_NOT_IN_HERD_ON_DATE`, `TRADE_ITEM_ERRORS` (lista por linha) |
| Corpo grande / mídia | 413 / 415 | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` |
| Limite de requisições | 429 | `RATE_LIMITED` |
| Qualquer outra falha | 500 | `INTERNAL_ERROR` (detalhe só no log) |

## Saúde do serviço (atual)

- `GET /health` — o processo está vivo (não toca no banco).
- `GET /ready` — o banco responde (`SELECT 1`); 503 se não.

## Isolamento por fazenda (G1)

- Banco compartilhado; **todas** as tabelas do rebanho têm `farmId` (Animal, Weighing, Product,
  Application, ApplicationAnimal, Trade, TradeItem). Brinco único **por fazenda**.
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

## Saída do animal e pesagens (G5a — D-27, D-33)

- `PATCH /animals/:id/status` `{ status, exitDate?, deathCause?, deathCauseCertainty? }`:
  - ativo → `DEAD` ou `SOLD` exige `exitDate` (não no futuro, pelo fuso da fazenda);
  - morto/vendido → pode corrigir a própria saída ou voltar para `ACTIVE` (apaga data, causa e
    certeza); trocar morto ↔ vendido direto → 409 `INVALID_STATUS_TRANSITION`;
  - causa e certeza só valem para `DEAD` (certeza padrão `NOT_INFORMED`; o sistema não sugere causa);
  - com venda registrada → 409 `ANIMAL_HAS_SALE` (a saída é a da venda).
- Regras puras em `src/services/exit.service.ts` (`findExitConflict`, `checkDateWithinLife`);
  consultas ao banco em `src/lib/animal-life.ts`:
  - `assertExitDateAllowed`: a saída não pode ser antes do nascimento, da compra, da última
    pesagem nem da última aplicação → 422 `EXIT_DATE_CONFLICT` com `params { kind, date }`
    (no mesmo dia pode);
  - `assertWeighingDateAllowed`: pesagem depois da saída ou antes do nascimento (quando o dia é
    conhecido) → 422 `WEIGHING_DATE_OUT_OF_RANGE` com `params { reason, date }`;
  - `assertAnimalsInHerdOnDate`: aplicação (criar/editar) com animal fora do rebanho na data →
    422 `ANIMALS_NOT_IN_HERD_ON_DATE` com `params { tags, count }`.
- A venda (modelo atual) também é a saída: registrar/editar a venda grava `exitDate`;
  desfazer volta para ativo sem data.
- Pesagem: `source` = `MANUAL` | `PURCHASE` | `SALE`. Só `MANUAL` é editada/apagada à mão
  (as outras → 409 `WEIGHING_FROM_TRADE`; serão criadas pelas negociações na entrega 2 da G5).
  Uma por animal por dia (índice único) → 409 `DUPLICATE_WEIGHING_DATE`; na tela, o botão
  "Editar a pesagem desse dia" abre a existente.

## Negociações — compra e venda (G5b — D-03, D-08, D-22, D-35, D-37)

- "Negocia em lote, guarda individual": `Trade` (data, forma de preço, base e fator da arroba,
  moeda, comprador/vendedor, `idempotencyKey`, quem registrou) + `TradeItem` (um por animal: peso
  vivo, peso de carcaça, preço, `priceAdjusted`, valor, pesagem criada).
- **Valor de cada animal** (`computeItemValue`, `src/services/trade.service.ts`): por kg = peso ×
  preço; arroba de carcaça = carcaça ÷ 15 × preço; arroba de peso vivo = peso ÷ fator × preço; por
  cabeça = preço. Conta em centavos inteiros (`BigInt`), arredondada meio para cima **por item**;
  total = soma exata dos itens. A tela repete a mesma conta só como prévia (`web/src/types/tradeMath.ts`,
  com teste que compara as duas); valor e total enviados pelo navegador são ignorados.
- **Quem pode entrar** (`checkAnimalForTrade`): venda — nunca morto, nunca já vendido, não antes
  da compra, nada registrado depois (saída); compra — uma por animal, não depois da venda nem da
  saída, não antes do nascimento conhecido. Os erros voltam juntos, por linha
  (`items.N.animalId` + `params { tag, date, kind/reason }`), e nada é gravado.
- **Tudo numa transação** (até 5.000 animais, tempo maior): itens, pesagens, situação e saída.
  Venda marca `SOLD` com `exitDate` = data da venda; tirar o animal ou desfazer volta para ativo.
- **Pesagens** (`src/lib/trades.ts`): o peso vivo vira a pesagem do dia (`source` = tipo); se já
  havia pesagem manual nesse dia, ela é trocada (D-37) e a resposta traz `replacedWeighings`.
  Desfazer/tirar apaga a pesagem do item. Por cabeça sem peso: nenhuma.
- **Arroba de carcaça sem peso** (D-35): o item fica com `value = null`; a negociação sai como
  `pending` (`total` nulo e `knownTotal` com o que já tem valor). `PATCH /trades/:id` completa.
- **Envio repetido** (RN-NEG-016): mesmo `idempotencyKey` devolve a negociação já gravada (200),
  inclusive se as duas chegarem juntas.
- **Último preço** (`GET /trades/last-prices`): por categoria e por categoria + raça, só preços
  sem ajuste; a tela mostra como sugestão clicável — nunca preenche sozinha (RN-NEG-020).
- **Resultado do animal** (`GET /animals/:id/result`, `finance.service.ts`): venda − compra, sem
  custos; `kind` diz o caso (diferença, só compra, só venda, pendente, moedas diferentes).
- As rotas antigas `/animals/:id/purchase`, `/sale` e `/estimated-price` saíram (D-09).
- **Compra em lote que cadastra os animais (G5c — D-36):** na compra, cada item traz `animalId`
  (animal já cadastrado) **ou** `newAnimal` (`tag`, `sex`, `category`, `castrated?`, `breed?`).
  `planNewAnimals` (`src/lib/trades.ts`) aplica as regras do cadastro (`resolveAnimalProfile`:
  categoria × sexo, castrado só em macho, padrão da fazenda) e confere o brinco na fazenda e na
  própria lista (`DUPLICATE_TAG` com `params { tag, reason: IN_FARM | IN_LIST }`, no campo
  `items.N.newAnimal.tag`). Os animais são criados (`createMany`, com o id já escolhido) dentro da
  mesma transação da compra e das pesagens. Animal novo numa venda → `NOT_ALLOWED`
  (`reason: NEW_ANIMAL_IN_SALE`). Desfazer a compra não apaga os animais (D-10).

## Textos da tela (G3 — D-01)

- Todo texto da interface fica em `web/src/i18n/pt-BR.ts` (único idioma publicado na 1.0),
  organizado por tela; a tela usa `t("chave", { valores })`. Chave errada não compila.
  Plural: `{ one, other }` escolhido pelo `Intl.PluralRules` (zero usa "other").
- Sem biblioteca externa: `web/src/i18n/index.ts` é uma função pequena e tipada.
- Erros da API: `web/src/i18n/errors.ts` (`errorMessage`, `fieldErrorsOf`,
  `singleErrorMessage`) traduz pelo `code`; nunca pelo `message`.
- Datas, números e dinheiro: `web/src/types/format.ts`, sempre por `Intl` no idioma da tela;
  moeda vem da fazenda (`setDisplayCurrency`). Meses e nomes de país/moeda também vêm do `Intl`.
- Nomes de categoria: os padrões vêm da tradução (`categories.*`); a API devolve só os
  **personalizados** pela fazenda (`settings.categoryLabels`).
- **Idioma de teste** (só em desenvolvimento): abrir o app com `?lang=test` mostra a chave no
  lugar de cada texto (`⟦nav.herd⟧`) e formata datas/números em inglês. Qualquer frase em
  português que aparecer ficou fixa no código. `?lang=pt-BR` volta.
- **Conferência automática:** `npm run lint` (em `web/`) roda `scripts/check-i18n.mjs`, que
  acusa texto fixo no JSX e textos entre aspas com cara de frase. Caso legítimo:
  `// i18n-ignore` na linha.
- Mensagens da API (`message`/`error`) continuam em português, só para desenvolvedor.

