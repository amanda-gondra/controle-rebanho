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

## Histórico do animal e auditoria (D-19, D-28, D-29, D-51, D-52, D-54 — 2026-10-18)

- **Brinco sem diferenciar maiúsculas (D-29):** "br-1" e "BR-1" são o mesmo brinco na fazenda —
  na API (`mode: "insensitive"`) e no banco (índice único `Animal_farmId_lower_tag_key`).
- **Troca de brinco (D-19):** `POST /animals/:id/tag-changes` {newTag, reason, date}. O animal é o
  mesmo (pesagens, aplicações e negociações continuam nele); o brinco antigo fica na linha do
  tempo e a busca da lista o encontra ("achado pelo brinco antigo").
- **Linha do tempo (D-28):** tabela `AnimalEvent` (só acrescentada). Tipos: brinco, categoria,
  sexo, nascimento, situação, origem e lote; cada evento guarda antes/depois em código ou JSON
  pequeno (a tela traduz), data efetiva e autor. `GET /animals/:id/history` (paginada).
- **Autor (D-51):** `createdById` em animal, pesagem, aplicação e pertencimento a lote; negociação
  já tinha. **Ações sensíveis** vão para `AuditLog`, que o banco **não deixa editar** (gatilho):
  excluir animal, pesagem, aplicação ou lote, arquivar/reativar produto, desfazer negociação ou
  tirar animal dela, mudar configurações. Senha e token nunca entram na trilha.
- **Exclusão (D-54):** cadastro errado continua sendo apagado de verdade (D-10); a exclusão fica
  registrada na trilha. Antes de excluir um animal, `GET /animals/:id/delete-impact` diz o que vai junto.
- **Origem e entrada (D-52):** `origin` = nascido na fazenda / comprado / recebido / não
  informado, + `entryDate` opcional (entre nascimento e saída — `CHECK` no banco). A compra
  preenche "comprado" + data da compra; desfazer a compra volta para "não informado".

## Lotes (D-49 — versão simples, 2026-10-18)

- `Lot` (nome único sem maiúsculas, descrição, arquivado) e `LotMembership` (animal, lote,
  `startDate`, `endDate`). **Um período aberto por animal** (índice único parcial
  `LotMembership_one_open_per_animal_key`); o gatilho `LotMembership_same_farm` impede misturar
  fazendas.
- Mover (`POST /lots/:id/animals`) fecha o período atual na data e abre o novo; tirar do lote
  (`POST /lots/:id/remove`) só fecha. Regras em `services/lot.service.ts`: vendido/morto não muda
  de lote; data fora da vida do animal ou antes da entrada no lote atual é recusada
  (`LOT_MOVE_ERRORS`, um erro por animal com o brinco). Venda/morte fecha o período na data da
  saída; desfazer a saída reabre.
- Arquivar só lote vazio; excluir só lote que nunca teve animais (senão `LOT_IN_USE`: arquive).
- Telas: **Lotes** (lista com animais ativos por lote), detalhe do lote (quem está agora, desde
  quando, colocar animais, mudar marcados de lote, histórico de quem passou), ficha do animal
  ("Lote: X · Mudar de lote") e filtro por lote na lista do rebanho. Pasto e piquete: fora.
- **Resumo do lote** (`GET /lots/:id` → `summary`, função pura `summarizeLot` em
  `services/lot.service.ts`, 2026-10-21): machos e fêmeas de quem está no lote agora; **peso médio** =
  média da última pesagem de cada animal atual (quem nunca foi pesado não entra; `weighedAnimals`
  diz quantos entraram); **GMD médio no lote** = média do GMD de cada animal usando **só as
  pesagens desde que ele entrou no lote** (precisa de 2 pesagens em dias diferentes nesse período;
  `animalsWithGain`/`animalsWithoutGain`); `formedOn` = início do primeiro período do lote.
- Abas do detalhe: `GET /lots/:id/weighings` (pesagens feitas enquanto o animal estava no lote,
  até 200, mais recentes primeiro) e `GET /lots/:id/applications` (aplicações em que algum animal
  estava no lote na data; `animalsInLot` de `animalsTotal`). Outra fazenda → 404.

## Manejo sanitário v1.0 (D-12, D-39, D-40, D-57, F-18 — 2026-10-18)

- Tipos de produto: vacina, vermífugo, antiparasitário externo, outro (remédio). Produto tem
  para que serve, fabricante, observações e **carência em dias** escrita pelo produtor (em branco
  = não informada, nunca zero). Editar; **arquivar** produto usado (não entra em aplicação nova,
  `PRODUCT_ARCHIVED`); excluir só o nunca usado. Nome único sem maiúsculas.
- Aplicação: **dose opcional** (quantidade + unidade mL/g/dose, só registro — o sistema não
  sugere nem confere), partida do frasco, carência **copiada** do produto com o fim calculado
  (`CHECK` no banco), `idempotencyKey` (reenvio depois de queda de internet não grava duas vezes).
- Lembrete (D-40): sai da lista ao **registrar a reaplicação a partir dele**, ao **dispensar**
  (motivo opcional) ou quando nenhum animal da aplicação está ativo. `src/lib/reminders.ts`.
- **Aviso de carência na venda (D-12):** se algum animal estiver em carência registrada na data
  da venda, a API responde `WITHDRAWAL_WARNING` com a lista; a tela mostra brinco, produto e fim e
  só grava se a pessoa confirmar (`withdrawalWarningAccepted` fica na negociação). O sistema
  **avisa, não bloqueia** e nunca afirma conformidade.

## Pesagem em sequência e lista no servidor (D-14, RN-PES-007/008, F-15/F-16)

- **Pesagem em sequência** (`/pesagens`): data uma vez; brinco (sem maiúsculas, também o antigo)
  → peso → "Salvar e próximo". Cada pesagem é gravada na hora; sem internet, brinco e peso ficam
  na tela para reenviar. Brinco inexistente oferece "Cadastrar este animal" (com o brinco
  preenchido). Pesados na sessão podem ser corrigidos ou excluídos ali.
- **GMD com período:** `GET /animals/:id/weight-gain` devolve `startDate`/`endDate`; a ficha mostra
  "de … a … (N dias)" e o ganho desde a pesagem anterior em cada linha.
- **Lista do rebanho paginada no servidor:** `GET /animals` devolve `{ items, total, page,
  pageSize, counts }`; `q` busca brinco (atual e antigo), raça e nome da categoria; filtros
  `status`, `category`, `sex`, `lotId` (`none` = sem lote). Telas de seleção pedem até 5.000 de uma vez.

## Painel (D-50 — 2026-10-21)

`GET /dashboard?from=&to=` (padrão: dia 1º do mês corrente até hoje, fuso da fazenda; fim no
futuro vira hoje; período de no máximo 731 dias). Regras de cada número (testadas em
`dashboard.service.test.ts` e `tests/integration/dashboard.test.ts`):

| Número | Regra |
|---|---|
| Animais ativos hoje | situação ativa agora (fora vendidos e mortos) |
| Por categoria / por lote | ativos hoje, agrupados pela categoria (com o sexo) e pelo lote aberto; "sem lote" = ativos − ativos em lote |
| Entradas no período | animais com **data de entrada** no período, por origem. Sem data de entrada, não conta |
| Saídas no período | vendidos e mortos com **data de saída** no período |
| Lembretes | os mesmos de `GET /alerts`: vencidos e os que vencem dentro da antecedência da fazenda, com animal ativo |
| Pesagens no período | pesagens com data no período e quantos animais distintos |
| GMD médio | média simples do GMD de cada animal **ativo** que tem GMD (2+ pesagens em dias diferentes; primeira → última, a mesma conta da ficha). Sem nenhum: "—", nunca zero. Perda de peso entra negativa |

Cada bloco da tela leva à lista que explica o número (rebanho filtrado, lote, manejo). O período
fica no endereço.

## Baixar a lista em planilha (parte da D-46)

Na lista do rebanho, "Baixar CSV" busca no servidor **todos** os animais do filtro atual (só a
fazenda da sessão) e gera a planilha no navegador com os nomes da fazenda: separador `;`, acentos
(BOM UTF-8), datas e pesos no formato brasileiro. Texto que começa com `= + - @` ganha um
apóstrofo (proteção contra **injeção de fórmula** em planilha — `web/src/types/csv.ts`). O "baixar
meus dados" completo (todas as tabelas) e excluir a conta continuam na G6.

## Navegação e padrões de tela (auditoria de interface — 2026-10-18)

O roteador é o de dados do React Router (`createBrowserRouter` em `web/src/App.tsx`), necessário
para o aviso de alterações não salvas (`useBlocker`). Endereço desconhecido mostra `NotFound`.

**Voltar com contexto.** Quem abre uma tela por dentro do sistema deixa a marca de onde veio
(`state.from` = caminho + filtros). `useOpen()` faz isso em botões; `useOriginState()` em `<Link>`.
A tela aberta usa `useOrigin(destinoSeguro)`:

| Ação | Com origem (aberta pelo sistema) | Sem origem (link direto, aba nova, recarregada) |
|---|---|---|
| `goBack()` — voltar, cancelar, depois de editar/excluir | volta uma página no histórico (a tela de origem, com os filtros dela) | vai para o destino seguro, substituindo a entrada |
| `replaceWith(destino)` — depois de criar algo que abre outra tela | troca o formulário pelo destino mantendo a origem | idem, sem origem |

A origem só é aceita se for caminho interno (`safeInternalPath`: começa com `/`, sem `//`, sem `\`,
nunca `/login` ou `/register`, até 2.000 caracteres). Nada de `history.back()` cego: sem origem
conhecida, o destino é sempre uma tela do sistema.

Destinos seguros: ficha do animal → rebanho; edição do animal → ficha; cadastro → rebanho;
aplicação (nova/detalhe) e produtos → manejo; nova negociação → ficha do animal escolhido ou
negociações; detalhe da negociação → negociações; edição da negociação → detalhe.

**Voltar, cancelar e fechar.** "Voltar" (seta no cabeçalho) sai da tela; "Cancelar" sai do
formulário sem gravar; "Fechar" (X) fecha uma janela. Os três respeitam o aviso abaixo.

**Alterações não salvas.** `useUnsavedChanges(dirty)`: com algo digitado, sair por dentro do sistema
pergunta "Descartar as alterações?" (Continuar editando / Descartar); fechar ou recarregar a aba
mostra o aviso do navegador. Depois de salvar, a tela chama `allowLeave()` antes de navegar.
Usado em: cadastro e edição do animal, nova aplicação, produtos, nova negociação, edição da
negociação e Configurações (cada cartão avisa a página).

**Janelas.** `ModalFrame`: `role="dialog"`, título ligado (`aria-labelledby`), foco vai para o
primeiro campo e volta para quem abriu, Esc e clique fora fecham — exceto com algo digitado
(`dirty`) ou gravando (`busy`), quando só "Cancelar" ou X fecham.

**Listas.** Busca, filtros, ordem e página no endereço (`listParams.ts`, com valores validados e
`replace` ao digitar): rebanho (`q`, `status`, `category`, `sort`, `page`), manejo (`type`, `q`, `from`, `to`),
negociações (`type`, `status`, `q`, `from`, `to`, `page`; o antigo `pending=1` ainda funciona),
lotes (`q`, `status`), detalhe do lote (`aba`). Página fora do intervalo vai para a última. Paginação com
janela de páginas (`pageWindow`). Linhas abrem por link de verdade (teclado, nova aba). No celular,
o rebanho vira cartões.

**Estados.** Carregando (`aria-busy`), vazio com orientação e ação, "nenhum resultado" com
"Limpar filtros", falha com `LoadError` ("Tentar de novo") — por tela e por seção. Sucesso por aviso
(`ToastProvider`, `aria-live`).

**Visual.** Cabeçalho `PageHeader` (h1 `text-[26px] md:text-[30px] font-semibold`; "← Voltar" em
texto + sino e menu da conta à direita no computador — `TopBar`), botões `buttonClass`
(`primary`, `secondary`, `danger`, `dangerOutline`), foco visível verde (`:focus-visible` em
`index.css`), animações reduzidas com `prefers-reduced-motion`.

## Identidade visual e kit de interface (referências visuais — 2026-10-21)

- **Logo oficial CampoRico** (decisão da Amanda: só o logo muda; os textos continuam "Rebanho").
  Arquivos em `web/public/brand/`, recortados da folha oficial sem redesenhar nem filtrar:
  `camporico-mark.png` + `camporico-wordmark-dark.png` (menu lateral), `camporico-full-dark.png`
  (tela de entrar/criar conta), `camporico-full-light.png` (só em fundo branco ou quase branco),
  `favicon-32/64.png` e `apple-touch-icon.png`. O antigo `logo.png` continua só como ícone na
  lista do rebanho. Pedir à TG Campo o logo em vetor (SVG) para trocar os PNG.
- **Kit compartilhado** (`web/src/components/ui/`): `StatCard` (indicador: rótulo, número, detalhe,
  regra; inteiro clicável com `to`; no celular sem ícone e dois por linha), `SectionCard`,
  `EmptyState`, `StatusBadge` (texto sempre junto da cor), `IconCircle`, `ActionsMenu` (menu ⋮ por
  portal, Esc volta o foco), `Pagination` ("Mostrando X de Y" + janela de páginas), `PeriodFilter`
  (atalhos + De/Até; `null` = todo o período), `FormSection` (parte numerada de formulário),
  `SexIcon`, `CowIcon` (desenho próprio). `TopBar`: sino → `/manejo` (ponto vermelho = vencido,
  verde = chegando; `useReminderCount`, guardado 60 s e recarregado por `invalidateReminderCount()`
  ao registrar/corrigir/excluir aplicação ou dispensar lembrete). `ScreenError` é o `errorElement`
  de todas as rotas (falha da tela vira página amigável com "Recarregar").
- **Manejo sanitário:** `GET /applications/summary?from&to` → `applications` (no período),
  `animalsTreated` (animais diferentes), `activeAnimals` (hoje), `reminders` {`open`, `overdue`,
  `alertDays`} (mesma regra de `/alerts`) e `products` (não arquivados). `GET /applications` ganhou
  `q` (nome do produto ou brinco) e `createdBy` {`id`, `name`} — nunca o e-mail. "Status" da tabela
  é sempre "Aplicada" (toda aplicação registrada foi aplicada); lembrete aberto aparece no cartão
  de reaplicações.
- **Negociações:** `GET /trades/summary` (mesmos filtros da lista, sem página) → `count`,
  `pending` (aguardando romaneio), `sales`/`purchases` {`count`, `animals`, `total`} com soma exata
  em centavos só do que já tem valor e só na moeda da fazenda (`otherCurrency` conta o resto) —
  função pura `summarizeTrades`. `GET /trades` ganhou `q` (comprador/vendedor ou brinco) e `animal`
  (brinco, sexo, categoria, raça) quando a negociação tem um animal só.
- **Cadastro e edição do animal:** 4 partes numeradas (Identificação, Informações do animal,
  Entrada na fazenda, Observações) + painel de orientação; categoria virou lista que só abre
  depois do sexo (mesma regra da G4).
- Fora por falta de dado real (não inventar): categoria/localização/pasto do lote, nome do animal,
  fotos, CNPJ, setas de variação %, "Importar", Financeiro/Relatórios no menu, aba "Relatórios",
  coluna "Lote" nas negociações.

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

