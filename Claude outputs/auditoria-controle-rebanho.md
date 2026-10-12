# Auditoria — Controle Rebanho
**Etapa 1 (Diagnóstico) + Etapa 2 (Plano) + Etapa 3 (Priorização)** — conforme solicitado. Nenhum arquivo do projeto foi alterado.

---

## Resumo executivo

O projeto está mais maduro do que auditorias costumam encontrar em um projeto solo. O `CLAUDE.md` é preciso, atualizado e bate com o código real na quase totalidade do que descreve — isso não é comum, e é uma base ótima pra continuar. O `ROADMAP.md` já é bem sequenciado (v1 → v7) e já tem validação real com o produtor (seu pai) documentada para o módulo financeiro.

Duas descobertas mudam a ordem de prioridade:

1. **Há um problema de higiene do Git que precisa ser resolvido antes de qualquer outra mudança** (crítico — detalhado na seção 2.5). Não é perda de código, mas precisa ser tratado primeiro.
2. **O painel dinâmico que você pediu hoje entra em tensão com o próprio roadmap do projeto**, que sequencia o dashboard como v6 (depois de financeiro completo, lotes e reprodução). A boa notícia: dá pra construir uma primeira versão do painel **agora**, sem quebrar essa sequência — detalho isso na seção 5.

---

## 1. Estado atual por camada

**Backend (`src/`, raiz):** Fastify + TypeScript + Prisma + Zod, rodando em 3 módulos de rotas (`animals`, `sanitary`, `finance`). Validação Zod alimenta o Swagger automaticamente (`/docs`). Erro central trata Zod (400), tag duplicada (409) e genérico (500). Segurança básica registrada (`helmet`, `rate-limit`, `cors`). 1.602 linhas de código entre rotas, schemas e services.

**Frontend (`web/`):** React 19 + Vite + Tailwind 4 + React Router + Recharts. 8 páginas, 9 componentes (a maioria modais), camada de serviços própria (`animals.ts`, `sanitary.ts`, `finance.ts`) sobre um helper `request<T>` central em `api.ts`.

**Banco de dados:** PostgreSQL via Docker Compose (porta 5433). 6 migrations aplicadas, schema com 7 modelos (`Animal`, `Weighing`, `Product`, `Application`, `ApplicationAnimal`, `AnimalPurchase`, `AnimalSale`). Nenhuma migration pendente de gerar.

**Documentação:** `CLAUDE.md` (briefing operacional, ótimo estado), `README.md` (desatualizado — o próprio `ROADMAP.md` já registra isso), `ROADMAP.md` (detalhamento de v3 a v7, bom estado).

**Testes:** Vitest, 19 casos, todos em `src/services/*.test.ts` (funções puras: GMD, alertas sanitários, resultado financeiro). Zero testes de rota/integração, zero testes de frontend, zero CI.

---

## 2. Descobertas da auditoria

### 2.1 O que já está funcionando
- **v1 — Cadastro e pesagens:** CRUD completo de animais, histórico de pesagens, cálculo de GMD (`calculateWeightGain`), busca/ordenação/paginação client-side. Confirmado lendo `animals.routes.ts` linha a linha — bate 100% com o que o `CLAUDE.md` descreve.
- **v2 — Manejo sanitário:** produtos, aplicação em lote (`Application` → `ApplicationAnimal`, o padrão "aplica em lote, guarda individual"), histórico por animal e por evento, alertas de reaplicação (`GET /alerts`), CRUD de aplicações.
- **v3.0 — Financeiro base:** compra/venda por animal (1 cada, `animalId @unique`), venda marca `SOLD` em transação, `DELETE` desfaz para `ACTIVE`, `DEAD` bloqueia venda (409), preço/kg estimado, `computeAnimalResult` com teste.
- **Segurança de rede:** helmet + rate limit (100 req/min) + CORS, registrados antes das rotas.
- **Documentação interativa:** Swagger gerado a partir dos mesmos schemas Zod que validam a request — sem duplicação de contrato.

### 2.2 Parcialmente implementado
- **Redesign da listagem** (branch `feat/redesign-lista-rebanho`): tabela nova, sidebar nova, `GET /animals` já devolve `lastWeighingDate` — mas está numa branch separada, ainda não mesclada em `main`, e como login é v7, a sidebar tem "usuário placeholder".
- **Migração de mensagens de erro para pt-BR:** o próprio `CLAUDE.md` já registra que rotas v1/v2 ainda estão em inglês. Confirmei: são **15 ocorrências** (9 em `animals.routes.ts`, 6 em `sanitary.routes.ts`) contra as mensagens já em português em `finance.routes.ts`. Isso importa porque o frontend mostra esse texto cru para o pecuarista.

### 2.3 Inconsistente ou mal organizado
- **`README.md` desatualizado** — ele mesmo (via `ROADMAP.md`) já se autodiagnostica: lista manejo sanitário e alertas como "próximas etapas", mas isso é v2, já pronto. Quem abre só o README sai com uma visão errada do projeto.
- **URL da API fixa no frontend** (`web/src/services/api.ts`: `const API_URL = "http://localhost:3333"`). Funciona hoje porque tudo roda local, mas trava qualquer deploy — não tem variável de ambiente nenhuma para isso no frontend (o `.env`/`.env.example` só existe na raiz, pro backend).
- **Duas migrations "init" seguidas** (`20260814185443_init` e `20260814200408_init`, 15 minutos de diferença). Não quebra nada — o Prisma trata como sequenciais — mas vale confirmar com você se a primeira devia ter sido corrigida com `migrate dev` de verdade em vez de gerar um segundo "init".

### 2.4 Duplicado ou desnecessário
- `.agents/`, `.claude/`, `.windsurf/` contêm os **mesmos** ~30 arquivos de skill do Prisma, triplicados (um por ferramenta de IA que você usa). Já estão no `.gitignore`, então não sujam o repositório — é só espaço em disco duplicado, não é prioridade mexer.
- `src/sanity.test.ts` é um teste "1+1=2" — só confirma que o Vitest está funcionando, não testa nada do sistema. Pode sair ou virar um teste real (ex.: `GET /health`).

### 2.5 Precisa ser corrigido antes de continuar — **CRÍTICO**
**O working tree atual tem 56 arquivos marcados como modificados, incluindo `package.json`, `tsconfig.json`, `docker-compose.yml` e até migrations já aplicadas — mas ao comparar o `git diff`, a mudança é 100% quebra de linha (LF → CRLF), conteúdo idêntico.** Não existe `.gitattributes` no projeto, então o comportamento de fim de linha depende da configuração do Git de cada máquina/editor que toca o repo — e isso já aconteceu aqui.

Por que isso é crítico e não cosmético:
- Enquanto esse estado não for resolvido, **qualquer diff real fica escondido no meio de ruído** — se você mudar uma linha de verdade agora, o diff dela some no meio de milhares de linhas de troca de fim-de-linha.
- Um `git add -A && commit` nesse estado reescreve a "autoria" de todo o histórico de linha por linha sem necessidade.
- Migrations já aplicadas (`.sql`) tecnicamente não deveriam mudar depois de aplicadas — mesmo sendo só quebra de linha, isso é sinal de que o problema atinge até arquivos que deveriam ser imutáveis.

**Isso precisa ser decidido antes de eu tocar em qualquer outro arquivo** (ver seção 7).

### 2.6 Pode ser aproveitado sem grandes alterações
- Toda a arquitetura de camadas (rotas → schemas → services → Prisma) — é limpa, consistente, e é exatamente o padrão que você quer manter.
- O padrão "aplica em lote, guarda individual" do manejo sanitário — o próprio `CLAUDE.md` já pede pra replicar esse raciocínio nas próximas versões (ex.: rateio de custo por lote no v3.1).
- O schema Prisma atual — modela bem animal individual, sem complexidade prematura de lote (correto, já que lote ainda não foi validado como entidade própria).

### 2.7 Precisa ser refatorado
- **`AnimalDetail.tsx`** é a maior tela do frontend (~776 linhas). Não é um erro, mas é a maior candidata a divisão em subcomponentes conforme ela cresce (a ficha do animal vai ganhar mais seções: financeiro, sanitário, e futuramente lote/fase).
- Nenhum service dedicado para `animals` (a lógica de CRUD fica direto na rota) — isso está correto hoje porque não há regra de negócio pura pra extrair além de validação, mas vale reavaliar se o cadastro ganhar lógica mais complexa (ex.: mudança automática de categoria por idade, mencionada no roadmap v5).

### 2.8 Ainda precisa ser desenvolvido
- **Lote como entidade própria** (v4 — hoje só existe de forma ad-hoc via seleção em `ApplicationAnimal`).
- **Painel dinâmico** (v6 no roadmap) — ver proposta na seção 5.
- **CI** — não existe pipeline (`.github/` não existe no projeto).
- **Scripts de build/typecheck/lint no backend** — o `package.json` raiz só tem `dev`, `test`, `test:watch`. Não tem `build`, `typecheck` nem lint configurado (o `web/` tem `oxlint`; a raiz não tem nada).
- **Autenticação** — corretamente adiada pra v7, conforme decisão já registrada.

---

## 3. Documentação: divergências entre o que está escrito e o código real

| Documento | Situação |
|---|---|
| `CLAUDE.md` | Bate com o código. Verificado contra `server.ts`, `animals.routes.ts`, schema Prisma e rotas — tudo confere. |
| `ROADMAP.md` | Bate, bem estruturado, e já se autoidentifica desatualizado em relação ao README (nota final do próprio documento). |
| `README.md` | **Desatualizado.** Roadmap dele lista v2 (sanitário, alertas) como pendente — já está pronto. Não menciona v3.0 (financeiro) em nenhum lugar. |
| Mensagens de erro | Divergem da própria regra do `CLAUDE.md` ("mensagens voltam em português") em 15 pontos nas rotas mais antigas — já autodocumentado como debt conhecido. |

Não precisa de mais arquivos de documentação novos — os três que existem (`README.md`, `CLAUDE.md`, `ROADMAP.md`) já cobrem bem os papéis certos (apresentação pública / briefing operacional / detalhamento futuro). O trabalho aqui é **atualizar**, não criar.

---

## 4. Alinhamento com a proposta do Controle Rebanho

| Peça da proposta | Status |
|---|---|
| Cadastro por brinco/identificador único | ✅ Pronto (`tag @unique`) |
| Informações básicas e produtivas | ✅ Pronto (sexo, raça, categoria, data de nascimento com precisão variável) |
| Histórico de pesagens | ✅ Pronto |
| Cálculo de ganho de peso e GMD | ✅ Pronto, testado |
| Manejo sanitário | ✅ Pronto (v2 completo) |
| Organização por lotes | ❌ Não existe como entidade — só agrupamento pontual em aplicações sanitárias. Corretamente adiado pra v4. |
| Indicadores para tomada de decisão | ⚠️ Existem **por animal** (resultado financeiro, GMD, alertas) mas não existe visão agregada do rebanho — é exatamente o gap do painel pedido hoje. |

A modelagem atual lida bem com animal individual sem complexidade desnecessária — isso é um acerto de design, não um problema. O ponto de atenção é justamente que ela **ainda não tem uma camada agregada** por cima dos dados individuais, que é o que o painel resolveria.

---

## 5. Painel dinâmico — proposta de arquitetura

**Princípio seguido aqui:** só proponho indicador para o qual o dado já existe ou é uma agregação direta do que já existe — nada de indicador especulativo.

### O que dá pra construir agora, sem mudar o schema
Reaproveitando dados que já existem em `Animal`, `Weighing`, `Product`, `Application`, `AnimalPurchase`/`AnimalSale`:

- **Total de animais cadastrados** e **distribuição por status** (ACTIVE/SOLD/DEAD) — `count`/`groupBy` direto no `Animal`.
- **Distribuição por categoria e sexo** — mesma ideia.
- **Peso atual médio do rebanho** — reaproveita a mesma lógica que já existe em `GET /animals` (`currentWeightKg` = última pesagem).
- **GMD médio do rebanho** — reaproveita `calculateWeightGain`, que já existe e já é testado; precisa só de uma função nova que roda ele pra todos os animais com ≥2 pesagens e tira a média. Lógica pura, testável, no padrão que o projeto já usa.
- **Situação do manejo sanitário** — `GET /alerts` já devolve reaplicações vencidas e próximas; o painel só precisa consumir esse endpoint que já existe.
- **Resultado financeiro agregado** — mesmo raciocínio do GMD: `computeAnimalResult` já existe e é testado por animal; uma função de agregação soma REALIZED/ESTIMATED pra todo o rebanho.

Isso dá pra fazer com **uma rota nova** (ex.: `GET /dashboard/summary`) que só chama e agrega funções que já existem — não é reescrever nada, é compor o que já está pronto.

### O que depende de trabalho ainda não feito
- **Distribuição por lote** — só existe de verdade depois do v4 (Lote como entidade). Tentar forçar isso agora ia contra a decisão já registrada no `ROADMAP.md` de não construir lote "de lado", fora de ordem.
- **Evolução do peso do rebanho ao longo do tempo (agregado, não por animal)** — o dado (`Weighing`) existe, mas a agregação por período (ex.: peso médio por mês) ainda não tem função nem endpoint. É viável, mas é trabalho novo.

### Como isso resolve a tensão com o roadmap
Seu roadmap sequencia o dashboard como **v6**, depois de v3.1–3.5 (financeiro completo), v4 (lotes) e v5 (reprodução) — por um motivo real: um painel de verdade quer indicador por lote e por fase, que só existem depois dessas versões. A proposta acima é uma **v0 do painel**, deliberadamente sem indicador de lote, que não compete com essa sequência — ela só expõe, num painel único, o que os módulos v1/v2/v3.0 já calculam individualmente hoje. Quando o v4 e v6 chegarem, essa v0 vira a base do dashboard completo, não trabalho descartado.

**Isso é uma decisão sua, não uma correção técnica** — ver seção 7.

---

## 6. Priorização

### 🔴 Crítico (bloqueia ou compromete a estrutura)
1. Resolver o estado do Git (linha 2.5) — adicionar `.gitattributes`, normalizar quebra de linha, e decidir o que fazer com as mudanças não commitadas atuais **antes de qualquer outro trabalho**.

### 🟡 Importante (qualidade e coerência)
2. Atualizar `README.md` para refletir v2 e v3.0 (o próprio projeto já pediu isso).
3. Traduzir as 15 mensagens de erro restantes para português (`animals.routes.ts`, `sanitary.routes.ts`).
4. Adicionar variável de ambiente para a URL da API no frontend (`web/.env` + `VITE_API_URL`), preparando para deploy.
5. Adicionar `build`/`typecheck` no `package.json` raiz e configurar lint no backend (hoje só o `web/` tem).
6. Configurar CI básico (rodar `npm test` e typecheck a cada push/PR) — fecha o gap de "sem verificação automática" e é rápido de montar já que os testes existem.
7. Remover ou substituir `src/sanity.test.ts` por um teste real.

### 🟢 Evolutivo (novas funcionalidades e melhorias futuras)
8. Painel dinâmico v0 (seção 5) — indicadores agregados sem lote.
9. Ampliar testes para a camada de rotas (hoje só services têm teste).
10. Refatorar `AnimalDetail.tsx` em subcomponentes conforme a ficha ganhar mais seções.
11. Seguir o roadmap já definido: v3.1 → v3.5 (financeiro completo) → v4 (lotes) → v5 (reprodução) → v6 (dashboard completo) → v7 (fazenda/personalização).

---

## 7. Decisões que preciso da sua aprovação antes de tocar em qualquer código

1. **Git/line endings:** confirmo que a mudança nos 56 arquivos é 100% quebra de linha (já verifiquei 3 amostras). Posso: (a) adicionar `.gitattributes` fixando LF, (b) normalizar os arquivos, e (c) commitar isso separado de qualquer mudança de conteúdo? Antes disso, preciso que você confirme se as mudanças não commitadas atuais na branch `feat/redesign-lista-rebanho` podem ser commitadas como estão (só line-ending) ou se há algo mais que você mudou manualmente nelas que eu deva revisar com mais calma primeiro.
2. **README:** atualizo para refletir v2/v3.0 como já sinalizado no seu próprio `ROADMAP.md`?
3. **Mensagens em inglês:** traduzo as 15 agora, ou prefere deixar para quando "encostar" nessas rotas de novo (como o `CLAUDE.md` já previa)?
4. **Painel dinâmico:** sigo com a v0 proposta (sem lote, reaproveitando o que já existe) ou prefere esperar o v4/v6 do roadmap original?
5. **CI:** ok configurar um pipeline básico (GitHub Actions rodando `npm test`)?

---

## 8. Ordem sugerida de execução (após suas respostas acima)

1. Resolver Git/line endings (crítico, bloqueia visibilidade de qualquer outra mudança).
2. Atualizar README.md.
3. Traduzir mensagens de erro remanescentes.
4. Configurar CI + scripts de build/typecheck/lint na raiz.
5. Construir o painel v0 (rota agregadora + tela).
6. Seguir com o roadmap já definido (v3.1 em diante).

Cada item acima seria uma mudança incremental e isolada, com o código validado antes de passar para o próximo — no mesmo ritmo que o projeto já vem seguindo até aqui.
