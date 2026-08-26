<div align="center">

  <img src="web/public/logo.png" alt="Logo Rebanho" width="90" />
# Rebanho

**Sistema de controle de rebanho de gado de corte** — cadastro dos animais, registro de pesagens e acompanhamento do ganho de peso e do **ganho médio diário (GMD)** ao longo do tempo.

<sub>Um histórico organizado para acompanhar o desempenho dos animais e apoiar decisões baseadas em dados.</sub>

</div>

---

## 📖 Sobre o projeto

Na pecuária de corte, acompanhar a evolução de cada animal depende de informações registradas ao longo do tempo. Sem um histórico organizado, torna-se difícil saber, com dados concretos, como cada animal está evoluindo e tomar decisões com base em informações confiáveis.

O **Rebanho** foi desenvolvido para uso em uma propriedade rural, centralizando o cadastro dos animais, identificados pelo **brinco**, e todo o seu histórico de **pesagens**. A partir desses registros, o sistema calcula automaticamente o **ganho de peso** e o **ganho médio diário (GMD)**, além de apresentar a evolução do peso ao longo do tempo.

O objetivo é transformar registros de campo em informações úteis para acompanhar o desempenho individual dos animais e apoiar a tomada de decisão.

O sistema também prioriza a experiência do usuário final, com linguagem clara e mensagens compreensíveis, evitando a exposição de códigos de erro ou detalhes técnicos desnecessários na interface.

---

## ✨ Funcionalidades

* **Cadastro de animais** com identificação por brinco único, sexo, categoria, raça e observações.
* **Data de nascimento com precisão variável**, permitindo registrar a informação conforme o nível de precisão disponível: dia/mês/ano, mês/ano ou desconhecida.
* **Registro de pesagens** por animal, mantendo um histórico completo ao longo do tempo.
* **Cálculo automático de ganho de peso e GMD** (ganho médio diário).
* **Visualização da evolução do peso** de cada animal por meio de gráficos.
* **Filtros de animais** por status e categoria.
* **Atualização de status** para situações como venda ou morte, preservando o histórico do animal.
* **Interface responsiva**, adaptada para computador e dispositivos móveis.
* **Mensagens e estados vazios orientados ao usuário**, evitando a exposição de informações técnicas desnecessárias.

---

## 🛠️ Tecnologias

### Backend

* **Node.js** — ambiente de execução
* **TypeScript** — linguagem principal
* **Fastify** — framework para construção da API REST
* **PostgreSQL** — banco de dados relacional
* **Prisma** — ORM para acesso ao banco de dados
* **Zod** — validação e definição dos contratos de dados
* **Swagger / OpenAPI** — documentação interativa da API
* **Vitest** — testes automatizados
* **Helmet + Rate Limit** — segurança e proteção das requisições

### Frontend

* **React + TypeScript**
* **Vite**
* **Tailwind CSS**
* **React Router** — navegação entre páginas
* **Recharts** — visualização dos dados
* **Lucide** — biblioteca de ícones

---

## 📸 Telas

> Prints do sistema serão adicionados em breve.

<!--
Sugestões:
- Lista do rebanho
- Ficha do animal
- Gráfico de evolução do peso
- Cadastro de animal
-->

---

## 🗂️ Estrutura do projeto

```text
controle-rebanho/
│
├── src/                         # Backend — API Fastify
│   ├── server.ts                # Inicialização do servidor e configuração global
│   │
│   ├── lib/                     # Configurações e integrações
│   │   └── prisma.ts            # Conexão com o banco de dados
│   │
│   ├── schemas/                 # Validação dos dados
│   ├── routes/                  # Rotas HTTP
│   └── services/                # Regras de negócio
│
├── prisma/                      # Schema, migrações e seed do banco
│
└── web/                         # Frontend — React + Vite
    └── src/
        ├── pages/               # Páginas da aplicação
        ├── components/          # Componentes reutilizáveis
        ├── services/            # Comunicação com a API
        └── types/               # Tipos e contratos
```

A estrutura separa as responsabilidades entre as diferentes camadas da aplicação: as rotas recebem as requisições, os schemas validam os dados, os services concentram as regras de negócio e o Prisma realiza a comunicação com o banco de dados.

---

## 🚀 Como rodar localmente

### Pré-requisitos

* Node.js
* Docker
* Git

### 1. Clone o repositório

```bash
git clone SEU_REPOSITORIO
cd controle-rebanho
```

### 2. Suba o banco de dados

```bash
docker compose up -d
```

### 3. Configure e execute o backend

Na raiz do projeto:

```bash
npm install
```

Crie o arquivo `.env` utilizando o `.env.example` como referência e configure a variável `DATABASE_URL`.

Em seguida, execute:

```bash
npx prisma migrate dev
npm run dev
```

O backend estará disponível em `http://localhost:3333`, e a documentação interativa da API estará disponível em `/docs`.

### 4. Configure e execute o frontend

```bash
cd web
npm install
npm run dev
```

O frontend será iniciado na porta configurada pelo Vite.

---

## 🧾 Principais rotas da API

| Método   | Rota                      | Descrição                               |
| -------- | ------------------------- | --------------------------------------- |
| `POST`   | `/animals`                | Cadastra um novo animal                 |
| `GET`    | `/animals`                | Lista os animais, com suporte a filtros |
| `GET`    | `/animals/:id`            | Retorna os detalhes de um animal        |
| `PUT`    | `/animals/:id`            | Atualiza os dados de um animal          |
| `PATCH`  | `/animals/:id/status`     | Atualiza o status do animal             |
| `DELETE` | `/animals/:id`            | Exclui um animal                        |
| `POST`   | `/animals/:id/pesagens`   | Registra uma nova pesagem               |
| `GET`    | `/animals/:id/pesagens`   | Retorna o histórico de pesagens         |
| `GET`    | `/animals/:id/ganho-peso` | Retorna o ganho de peso e o GMD         |

A documentação completa e interativa da API está disponível na rota `/docs`.

---

## 💡 Decisões de projeto

* **Validação como fonte única:** os schemas do Zod são responsáveis pela validação das requisições e pela definição dos contratos utilizados na documentação da API, centralizando as regras e reduzindo duplicações.

* **Tratamento de erros centralizado:** um único mecanismo define as respostas para diferentes situações, mantendo um padrão consistente para dados inválidos, recursos não encontrados, registros duplicados e dados insuficientes para cálculo.

* **Data de nascimento com precisão variável:** decisão baseada em uma necessidade identificada no contexto da pecuária. Nem sempre o dia exato do nascimento de um animal é conhecido; por isso, o sistema permite registrar a informação conforme o nível de precisão disponível, sem exigir dados estimados ou incorretos.

* **Experiência orientada ao usuário final:** embora o backend utilize códigos HTTP para representar diferentes situações, a interface traduz essas respostas em mensagens claras e compreensíveis. Por exemplo, quando não há pesagens suficientes para calcular o desempenho, o usuário recebe uma explicação sobre a situação em vez de apenas um código técnico.

---

## 🗺️ Roadmap

### Atual

* [x] Cadastro e gerenciamento de animais
* [x] Registro e histórico de pesagens
* [x] Cálculo de ganho de peso e GMD
* [x] Documentação interativa da API
* [x] Interface para acompanhamento do rebanho
* [x] Gráfico de evolução do peso
* [ ] Ampliação da cobertura de testes automatizados

### Próximas etapas

* [ ] Manejo sanitário
* [ ] Registro de vacinas e vermífugos
* [ ] Alertas de manejo
* [ ] Lotes e pastos
* [ ] Reprodução e nascimentos
* [ ] Relatórios e indicadores financeiros

---

## 👩‍💻 Autora

**Amanda Gondra**
Estudante de Ciência da Computação | Desenvolvedora Backend

* **GitHub:** @amanda-gondra
* **LinkedIn:** Amanda Gondra
