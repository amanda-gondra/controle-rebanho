# 🐂 Gestão de Rebanho — API

API para gestão de rebanho de gado de corte, com cadastro dos animais por brinco, histórico de pesagens e cálculo automático de ganho de peso e ganho médio diário (GMD).
Desenvolvida para transformar registros de campo em dados organizados sobre o desempenho dos animais, apoiando o acompanhamento do rebanho e a tomada de decisões baseada em dados.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

##  Sobre o projeto

Na pecuária, o acompanhamento do rebanho ainda pode depender de anotações manuais, planilhas dispersas ou até da memória do produtor. Sem um histórico organizado, torna-se difícil acompanhar a evolução de cada animal e tomar decisões com base em dados confiáveis.

Esta API foi desenvolvida para centralizar o cadastro dos animais e seu histórico de pesagens, mantendo os dados organizados e disponíveis ao longo do tempo. A partir dessas informações, o sistema calcula automaticamente indicadores como ganho de peso e ganho médio diário (GMD).

O objetivo é transformar registros de campo em informações úteis para a tomada de decisão. Com um histórico consistente, o produtor consegue identificar quais animais apresentam melhor desempenho, acompanhar sua evolução e avaliar os resultados do manejo com maior segurança.

A solução foi pensada para atender produtores de diferentes perfis e níveis de experiência. Por isso, prioriza uma experiência simples, com linguagem acessível e processos que reduzem a necessidade de cálculos manuais ou planilhas complexas.

Mais do que registrar pesagens, a proposta é construir um histórico confiável que permita compreender o desempenho do rebanho e apoiar decisões baseadas em dados.

---

## ⚙️ Funcionalidades

- **Cadastro de animais** identificados pelo brinco (único), com sexo, raça, categoria e status.
- **Data de nascimento com precisão variável** decisão baseada em uma necessidade identificada com um produtor rural. No campo, nem sempre o dia exato do nascimento é conhecido; por isso, o sistema permite registrar a data com precisão de dia, mês ou apenas ano, sem exigir uma informação que não seja conhecida.
- **Listagem** com filtros por status e por categoria.
- **Edição** dos dados e **mudança de status** (vendido / morto).
- **Registro de pesagens** de cada animal ao longo do tempo.
- **Histórico de pesagens** de um animal.
- **Cálculo de ganho de peso e GMD** (ganho médio diário) a partir das pesagens.
- **Documentação interativa** da API (Swagger) para explorar e testar as rotas pelo navegador.
- **Validação de dados** e **tratamento de erros** centralizado.

---

##  Tecnologias

- **Node.js** + **TypeScript**
- **Fastify** — framework web
- **PostgreSQL** — banco de dados (rodando via **Docker**)
- **Prisma** — ORM (acesso ao banco)
- **Zod** — validação dos dados (fonte única: valida e também gera a documentação)
- **Swagger / OpenAPI** — documentação interativa da API

---

## 🗂️ Estrutura do projeto

```
src/
├── server.ts                    # sobe o servidor, registra as rotas e trata os erros
├── lib/
│   └── prisma.ts                # conexão única com o banco
├── schemas/                     # validação (Zod)
│   ├── animal.schema.ts
│   └── weighing.schema.ts
├── routes/
│   └── animals.routes.ts        # rotas de animais e pesagens
└── services/
    └── weighing.service.ts      # regra de negócio: cálculo do ganho de peso e GMD
```

Cada pasta tem uma responsabilidade única — a rota recebe o pedido, o schema valida, o serviço calcula e o Prisma acessa o banco. Isso mantém o código organizado e fácil de evoluir.

---

##  Como rodar o projeto

### Pré-requisitos
- [Node.js](https://nodejs.org) (versão LTS)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (para o banco de dados)

### Passo a passo

1. **Clone o repositório**
   ```bash
   git clone https://github.com/amanda-gondra/controle-rebanho.git
   cd controle-rebanho
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Suba o banco de dados** (com o Docker Desktop aberto)
   ```bash
   docker compose up -d
   ```

4. **Crie o arquivo `.env`** na raiz do projeto com a conexão do banco:
   ```
   DATABASE_URL="postgresql://rebanho:rebanho123@localhost:5433/rebanho?schema=public"
   ```

5. **Rode a migração** (cria as tabelas no banco)
   ```bash
   npx prisma migrate dev
   ```

6. **Inicie o servidor**
   ```bash
   npm run dev
   ```

O servidor sobe em `http://localhost:3333`.

---

## 📚 Documentação da API

Com o servidor rodando, acesse a documentação interativa (Swagger) no navegador:

```
http://localhost:3333/docs
```

Lá é possível ver todas as rotas, os dados que cada uma espera, e **testar cada uma** direto pelo navegador (botão "Try it out").

---

## 🔗 Endpoints

### Animais
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/animals` | Cadastra um novo animal |
| `GET` | `/animals` | Lista os animais (filtros: `?status=` e `?category=`) |
| `GET` | `/animals/:id` | Busca um animal pelo id |
| `PUT` | `/animals/:id` | Edita os dados de um animal |
| `PATCH` | `/animals/:id/status` | Muda o status (vendido / morto) |

### Pesagens e desempenho
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/animals/:id/pesagens` | Registra uma pesagem |
| `GET` | `/animals/:id/pesagens` | Histórico de pesagens do animal |
| `GET` | `/animals/:id/ganho-peso` | Ganho de peso total e GMD do animal |

**Exemplo de resposta** de `GET /animals/:id/ganho-peso`:
```json
{
  "firstWeightKg": 180.5,
  "lastWeightKg": 300,
  "totalGainKg": 119.5,
  "days": 183,
  "averageDailyGainKg": 0.653
}
```

---

## 💡 Decisões de projeto

- **Validação como fonte única:** os schemas do Zod são responsáveis tanto pela validação das requisições quanto pela geração da documentação do Swagger, centralizando as regras em um único lugar e evitando duplicação.
- **Tratamento de erros centralizado:** um único mecanismo define as respostas para cada tipo de erro, mantendo um padrão consistente na API — dados inválidos (400), recurso não encontrado (404), brinco duplicado (409) e dados insuficientes para o cálculo (422) sem expor detalhes internos da aplicação.
- **Data de nascimento com precisão variável:** decisão baseada em uma necessidade identificada no contexto real da pecuária. Nem sempre o produtor possui o dia exato do nascimento de um animal. Por isso, o sistema permite registrar a data conforme o nível de precisão disponível — dia/mês/ano, mês/ano ou desconhecida — evitando a inserção de informações estimadas ou incorretas.
- **Mensagens pensadas para o usuário final:** embora a API utilize códigos HTTP para representar diferentes situações, a camada de apresentação será responsável por traduzi-los em mensagens claras e compreensíveis. Por exemplo, em vez de exibir apenas um erro 422, o frontend poderá informar que ainda não há pesagens suficientes para calcular o ganho de peso.

---

## 🗺️ Roadmap

**v1 (atual):**
- [x] CRUD de animais
- [x] Registro e histórico de pesagens
- [x] Cálculo de ganho de peso e GMD
- [x] Documentação com Swagger
- [ ] Testes automatizados
- [ ] Frontend

**v2 (futuro):**
- [ ] Manejo sanitário (vacinas, vermífugos) com alertas
- [ ] Lotes e pastos
- [ ] Reprodução (coberturas, nascimentos)
- [ ] Relatórios financeiros

---

## 👩‍💻 Autora

**Amanda Gondra**
Estudante de Ciência da Computação | Desenvolvedora Backend em formação

- GitHub: [@amanda-gondra](https://github.com/amanda-gondra)
- LinkedIn: [Amanda Gondra](https://www.linkedin.com/in/amandagondra)
