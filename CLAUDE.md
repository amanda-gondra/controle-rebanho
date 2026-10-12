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
npm test                      # testes (Vitest), na raiz
```

- `DATABASE_URL="postgresql://rebanho:rebanho123@localhost:5433/rebanho?schema=public"`
- Docs interativas (Swagger): `localhost:3333/docs`
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
- **Erros central** (`setErrorHandler` no `server.ts`): Zod→400, Prisma P2002→409, resto→500
  genérico (não vazar detalhe).
- **Mensagens de erro voltam em PORTUGUÊS** (o `message` de `reply.status(...).send(...)` e
  as mensagens dos schemas Zod). O frontend mostra esse texto cru pro pecuarista, então tem
  que ser amigável e em pt-BR. (Rotas mais antigas de v1/v2 ainda têm textos em inglês — migrar
  quando encostar nelas.)
- **Decimal** (`weightKg`) volta como **string** — converter com `Number(...)` no cálculo.
- **Datas** entram como texto ISO (`YYYY-MM-DD`) e viram `Date` na fronteira da rota.
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
  src/server.ts                 sobe o servidor, registra rotas, erros (central)
  src/lib/prisma.ts             conexão única com o banco
  src/schemas/                  Zod: animal.schema, weighing.schema, sanitary.schema, finance.schema
  src/routes/                   animals.routes.ts, sanitary.routes.ts, finance.routes.ts
  src/services/                 weighing.service.ts (GMD), sanitary.service.ts (alertas),
                                finance.service.ts (resultado por animal)
  prisma/schema.prisma          modelagem   |   prisma/seed.ts  dados de exemplo

Frontend (web/):
  src/pages/                    AnimalList, AnimalCreate, AnimalDetail, AnimalEdit,
                                Products, ApplicationCreate, Sanitary, ApplicationDetail
  src/components/               Sidebar, AnimalActionsMenu (menu ⋮ da lista, via portal),
                                modais (Weighing, EditWeighing, Status, Delete,
                                EditApplication, Trade, EstimatedPrice), ToastProvider
  src/services/                 animals.ts, sanitary.ts, finance.ts, api.ts (helper request<T>)
  src/types/                    animal.ts, labels.ts, format.ts (formatAge = idade exata)
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
usuário placeholder — login é v7 —, morros SVG). `GET /animals` passou a devolver
`lastWeighingDate`.

### Schema Prisma (atual)

```prisma
enum Sex { MALE FEMALE }
enum Category { CALF YEARLING STEER COW }
enum Status { ACTIVE SOLD DEAD }
enum BirthDatePrecision { DAY_MONTH_YEAR MONTH_YEAR UNKNOWN }
enum ProductType { VACCINE DEWORMER }

model Animal {
  id String @id @default(uuid())
  tag String @unique
  sex Sex
  breed String?
  category Category
  status Status @default(ACTIVE)
  birthDate DateTime?
  birthPrecision BirthDatePrecision @default(UNKNOWN)
  notes String?
  weighings Weighing[]
  applications ApplicationAnimal[]
  purchase AnimalPurchase?
  sale AnimalSale?
  estimatedPricePerKg Decimal? @db.Decimal(10, 2)  // preço/kg informado p/ animal vivo
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Weighing {
  id String @id @default(uuid())
  animalId String
  animal Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  date DateTime
  weightKg Decimal @db.Decimal(6, 2)
  createdAt DateTime @default(now())
}

model Product {
  id String @id @default(uuid())
  name String
  type ProductType
  applications Application[]
  createdAt DateTime @default(now())
}

model Application {
  id String @id @default(uuid())
  productId String
  product Product @relation(fields: [productId], references: [id])
  date DateTime
  reapplyDate DateTime?
  notes String?
  animals ApplicationAnimal[]
  createdAt DateTime @default(now())
}

model ApplicationAnimal {
  id String @id @default(uuid())
  applicationId String
  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  animalId String
  animal Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  @@unique([applicationId, animalId])
}

// v3.0 — compra e venda: 1 por animal (animalId @unique). Mesma forma: peso × preço/kg.
model AnimalPurchase {
  id String @id @default(uuid())
  animalId String @unique
  animal Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  date DateTime
  weightKg Decimal @db.Decimal(6, 2)
  pricePerKg Decimal @db.Decimal(10, 2)
  notes String?
  createdAt DateTime @default(now())
}

model AnimalSale {
  id String @id @default(uuid())
  animalId String @unique
  animal Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  date DateTime
  weightKg Decimal @db.Decimal(6, 2)
  pricePerKg Decimal @db.Decimal(10, 2)
  notes String?
  createdAt DateTime @default(now())
}
```

### Rotas

```
Animais:    POST /animals · GET /animals (filtros status/category, sortBy, order;
            devolve currentWeightKg + lastWeighingDate da última pesagem)
            GET /animals/:id · PUT /animals/:id · DELETE /animals/:id
            PATCH /animals/:id/status
Pesagens:   POST /animals/:id/pesagens · GET /animals/:id/pesagens
            PUT /animals/:id/pesagens/:weighingId · DELETE /animals/:id/pesagens/:weighingId
            GET /animals/:id/ganho-peso   (422 se < 2 pesagens)
Sanitário:  POST /products · GET /products (filtro type)
            POST /applications · GET /applications (filtro type) · GET /applications/:id
            PUT /applications/:id · DELETE /applications/:id
            GET /alerts   (reaplicações ≤7 dias + vencidas)
            GET /animals/:id/applications
Financeiro: POST/GET/PUT/DELETE /animals/:id/compra   (409 se já existe)
            POST/GET/PUT/DELETE /animals/:id/venda     (POST marca SOLD; DELETE volta ACTIVE;
                                                        409 se animal DEAD ou venda já existe.
                                                        animal SOLD sem venda: registro é aceito)
            PATCH /animals/:id/preco-estimado   (pricePerKg: número ou null p/ limpar)
            GET /animals/:id/resultado   (resultType: REALIZED | ESTIMATED | null)
```

**Padrão-chave da v2 — "aplica em lote, guarda individual":** a aplicação é 1 evento
(`Application`) desdobrado em N registros por animal (`ApplicationAnimal`). Dá histórico
individual (ficha) e por evento (lote). Replicar esse tipo de raciocínio nas próximas versões.

---

## Próxima versão — v3: Financeiro / rentabilidade

Módulo de **rentabilidade** (não contabilidade). Responde "este animal/lote dá lucro?".
Já validado com o produtor (pai da Amanda). Decisões-base dessa validação:

- **Linguagem por quilo/arroba:** o produtor pensa e negocia em preço por kg (peso × preço/kg).
  Conecta com o módulo de pesagens que já existe.
- **Duas dimensões — animal E lote:** modelar em torno das duas. Info necessária por animal
  (pelo brinco) + visão de grupo por lote. Regra de ouro do pai: "as informações necessárias,
  nem turbilhão nem pouco".
- **Preço estimado (animal vivo):** o produtor **informa** o preço do kg (o sistema não chuta);
  resultado "real" é o do animal vendido.
- **Custo liga a 1 animal, a vários (lote) ou é geral;** custo de lote é **rateado
  automaticamente** entre os animais (reaproveita a seleção em lote do manejo sanitário).
- **Escopo é toda a pecuária** do produtor (inclui gastos diversos/experimentais). Agricultura
  e escritório ficam FORA (outro produto).
- **Fora de escopo:** nota fiscal, imposto, banco, cartão, contabilidade formal.

**Cuidado com scope creep:** as ideias grandes (tabela nutricional da ração; gastos de
experimento) entram nas partes finais/candidatas, NÃO na 3.0. Uma parte completa por vez.

### Fatiamento da v3 (mandar uma parte de cada vez)
- **3.0 — Base:** ✅ FEITO. Compra e venda por animal (1 cada, `animalId @unique`); venda marca
  `status=SOLD` em transação e `DELETE` volta `ACTIVE`; só `DEAD` bloqueia (409) o registro de
  venda — animal `SOLD` sem venda registrada ainda aceita "por quanto foi vendido".
  Preço/kg estimado no `Animal` (produtor informa; `null` limpa). `computeAnimalResult` (função
  pura + testes) → `resultType` REALIZED/ESTIMATED/null. Seção "Financeiro" na ficha.
- **3.1 — Custos por categoria:** movimentações de custo (nutrição, sanidade, manejo, outros);
  ligáveis a animal/lote/geral; **rateio automático** por lote.
- **3.2 — Integração sanitária:** vacina/vermífugo ganham **valor + dose** → viram custo automático.
- **3.3 — Lote + dashboard:** resultado agregado por lote; **dashboard financeiro** (investido,
  custos, receitas, resultado no período; custos por categoria; resultado por lote; + rentáveis).
- **3.4 — Estoque de insumos:** saldo, baixa automática a cada uso, aviso de reposição.
- **3.5 — (Candidata) Tabela nutricional da ração:** registrar nutrição e comparar
  prometido × ganho de peso real. Avaliar se entra na v3 ou vira módulo próprio.
- **Testes:** regras novas (resultado, rateio) como funções puras + Vitest.

### Arquitetura de fases (cria/recria/engorda) — decisão que guia daqui pra frente
- A **fase é um atributo do animal** (como `category`), que **muda com o tempo**. NÃO são telas
  separadas — a ficha é uma só, mostrando o que importa pra fase atual.
- As funcionalidades (financeiro, lotes) são **neutras** agora — servem às 3 fases igual. A
  **separação/filtro por fase vem só na v7** (personalização). Construir preparado, sem separar ainda.

### Depois da v3 (ordem do roadmap)
v4 Lotes e pastos → v5 Reprodução/nascimentos (módulo da CRIA) → v6 Dashboard/inteligência
por fase → v7 Cadastro de fazenda + seleção cria/recria/engorda (personalização, por último).

> Detalhamento das partes e checkboxes de progresso: ver "Guia de Execução" no Obsidian da Amanda.