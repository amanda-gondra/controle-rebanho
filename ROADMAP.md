# Rebanho — Próximas versões

Documento de apoio ao `CLAUDE.md`: aqui ficam as próximas versões detalhadas, uma de cada vez, seguindo o mesmo padrão já estabelecido no projeto — construção em camadas (banco → backend → frontend), uma funcionalidade completa por vez, regra de negócio testável isolada em `src/services/`.

## O que já está pronto

- **v1** — cadastro de animais, pesagens, GMD + gráfico, busca/ordenação, editar/excluir.
- **v2** — manejo sanitário completo: produtos, aplicação em lote (`Application` → `ApplicationAnimal`), histórico por animal e por evento, reaplicação + alertas, CRUD de aplicações.
- **v3.0** — financeiro base: compra e venda por animal (`AnimalPurchase`/`AnimalSale`, 1 cada); registrar venda marca `status=SOLD` (transação) e desfazer volta `ACTIVE`; só animal `DEAD` bloqueia o registro de venda (animal já `SOLD` sem venda ainda pode registrar por quanto foi vendido); preço/kg estimado informado pelo produtor; resultado por animal na ficha (`computeAnimalResult`, função pura + testes).

O padrão-chave que a v2 estabeleceu — **"aplica em lote, guarda individual"** — é a referência de raciocínio pras próximas versões que também envolvem grupo de animais.

---

## v3 — Financeiro / rentabilidade
*Já validado com o produtor (seu pai). Responde: "este animal/lote dá lucro?" — não é contabilidade.*

- **3.0 — Base:** ✅ registrar compra (peso + preço/kg) e venda do animal; resultado por animal na ficha; preço estimado informado pelo produtor (o sistema não chuta).
- **3.1 — Custos por categoria:** movimentações de custo (nutrição, sanidade, manejo, outros), ligáveis a animal/lote/geral; rateio automático por lote.
- **3.2 — Integração sanitária:** vacina/vermífugo ganham valor + dose → viram custo automático, conectando com o que já existe do v2.
- **3.3 — Lote + dashboard:** resultado agregado por lote; dashboard financeiro (investido, custos, receitas, resultado no período; custos por categoria; resultado por lote; mais rentáveis).
- **3.4 — Estoque de insumos:** saldo, baixa automática a cada uso, aviso de reposição.
- **3.5 — (Candidata) Tabela nutricional da ração:** registrar nutrição e comparar prometido × ganho de peso real — avaliar se entra aqui ou vira módulo próprio.

Fora de escopo do v3, por decisão já tomada: nota fiscal, imposto, banco, cartão, contabilidade formal, agricultura e escritório.

---

## v4 — Lotes e pastos
*Rascunho — vale validar com seu pai antes de começar, do mesmo jeito que o v3 foi validado.*

Hoje "lote" só existe de forma solta (a seleção feita numa aplicação sanitária). O v4 formaliza lote como entidade própria, ligada à divisão física da propriedade.

- **4.0 — Base:** cadastro de lote (nome, e opcionalmente pasto/área associada); cada animal pertence a um lote por vez.
- **4.1 — Cadastro de pasto:** área, capacidade estimada, lote associado no momento.
- **4.2 — Movimentação entre lotes/pastos:** registro de transferência com data, histórico de onde cada animal esteve — mesmo raciocínio de histórico que já existe pra pesagem e sanidade.
- **4.3 — Visão agregada por lote:** quantidade de animais, peso médio, composição por categoria/sexo.
- **4.4 — Alertas de lotação:** superlotação de pasto, tempo de descanso (se fizer sentido pro tipo de manejo do seu pai — perguntar antes de construir).

---

## v5 — Reprodução e nascimentos (módulo CRIA)
*Rascunho — depende de decisões de domínio (período de gestação considerado, o que conta como "vazia") que só seu pai confirma.*

- **5.0 — Base:** registrar cobertura/inseminação (fêmea, data, tipo) e nascimento — o bezerro já nasce vinculado à mãe (e ao pai, se conhecido).
- **5.1 — Acompanhamento de gestação:** data prevista de parto a partir da cobertura; status da fêmea (prenha, parida, vazia).
- **5.2 — Indicadores por fêmea:** taxa de prenhez, intervalo entre partos, histórico reprodutivo.
- **5.3 — Desmame:** conecta com o módulo de pesagem que já existe (peso ao desmame) e, se fizer sentido, muda a categoria do animal automaticamente.
- **5.4 — Alertas reprodutivos:** previsão de parto próxima, fêmeas vazias há muito tempo.

---

## v6 — Dashboard e inteligência por fase
*Rascunho — é aqui que a "arquitetura de fases" (nota do CLAUDE.md: fase é atributo do animal, não tela separada) entra em ação de verdade.*

- **6.0 — Dashboard geral:** reúne os módulos já prontos (pesagem, sanidade, financeiro) num painel único — efetivo total, composição do rebanho, GMD médio, resultado financeiro do período.
- **6.1 — Segmentação por fase:** os mesmos indicadores, agora filtráveis por fase (cria/recria/engorda) — é o momento em que a separação por fase, propositalmente adiada até aqui, é ativada.
- **6.2 — Alertas cruzados:** combinações entre módulos (ex.: animal com GMD abaixo da média do lote + custo do lote acima do esperado).
- **6.3 — (Candidata) Indicadores preditivos com ML:** é o encaixe natural das ideias de machine learning que fazem parte do seu perfil — mas só depois de ter dado real acumulado nas versões anteriores, sem isso não tem o que modelar.

---

## v7 — Cadastro de fazenda e personalização
*Última etapa por design — é o ponto em que o produto deixa de ser "feito pro seu pai" e vira algo que dá pra vender pra outro produtor.*

- **7.0 — Cadastro de fazenda/propriedade:** dados da propriedade — nome, área, localização.
- **7.1 — Seleção do perfil da operação:** o produtor escolhe se opera cria, recria, engorda, ou o ciclo completo; o sistema mostra só os módulos e indicadores relevantes pra esse perfil.
- **7.2 — Personalização de terminologia/categoria** por região ou tipo de operação, se necessário.
- **7.3 — (Candidata) Multi-propriedade/multi-usuário:** só entra quando for vender pra além do seu pai — é o ponto de conexão com a conversa sobre comercializar o Rebanho pela TG Campo.

---

## O que ajustar antes de seguir

O `README.md` ficou um passo atrás do `CLAUDE.md`: o roadmap dele ainda lista manejo sanitário, vacinas/vermífugos e alertas como pendentes ("Próximas etapas"), mas isso já está pronto (v2). Vale atualizar o checklist do README pra refletir v1 e v2 concluídos, e trocar a lista solta de "próximas etapas" por uma referência a este documento — assim quem abrir só o README não fica com uma visão desatualizada do projeto.
