# Testes

## Dois grupos

| Grupo | Onde | Precisa de banco? | Comando |
|---|---|---|---|
| Unidade | `src/**/*.test.ts` | não | `npm run test:unit` |
| Integração | `tests/integration/*.test.ts` | sim, banco de **teste** | `npm run test:integration` |

`npm test` roda os dois. O CI roda os dois a cada PR, num Postgres descartável.

## Como os testes de integração funcionam

- `buildApp()` monta a API sem abrir porta; os testes chamam `app.inject()`.
- `tests/setup/integration.ts` troca a `DATABASE_URL` pela `TEST_DATABASE_URL` **antes** de
  qualquer import.
- Proteções contra apagar o banco errado:
  1. `TEST_DATABASE_URL` precisa existir, ter nome terminado em `_test` e ser diferente da
     `DATABASE_URL` (senão os testes nem começam);
  2. antes de esvaziar as tabelas, o próprio banco confirma `current_database()` com `_test`.
- O banco é esvaziado antes de **cada** teste (`resetDatabase`); os arquivos rodam um de cada vez.
- Os cenários são montados **pela API** (`tests/helpers/factories.ts`), o mesmo caminho do usuário.
- Nenhum dado real é usado.

## O que está coberto (2026-10-12)

- Todas as rotas atuais: animais, pesagens, ganho de peso, produtos, aplicações, alertas,
  compra, venda, preço estimado e resultado.
- Entradas inválidas: limites, casas decimais, datas futuras no fuso da fazenda, campos
  desconhecidos, IDs que não são UUID, JSON malformado, corpo grande, mídia errada.
- Manipulação de ID: pesagem de outro animal via URL → 404, sem alterar nada.
- Integridade: exclusão bloqueada com compra/venda, cascata de pesagens, venda + status em
  transação, duas vendas simultâneas (só uma grava), venda antes da compra.
- Plataforma: configuração inválida (sem vazar valores), CORS por lista, 429, `/docs` desligado,
  cabeçalhos de segurança, proteção do banco de teste.

## Histórico, lotes, sanitário, painel (2026-10-18 a 2026-10-21)

- Regras puras: `animal-history.service.test.ts` (o que vira evento), `lot.service.test.ts`
  (quando mover é recusado), `sanitary.service.test.ts` (carência, lembrete aberto),
  `weighing.service.test.ts` (período do GMD, ganho desde a anterior), `dashboard.service.test.ts`
  (período e GMD médio), `web/src/types/csv.test.ts` (planilha e injeção de fórmula),
  `web/src/types/dashboard.test.ts` (atalhos de período), `web/src/types/history.test.ts`.
- Integração: `history.test.ts` (brinco sem maiúsculas, troca, linha do tempo, autor, trilha que
  não se edita), `sanitary-complete.test.ts`, `lots-and-list.test.ts`, `dashboard.test.ts` (cada
  número confere com a regra), `database-guards.test.ts` (índices e gatilhos fora do schema), e
  `tenancy.test.ts` ampliado (lotes, painel, histórico, troca de brinco, produtos, lembretes).
- Ponta a ponta (navegador real, banco de teste, scripts fora do repositório): pesagem em
  sequência (3 animais, brinco minúsculo, repetida, inexistente), troca de brinco e busca pelo
  antigo, lotes (colocar, mudança recusada antes da entrada, transferência, histórico, filtro,
  arquivar desligado), painel (números = API, período no endereço, voltar mantém o período), CSV
  (cabeçalho, lote, peso "395,5"), sanitário (produto com carência, dose, aviso de carência na
  venda, dispensar lembrete, arquivar), celular 360 px nas telas novas.

## Navegação e interface (auditoria — 2026-10-18)

- `web/src/navigation/origin.test.ts`: origem aceita/recusada (externa, `//`, `\`, login,
  tamanho), seção ativa do menu.
- `web/src/navigation/listParams.test.ts`: leitura validada dos filtros do endereço, valores
  padrão omitidos, janela de páginas.
- Ponta a ponta (navegador real, banco de teste, script fora do repositório): os 10 fluxos de
  navegação — lista com filtros/página → animal → voltar; link direto → destino seguro; editar →
  cancelar; alteração não salva (ficar/descartar/recarregar); salvar → ficha → voltar não reabre o
  formulário; cadastro a partir da lista filtrada; manejo → aplicação → animal → voltar; venda a
  partir da ficha; negociações filtradas; janela de pesagem (Esc, clique fora, X, foco) — mais erro de
  carga com "Tentar de novo", celular 360px sem rolagem lateral em 7 telas e console sem erros.

## Textos da tela (G3)

- `tests/integration/validation-codes.test.ts`: todo erro de campo traz `code` (e `params`
  quando precisa), para cada tipo de problema (vazio, longo, formato, data futura, casas
  decimais, lista vazia/repetida, filtro na URL, regra de negócio).
- `web/src/i18n/i18n.test.ts` (projeto **web-unit** do Vitest): plural, troca de valores,
  **todo código de erro da API tem tradução**, erro de campo usa os números da regra, erro sem
  resposta = sem conexão, e a tela decide pelo `code`, nunca pelo `message`.
- `npm run lint` em `web/` inclui `scripts/check-i18n.mjs` (texto fixo no código das telas).
- Verificação manual com o idioma de teste (`?lang=test`): percorrer as telas e janelas e
  conferir que só aparecem chaves `⟦...⟧`, dados digitados, números e datas (feito em
  2026-10-13 em todas as telas, janelas e num erro vindo da API).

## Negociações (G5b)

- `tests/integration/trades.test.ts`: venda em lote com preços por categoria (valores, total,
  vendidos com a saída, pesagens), linha com problema não grava nada (e diz o motivo de cada
  linha), valor do navegador ignorado, arroba de carcaça e de peso vivo (fator gravado não muda
  quando a fazenda muda), por cabeça sem pesagem, carcaça pendente e completada, morto / já
  vendido / venda antes da compra / saída com pesagem depois, pesagem manual do dia trocada,
  compra (uma por animal, datas), formas de preço inválidas, envio repetido e simultâneo (uma
  negociação), duas vendas do mesmo animal ao mesmo tempo, corrigir / tirar animal / desfazer,
  excluir animal com negociação recusado (também no banco), listar, último preço e resultado.
- Compra em lote com animais novos (G5c): 10 linhas com um brinco já existente → nada gravado e
  erro na linha 5; corrigida, cria os 10 animais + a compra + as pesagens; brinco repetido na
  lista, categoria que não combina e castrado em fêmea apontam a linha certa; padrão "castrado"
  da fazenda; mistura de novos e já cadastrados; animal novo numa venda recusado; mesmo brinco
  em outra fazenda permitido; desfazer não apaga os animais; envio repetido não duplica.
  Navegador (2026-10-14): 5 animais novos com "Repetir a anterior" e "linhas iguais à anterior",
  erros por linha antes de enviar, compra gravada (R$ 28.200,00), desfazer mantém os animais,
  celular 360 px e idioma de teste limpos.
- Acesso cruzado: todas as rotas de `/trades` em `tenancy.test.ts` (ver, corrigir, tirar,
  desfazer, incluir animal de outra fazenda).
- `src/services/trade.service.test.ts`: as 4 formas, centavos (333,33 × 10,01), arredondamento,
  limites, soma, quem pode entrar. `src/services/finance.service.test.ts`: os casos do resultado.
- `web/src/types/tradeMath.test.ts`: a prévia da tela dá **o mesmo valor do servidor** em todas
  as combinações; `tradeForm.test.ts`: conferência do formulário e erros por linha.
- Verificado no navegador em 2026-10-14: venda de 5 animais (2 categorias, 1 preço ajustado,
  total R$ 45.958,25 igual ao do servidor), animal morto apagado no seletor, erro por linha,
  troca da pesagem manual do dia, tirar animal, desfazer, compra pela ficha e diferença
  "R$ 4.800,00 — não inclui custos", arroba de carcaça aguardando romaneio e completada
  (R$ 5.400,00), cartão Negociações em Configurações, celular 360 px sem rolagem lateral e
  idioma de teste limpo.

## Saída do animal e pesagens (G5a)

- `tests/integration/exit.test.ts`: morte com data/causa/certeza, vendido sem venda, data
  obrigatória e não no futuro, conflito com pesagem/aplicação/nascimento (diz qual e a data),
  no mesmo dia pode, corrigir a saída, voltar para ativo (limpa tudo), morto ↔ vendido recusado,
  com venda registrada recusado, o banco também recusa (`CHECK`s), venda grava a saída e
  desfazer apaga; pesagem e aplicação depois da saída recusadas (inclusive ao editar);
  pesagem repetida no dia (inclusive duas ao mesmo tempo: só uma grava); pesagem de
  negociação não é editada/apagada; outra fazenda não vê nada.
- `src/services/exit.service.test.ts`: regras puras (qual registro impede, mesmo dia, nascimento
  com/sem dia certo).
- A antiga checagem de GMD "primeira e última no mesmo dia" pela API ficou impossível (uma
  pesagem por dia); a regra continua coberta no teste de unidade do GMD.
- Verificado no navegador em 2026-10-13: erro de data citando a pesagem, faixa "Saiu em …",
  botão de pesagem desligado, voltar para ativo, pesagem repetida com atalho para editar,
  aplicação com animal que saiu, celular 360 px sem rolagem lateral e idioma de teste limpo.

## Categorias (G4)

- `categories.test.ts` (integração): as 7 combinações válidas aceitas e as 5 inválidas recusadas
  (nada gravado), categoria antiga recusada, o banco também recusa, castrado (padrão da fazenda,
  informado, fêmea), edição olhando a combinação final, nomes da fazenda (renomear, não apagar
  os outros, `null` volta ao padrão, repetido, limites).
- `src/lib/categories.test.ts` e `src/services/animal.service.test.ts`: regras puras.
- **Prova de que os testes protegem:** com a regra de sexo desligada de propósito, 17 testes
  falham (feito em 2026-10-13).

## Configurações da fazenda (G2)

- `farm.test.ts`: conta nova com todos os padrões (e os padrões do código iguais aos do banco),
  alterar só o que foi enviado, limites de cada campo (fator da arroba, antecedência, fuso fora
  do Brasil, nome vazio), campos fixos na 1.0 recusados, `id` de outra fazenda recusado,
  cada fazenda vê só as próprias configurações, e o efeito na hora: aumentar a antecedência
  faz a reaplicação aparecer em `GET /alerts`.
- `src/lib/farm.test.ts`: todos os fusos da lista existem; `sanitary.service.test.ts`:
  antecedência configurável (inclusive 0 = só no dia).

## Login e isolamento entre fazendas (G1)

- Cada teste começa com um usuário **já logado** numa fazenda nova (`t.client`,
  `tests/helpers/client.ts`); `t.app` é o "visitante" sem login.
- `auth.test.ts`: criar conta (fazenda + usuário juntos, só hash guardado, e-mail repetido,
  cadastros simultâneos), entrar, mesma resposta para senha errada e e-mail inexistente, sair
  revoga, limite de tentativas (429), todas as rotas de dados sem login → 401, sessão vencida
  por inatividade e por idade, renovação.
- `tenancy.test.ts`: duas fazendas; a fazenda A tenta ler, editar e excluir **cada** registro
  da fazenda B por **todas** as rotas (404) e o teste confere que **nada** de B mudou; aplicação
  com animal ou produto de outra fazenda; `farmId` vindo do navegador; mesmo brinco em fazendas
  diferentes.
- **Prova de que os testes protegem:** com o filtro por fazenda desligado de propósito, 3 testes
  de `tenancy.test.ts` falham (feito em 2026-10-12).
