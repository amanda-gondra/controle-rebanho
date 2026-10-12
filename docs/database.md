# Banco de dados, migrations e ambientes

> Estado em 2026-10-12.

## Banco (atual)

PostgreSQL 16 via Prisma 6. Sete tabelas: `Animal`, `Weighing`, `Product`, `Application`,
`ApplicationAnimal`, `AnimalPurchase`, `AnimalSale`. Ainda **sem** `farmId`, sem índices
nas chaves estrangeiras (F-15) e com datas de calendário em `timestamp` (F-17) — essas
mudanças entram junto com a migração da G1, para não mexer no schema duas vezes.

Integridade garantida hoje:

| Regra | Onde |
|---|---|
| Brinco único | banco (`@unique`) + erro `DUPLICATE_TAG` |
| Uma compra e uma venda por animal | banco (`animalId @unique`) + checagem na rota |
| Mesmo animal uma vez por aplicação | banco (`@@unique`) + schema recusa ids repetidos |
| Animal com compra/venda não é excluído (D-10) | rota, numa instrução só (`deleteMany` com filtro) |
| Venda não anterior à compra (D-06) | rota (compra e venda, POST e PUT) |
| Venda + status `SOLD` juntos | transação |

⚠️ No banco, `AnimalPurchase` e `AnimalSale` ainda têm `onDelete: Cascade` (F-05). A
proteção hoje é da aplicação; a garantia no banco vem com o modelo `Trade` (G5), que já
nasce com `Restrict`.

## Migrations

Seis migrations em `prisma/migrations/` (de 14/08 a 07/09/2026). A segunda `init` recriou as
tabelas (F-29) — fica como está: **não reescrever migrations já aplicadas**.

Procedimento:

1. Desenvolvimento: altere `prisma/schema.prisma` e rode `npx prisma migrate dev --name <nome>`.
   Revise o SQL gerado antes de commitar.
2. Teste: `npm run db:test:migrate` aplica as migrations no banco de teste (`migrate deploy`).
3. CI (a cada PR): aplica as migrations do zero num Postgres descartável **e** confere que
   elas produzem exatamente o `schema.prisma` (`prisma migrate diff --exit-code`).
4. Produção (quando existir): só `npx prisma migrate deploy`. Nunca `migrate dev`,
   `migrate reset` ou `db push` em produção. Mudança destrutiva em etapas
   (adicionar → migrar dados → remover depois).

Verificado em 2026-10-12: as 6 migrations aplicam sem erro, em ordem, num PostgreSQL 16 vazio.

## Ambientes

| Ambiente | Banco | Situação |
|---|---|---|
| Local (desenvolvimento) | Docker `rebanho-db`, porta 5433 | existe; só dados de teste |
| Teste automatizado | banco separado com nome `*_test` | existe no CI; local: criar (abaixo) |
| Staging / produção | — | **não existem** (G6) |

Criar o banco de teste local (uma vez):

```bash
docker exec rebanho-db createdb -U rebanho rebanho_test
# no .env: TEST_DATABASE_URL apontando para .../rebanho_test
npm run db:test:migrate
```

## Variáveis de ambiente

Lista completa (só nomes e formato) em `.env.example`. Validadas em `src/config/env.ts`.

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | banco da aplicação |
| `TEST_DATABASE_URL` | para testes | banco de teste (nome `*_test`) |
| `NODE_ENV` | não | `development`/`test`/`production` |
| `HOST`, `PORT` | não | onde o servidor escuta |
| `CORS_ORIGINS` | não | origens do frontend, separadas por vírgula |
| `API_DOCS_ENABLED` | não | liga `/docs` (padrão: desligado em produção) |
| `LOG_LEVEL` | não | nível de log |
| `RATE_LIMIT_MAX` | não | requisições/minuto por IP |

A senha do Postgres em `docker-compose.yml` é **só do banco local de desenvolvimento** e
nunca deve ser usada em outro ambiente.

## Backup e restauração

**Não há backup configurado nem testado.** Hoje o banco local tem apenas dados de teste.
Antes de qualquer dado real (G6): backup automático do provedor, retenção definida e um
teste de restauração em outro banco — só então o backup conta como confiável.

O comando de dados de exemplo (`npx prisma db seed`) **não apaga nada**: recusa rodar em
produção e em banco que já tenha dados (F-02).
