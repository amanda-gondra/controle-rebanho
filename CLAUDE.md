# Rebanho — Contexto para o Claude Code

SaaS de **gestão de rebanho de gado de corte**. Projeto de portfólio que nasce para
virar produto. Monorepo: **backend** na raiz + **frontend** em `web/`.

> Documentação completa (história, decisões, visão de produto) fica no Obsidian da Amanda.
> Este arquivo é o briefing operacional. Mantê-lo atualizado ao fim de mudanças relevantes.

---

## Como rodar

```bash
docker compose up -d          # Postgres 16 no Docker (container rebanho-db, porta 5433)
npm run dev                   # backend (Fastify), porta 3333  — rodar na raiz
cd web && npm run dev         # frontend (Vite), porta 5173
npm run test:unit             # testes de unidade (sem banco)
npm run db:test:migrate       # aplica migrations no banco de TESTE (TEST_DATABASE_URL)
npm test                      # unidade + integração (precisa do banco de teste)
npm run dev:claim-initial-farm  # cria login para a "Fazenda inicial" (dados antigos de teste)
```

- Variáveis: ver `.env.example` (só nomes). Validadas ao subir em `src/config/env.ts`.
- Banco de teste: nome **tem** que terminar em `_test` (ver `docs/testing.md`).
- Docs interativas (Swagger): `localhost:3333/docs` (desligadas em produção por padrão)
- Docs técnicas: `docs/architecture.md`, `docs/database.md`, `docs/testing.md`
- Após mexer no `prisma/schema.prisma`: `npx prisma migrate dev --name <nome>` e, se o
  editor não reconhecer os tipos novos, `npx prisma generate` (+ Restart TS Server).

## Stack

- **Backend:** Node.js, Fastify, TypeScript, PostgreSQL, Prisma, Zod, Swagger, Vitest.
  Segurança: helmet, rate-limit, CORS.
- **Frontend:** Vite + React + TypeScript + Tailwind. Recharts, lucide-react, react-router-dom.

## Convenções (importantes)

- **Código, arquivos, rotas e schema em INGLÊS** (padrão de mercado). Termos do gado:
  brinco→`tag`, sexo→`sex`, raça→`breed`, categoria→`category`, pesagem→`weighing`,
  produto→`product`, aplicação→`application`.
- **`type: module`**: imports relativos usam extensão `.js` mesmo em arquivos `.ts`/`.tsx`
  (ex.: `import { x } from "./foo.js"`).
- **Validação com Zod é fonte única**: valida as requisições E gera o Swagger. Todo input
  passa por um schema em `src/schemas/`.
- **Erros:** a rota lança `AppError` (`notFound`, `conflict`, `unprocessable`, `badRequest`
  de `src/lib/errors.ts`); o tratador central (`src/lib/error-handler.ts`) responde
  `{ code, message, errors? }`. O **`code` é o contrato** (ex.: `DUPLICATE_TAG`); o `message`
  em pt-BR existe até a G3 tirar os textos do código. 4xx do Fastify nunca vira 500.
- **Limites de validação** ficam em `src/schemas/common.schema.ts` (coerentes com o banco).
- **Decimal** (`weightKg`) volta como **string** — converter com `Number(...)` no cálculo.
- **Datas** entram como texto ISO (`YYYY-MM-DD`) e viram `Date` com `toDbDate()` (meia-noite UTC).
  "Hoje/futuro/vencido" sempre pelo fuso da fazenda (`src/lib/dates.ts`, padrão D-16).
- **Toda rota tem teste de integração** em `tests/integration/` (banco de teste real).
- **Fazenda (multi-tenant) — regra de ouro:** rota protegida usa **só `request.db`** (já filtrado
  pela fazenda da sessão, `src/lib/tenant.ts`), nunca o `prisma` direto. Em `create`, passar
  `farmId: request.auth.farm.id` (inclusive em criação aninhada). `farmId` NUNCA vem do
  navegador. Toda rota nova entra no teste de acesso cruzado (`tests/integration/tenancy.test.ts`).
- **"Data no futuro"** é conferida na rota com `assertNotInFuture(data, request.auth.farm.timezone, ...)`.
- **Textos da tela (G3):** nunca escrever texto em português direto no JSX: usar
  `t("chave")` de `web/src/i18n/index.ts` e acrescentar a frase em `web/src/i18n/pt-BR.ts`.
  Erro da API: `errorMessage(err)` / `fieldErrorsOf(err)` (`web/src/i18n/errors.ts`) — **nunca**
  mostrar `err.message`. Datas/números/dinheiro só por `types/format.ts` (Intl). `npm run lint`
  em `web/` acusa texto fixo. Para conferir: abrir o app com `?lang=test`.
- **Erro de campo na API** sempre com `code` (+ `params`): `fieldError(campo, código, texto)`;
  em `refine`, `{ message, params: { code } }`.
- **Regra de negócio testável** sai da rota para uma função pura em `src/services/`
  (ex.: `computeWeightGain`, `classifyReapplication`) e ganha teste no `.test.ts` ao lado.

## Preferências de quem toca o projeto (Amanda)

- Código **seguro, limpo, com arquitetura limpa, performático, sem gambiarra**.
- Aprendendo full-stack: prefere **um arquivo por vez**, com **explicação de cada parte**,
  com calma. Ao entregar um arquivo para colar, entregar o **arquivo completo**.
- Construção **em camadas**: banco → backend → frontend. Uma funcionalidade por vez,
  **completa** (nada de deixar pela metade).
- Público final são **pecuaristas**: no frontend, nunca mostrar erro cru; usar mensagens
  amigáveis e estados vazios (ver o mapa de erros na doc do Obsidian).

## Arquitetura de pastas

```
Backend (raiz):
  src/server.ts                 sobe o servidor (config → buildApp → listen; desliga limpo)
  src/app.ts                    buildApp(config): plugins, erros, rotas (sem abrir porta)
  src/config/env.ts             variáveis de ambiente validadas
  src/lib/                      prisma.ts, tenant.ts (filtro por fazenda), auth.ts, session.ts,
                                password.ts, errors.ts, error-handler.ts, dates.ts,
                                farm.ts (configurações: campos, padrões, fusos do Brasil),
                                categories.ts (categorias: regra de sexo e nomes — G4),
                                animal-life.ts (saída e "nada depois da saída" — G5a),
                                trades.ts (negociações: pesagens criadas, desfazer, resposta da API — G5b)
  tests/                        integration/ (rotas), helpers/ (app, banco, factories), setup/
  src/schemas/                  Zod: common (limites), animal, weighing, sanitary, trade, farm, auth
  src/routes/                   auth.routes.ts (público) + animals, sanitary, trades, finance (resultado), farm
  src/services/                 weighing.service.ts (GMD), sanitary.service.ts (alertas),
                                exit.service.ts (saída do animal: o que impede a data — G5a),
                                trade.service.ts (valor de cada animal em centavos exatos; quem pode entrar — G5b),
                                finance.service.ts (resultado por animal: venda − compra, sem custos),
                                animal.service.ts (categoria × sexo e castrado — G4)
  prisma/schema.prisma          modelagem   |   prisma/seed.ts  dados de exemplo

Frontend (web/):
  src/pages/                    Login, Register (públicas) + AnimalList, AnimalCreate, AnimalDetail,
                                AnimalEdit, Products, ApplicationCreate, Sanitary, ApplicationDetail,
                                TradeList, TradeCreate (assistente), TradeDetail, TradeEdit (Negociações — G5b),
                                Settings (Configurações da fazenda)
  src/components/               AuthProvider (useAuth), RequireAuth, AuthLayout, PasswordInput,
                                Sidebar (usuário + sair), AnimalActionsMenu (menu ⋮ da lista, via portal),
                                modais (Weighing, EditWeighing, Status, Delete,
                                EditApplication, Confirm), ToastProvider,
                                TradeDealFields + TradePricesEditor (assistente de negociação), AnimalTradesCard,
                                NewAnimalsEditor (linhas de animais novos na compra em lote — G5c),
                                CategoryPicker (categoria pelo sexo + castrado)
  src/hooks/                    useCategoryLabels (nomes das categorias da fazenda)
  src/i18n/                     index.ts (t()), pt-BR.ts (TODOS os textos), errors.ts (erro da
                                API → frase), RichText (frase com <b>), i18n.test.ts
  src/services/                 auth.ts, animals.ts, sanitary.ts, trades.ts, farm.ts,
                                api.ts (request<T>: manda o cookie; 401 → volta para o login)
  src/types/                    animal.ts, labels.ts, format.ts (formatAge = idade exata),
                                timezones.ts (nomes dos fusos do Brasil), categories.ts
  src/index.css                 tema "campo moderno" (paleta em @theme)
```

## Paleta (classes Tailwind via @theme em web/src/index.css)

`verde #3B6D11` · `verde-escuro #27500A` · `verde-claro #EAF3DE` · `verde-nevoa #D6E8C2`
`bege #F1F0EC` (fundo de todas as telas) · `card #FFFFFF` · `texto #2C2A24` · `texto-suave #6B6459`
`texto-leve #9A8F7C` · `borda #E7E0D2` · `borda-chip #D8CFBD` · `couro #8B6F52` · `alerta #B42318`
`sidebar #152B1C` (fundo do menu lateral) · `sidebar-ativo #37592E` (item de menu ativo)
Uso: `bg-verde`, `text-texto`, `border-borda`, etc. Logo em `web/public/logo.png`
(na sidebar escura, aplicar `[filter:brightness(0)_invert(1)]` pra deixá-la branca).
Cores fora do tema, inline: ícone de sexo `#2E7BD6` (macho) / `#D6478B` (fêmea),
pontinho de status vendido `#D8A200` / morto `#9A8F7C` (ver `web/src/types/labels.ts`).

---

## Estado atual (o que existe)

**Pronto:** v1 (cadastro de animais, pesagens, GMD + gráfico, busca/ordenação, editar/excluir),
v2 (manejo sanitário completo: produtos, aplicação em lote, históricos por animal e por
evento, reaplicação + alertas, CRUD de aplicações) e **v3.0** (financeiro base: compra e venda
por animal — venda marca `status=SOLD` e desfazer volta pra `ACTIVE`; só `DEAD` bloqueia o
registro de venda —, preço/kg estimado informado pelo produtor, resultado por animal na
ficha). Testes: GMD, alertas e resultado.

**Redesign da listagem (branch `feat/redesign-lista-rebanho`, em cima da v3.0):** `AnimalList`
virou tabela (brinco, animal com idade exata, sexo com ícone colorido, raça, peso + data da
última pesagem, status com pontinho, menu ⋮). Filtro/busca/ordenação/paginação agora são
client-side (1 fetch da lista inteira). Sidebar repaginada (verde `sidebar`, item ativo,
usuário logado + botão sair (G1), morros SVG). `GET /animals` passou a devolver
`lastWeighingDate`.

### Banco (resumo — fonte da verdade: `prisma/schema.prisma`)

- Conta: `Farm` (nome, país, fuso + configurações da G2: moeda, unidade, fator da arroba,
  unidade de preço, antecedência do lembrete, castrado padrão) · `User` (1 por fazenda; e-mail único; hash scrypt) ·
  `Session` (hash do token, validade).
- Rebanho, **todos com `farmId`**: `Animal` (brinco único por fazenda; categoria G4 combinando
  com o sexo; `castrated` só machos; saída G5a: `exitDate`, `deathCause`, `deathCauseCertainty`) ·
  `Weighing` (`source` MANUAL/PURCHASE/SALE; uma por animal por dia) ·
  `Product` · `Application` + `ApplicationAnimal` · `Trade` + `TradeItem` (G5b: negociação de compra/venda
  com um item por animal; no máximo 1 compra e 1 venda por animal; item → animal `Restrict`).
- Datas de calendário são `@db.Date`. Dinheiro e peso são `Decimal`.

### Rotas

```
Conta:      POST /auth/register · POST /auth/login · POST /auth/logout   (públicas)
            GET /auth/me                                                (protegida)
Fazenda:    GET /farm · PATCH /farm   (sem id: sempre a fazenda da sessão; G2)
            → TODAS as rotas abaixo exigem login (401 UNAUTHENTICATED / SESSION_EXPIRED)
              e só enxergam a fazenda da sessão (outra fazenda → 404)
Animais:    POST /animals · GET /animals (filtros status/category, sortBy, order;
            devolve currentWeightKg + lastWeighingDate da última pesagem)
            GET /animals/:id · PUT /animals/:id · DELETE /animals/:id
            PATCH /animals/:id/status   (saída: exitDate obrigatória p/ DEAD/SOLD; causa+certeza só DEAD — G5a)
            DELETE: 409 ANIMAL_HAS_TRANSACTIONS se houver compra/venda (D-10)
            PATCH status: 409 ANIMAL_HAS_SALE se houver venda; 409 INVALID_STATUS_TRANSITION
            (morto ↔ vendido direto); 422 EXIT_DATE_CONFLICT (saída antes de pesagem/aplicação/compra/nascimento)
Pesagens:   POST /animals/:id/weighings · GET /animals/:id/weighings
            PUT /animals/:id/weighings/:weighingId · DELETE /animals/:id/weighings/:weighingId
            GET /animals/:id/weight-gain   (422 INSUFFICIENT_WEIGHINGS | SAME_DAY_WEIGHINGS)
            Uma pesagem por animal por dia (409 DUPLICATE_WEIGHING_DATE); nada depois da saída
            (422 WEIGHING_DATE_OUT_OF_RANGE); só source=MANUAL edita/apaga (409 WEIGHING_FROM_TRADE)
Sanitário:  POST /products · GET /products (filtro type)
            POST /applications · GET /applications (filtro type) · GET /applications/:id
            PUT /applications/:id · DELETE /applications/:id
            (422 ANIMALS_NOT_IN_HERD_ON_DATE se algum animal já tinha saído na data)
            GET /alerts   (reaplicações dentro da antecedência da fazenda — padrão 7 dias — + vencidas)
            GET /animals/:id/applications
Negociações (G5b): POST /trades (compra/venda de 1 ou muitos animais; idempotencyKey; o servidor
            calcula os valores; 422 TRADE_ITEM_ERRORS com erro por linha `items.N.animalId`;
            na compra, a linha pode trazer `newAnimal` {tag, sex, category, castrated?, breed?} —
            o animal é cadastrado junto (G5c); brinco repetido → `items.N.newAnimal.tag` DUPLICATE_TAG)
            GET /trades (type, from, to, pending, page, pageSize) · GET /trades/:id
            GET /trades/last-prices (último preço por categoria — só referência)
            PATCH /trades/:id (corrige; recalcula; peso de carcaça pendente) ·
            DELETE /trades/:id/items/:itemId (tira um animal) · DELETE /trades/:id (desfaz)
            GET /animals/:id/result   (kind: DIFFERENCE | INVESTED | SALE_ONLY | PENDING | CURRENCY_MISMATCH)
Saúde:      GET /health (processo) · GET /ready (banco)
```

**Padrão-chave da v2 — "aplica em lote, guarda individual":** a aplicação é 1 evento
(`Application`) desdobrado em N registros por animal (`ApplicationAnimal`). Dá histórico
individual (ficha) e por evento (lote). Replicar esse tipo de raciocínio nas próximas versões.

---

## Próximos passos

O plano oficial é a **Release 1.0** no Obsidian ("Escopo Release 1.0" e "Guia de Execução"):
Parte B (base corrigida) → **G1** (fazenda, usuário, login, `farmId`) → G2 → G4 → G3 → G5 → G6.
O antigo roadmap v3–v7 deste arquivo foi substituído por ele.

**Fase 3 (fundação técnica, 2026-10-12):** app factory, config validada, códigos de erro,
limites, fuso da fazenda, GMD no mesmo dia, D-06/D-10 na API, seed seguro, rotas em inglês,
testes de integração de todas as rotas e CI com Postgres.

**G1 (2026-10-12):** fazenda, usuário, login com sessão em cookie (D-23), senha scrypt (D-24),
telas de entrar/criar conta/sair (D-25), `farmId` em tudo + filtro único, testes de acesso
cruzado. Falta: recuperação de senha (precisa de e-mail), chaves compostas `[id, farmId]` (🟡).

**G2 (2026-10-13):** configurações da fazenda (`GET/PATCH /farm`, tela "Configurações"):
nome, fuso (só Brasil — D-31), antecedência do lembrete (vale na hora em `/alerts`); moeda e
unidade fixas na 1.0 (D-30). Fator da arroba, unidade de preço e castrado padrão já ficam
guardados, mas os cartões só aparecem com a G5/G4; nomes das categorias entram na G4.
`request.auth.farm.settings` traz as configurações em toda rota protegida.

**G4 (2026-10-13):** categorias `CALF HEIFER COW YEARLING ADULT_MALE BULL` (D-02) com regra de
sexo na API e no banco; campo `castrated` (só machos; padrão da fazenda); nomes das categorias
personalizáveis (Configurações → Animais; `useCategoryLabels` no frontend). Nunca escrever o
nome da categoria fixo numa tela: usar `labelOf(category, sex)`. Migração converte os dados
antigos e para se houver "vaca macho"/"boi fêmea".

**G3 (2026-10-13):** textos da tela em `web/src/i18n/pt-BR.ts` (só pt-BR publicado; idioma de
teste `?lang=test` em desenvolvimento), erros traduzidos pelo `code` (inclusive por campo, com
`params`), datas/números/dinheiro por `Intl`, nomes padrão de categoria e fusos na tradução,
conferência automática de texto fixo no `npm run lint` do web.

**G5 entrega 1 — G5a (2026-10-13):** saída do animal (D-27): data de saída obrigatória para morto
e vendido; na morte, causa (texto livre, opcional) + certeza (confirmada/suspeita/não informada);
corrigir a saída ou voltar para ativo (engano). Nada depois da saída: pesagem e aplicação
recusadas. Pesagem com origem (`source`) e uma por animal por dia (D-33). Ficha mostra a faixa
"Saiu em …" e desliga "Registrar pesagem". Falta na G5: negociações (`Trade`), pesagens de
compra/venda criadas por elas, linha do tempo (D-28).

**G5 entrega 2 — G5b (2026-10-14):** negociações no modelo definitivo (`Trade` + `TradeItem`, D-03/D-08):
preço por kg, por arroba (carcaça ÷ 15 ou peso vivo ÷ fator gravado na negociação) ou por cabeça;
venda e compra em lote com preço por categoria (ajuste para marcados ou por animal); valores em
centavos exatos no servidor; peso vivo vira pesagem (troca a manual do dia — D-37); carcaça
pendente (D-35); tirar animal e desfazer; resultado venda − compra sem custos; valor estimado
removido (D-09); dados antigos migrados. Telas: menu "Negociações", assistente em 3 passos,
detalhe, correção, cartão em Configurações.

**G5 entrega 3 — G5c (2026-10-14):** compra em lote que cadastra os animais (D-36, RN-NEG-015): cada
linha da compra pode ser um animal novo (brinco, categoria — o nome já diz o sexo —, castrado,
raça), criado na mesma transação com as regras do cadastro; brinco repetido (na fazenda ou na
lista) volta como erro da linha; desfazer a compra não apaga os animais criados. Com isso a G5
está completa; fica para depois só a linha do tempo do animal (D-28).
