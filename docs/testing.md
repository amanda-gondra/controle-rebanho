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
