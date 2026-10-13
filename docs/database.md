# Banco de dados, migrations e ambientes

> Estado em 2026-10-13 (G4).

## Banco (atual)

PostgreSQL 16 via Prisma 6. Tabelas de conta: `Farm`, `User`, `Session`. Tabelas do rebanho
(todas com `farmId`): `Animal`, `Weighing`, `Product`, `Application`, `ApplicationAnimal`,
`AnimalPurchase`, `AnimalSale`. Datas de calendário em `DATE` (F-17) e índices nas chaves e
nos filtros mais usados (F-15) — ambos vieram na migração da G1.

Integridade garantida hoje:

| Regra | Onde |
|---|---|
| Brinco único **por fazenda** | banco (`@@unique([farmId, tag])`) + erro `DUPLICATE_TAG` |
| E-mail único (minúsculas) | banco (`@unique`) + erro `EMAIL_ALREADY_REGISTERED` |
| Um usuário por fazenda (Release 1.0) | banco (`User.farmId @unique`) |
| Dado de uma fazenda invisível para outra | `forFarm` + testes de acesso cruzado |
| Uma compra e uma venda por animal | banco (`animalId @unique`) + checagem na rota |
| Mesmo animal uma vez por aplicação | banco (`@@unique`) + schema recusa ids repetidos |
| Animal com compra/venda não é excluído (D-10) | rota, numa instrução só (`deleteMany` com filtro) |
| Venda não anterior à compra (D-06) | rota (compra e venda, POST e PUT) |
| Venda + status `SOLD` juntos | transação |
| Categoria combina com o sexo (G4 — D-02) | API (`resolveAnimalProfile`) + banco (`CHECK Animal_category_sex_check`) |
| Castrado só em machos (G4) | API + banco (`CHECK Animal_castrated_male_only_check`) |
| Animal ativo não tem data de saída; morto/vendido tem (G5a — D-27) | API + banco (`CHECK Animal_active_without_exit_check`) |
| Causa e certeza da morte só em animal morto; causa até 200 letras (G5a) | API (Zod) + banco (`CHECK Animal_death_fields_check`, `Animal_deathCause_length_check`) |
| Saída não antes de nascimento, compra, pesagem ou aplicação (RN-ANIMAL-011) | API (`assertExitDateAllowed`) |
| Nada depois da saída: pesagem e aplicação (RN-ANIMAL-012 / RN-PES-004) | API (`assertWeighingDateAllowed`, `assertAnimalsInHerdOnDate`) |
| Uma pesagem por animal por dia (G5a — D-33) | banco (`@@unique([animalId, date])`) + erro `DUPLICATE_WEIGHING_DATE` |
| Pesagem vinda de compra/venda não é editada nem apagada à mão (RN-PES-009) | API (`WEIGHING_FROM_TRADE`) |
| Configurações da fazenda dentro dos limites (G2) | API (Zod) + banco (`CHECK`: fator da arroba > 0, antecedência 0–60, moeda com 3 letras, unidade kg/lb) |

⚠️ No banco, `AnimalPurchase` e `AnimalSale` ainda têm `onDelete: Cascade` (F-05). A
proteção hoje é da aplicação; a garantia no banco vem com o modelo `Trade` (G5), que já
nasce com `Restrict`.

## Migrations

Dez migrations em `prisma/migrations/`. A segunda `init` recriou as tabelas (F-29) — fica
como está: **não reescrever migrations já aplicadas**.

**G1 (`20261012180000_g1_farm_user_session`)** — gerada pelo Prisma e ajustada à mão para não
perder dados: cria `Farm/User/Session`; **se o banco já tiver dados do protótipo**, cria a
"Fazenda inicial (dados do protótipo)" (id `00000000-0000-4000-8000-000000000001`) e coloca
todos os registros nela; só então torna `farmId` obrigatório; converte as datas para `DATE`;
troca o brinco único global por único por fazenda. Testada nos dois cenários (banco com dados
antigos e banco vazio). Para entrar na fazenda inicial: `npm run dev:claim-initial-farm`.

**G2 (`20261013000000_g2_farm_settings`)** — só **adiciona** colunas de configuração em `Farm`
(todas com padrão; nenhuma fazenda existente muda) e o tipo `PriceUnit`. As restrições `CHECK`
foram escritas à mão no fim do arquivo: o Prisma não as representa no schema e também não as
apaga.

**G4 (`20261013120000_g4_categories`)** — numa transação só: (1) **para sem mudar nada** se
existir animal com categoria antiga que não combina com o sexo ("vaca" macho ou "boi" fêmea) e
diz quantos são; (2) converte as categorias — `YEARLING` macho → `YEARLING` (garrote), `YEARLING`
fêmea → `HEIFER`, `STEER` → `ADULT_MALE`, `CALF`/`COW` iguais; (3) cria `castrated` (machos que já
existem → `false`, o padrão D-21; fêmeas → vazio); (4) cria `Farm.categoryLabels`; (5) `CHECK`s.
Testada com dados antigos (conversão) e com um "vaca macho" (para sem alterar nada).

**G5a (`20261013150000_g5a_exit_and_weighing_source`)** — numa transação só: (1) **para sem
mudar nada** se algum animal tiver mais de uma pesagem no mesmo dia e diz quantos dias são
(a pessoa decide qual manter; nada é apagado pela migration); (2) cria `Animal.exitDate`,
`deathCause`, `deathCauseCertainty` (tipo `DeathCauseCertainty`); (3) preenche a data de saída
dos vendidos com a data da venda registrada; mortos antigos ficam sem data e com certeza
"não informada"; (4) cria `Weighing.source` (tipo `WeighingSource`, padrão `MANUAL`); (5) troca o
índice de pesagem por um único `[animalId, date]`; (6) `CHECK`s. Testada com dados antigos
(conversão) e com pesagens repetidas (para sem alterar nada).

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
| `AUTH_RATE_LIMIT_MAX` | não | tentativas de entrar/criar conta por minuto por IP |
| `COOKIE_SECURE` | não | cookie só por HTTPS (padrão: ligado em produção) |

A senha do Postgres em `docker-compose.yml` é **só do banco local de desenvolvimento** e
nunca deve ser usada em outro ambiente.

## Backup e restauração

**Não há backup configurado nem testado.** Hoje o banco local tem apenas dados de teste.
Antes de qualquer dado real (G6): backup automático do provedor, retenção definida e um
teste de restauração em outro banco — só então o backup conta como confiável.

O comando de dados de exemplo (`npx prisma db seed`) **não apaga nada**: recusa rodar em
produção e em banco que já tenha dados (F-02). Ele cria uma fazenda e um usuário com
`SEED_USER_EMAIL`/`SEED_USER_PASSWORD` (a senha nunca fica no código).
