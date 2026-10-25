# Definição de Stack e Arquitetura do Back-end

Este documento analisa o projeto atual (`OtiumPlayer`), define a stack tecnológica, a arquitetura em camadas e o plano de evolução passo a passo para o Back-end da plataforma.

---

## 1. Diagnóstico do Projeto Atual: Reaproveitar ou Começar do Zero?

**Conclusão: Devemos continuar com este projeto e evoluí-lo.**

O projeto atual já possui uma fundação moderna e bem configurada:
- Node.js com suporte nativo a **ES Modules** (`"type": "module"`).
- **Express 5** e boas práticas de segurança configuradas (`helmet`, `express-rate-limit`, headers padrão, isolamento de JSON body).
- **Docker e Compose** funcionais (`compose.yaml` com flags de segurança `read_only`, `no-new-privileges`, `tmpfs`).
- A lógica de criação de usuário no Jellyfin (`POST /Users/New`) já está implementada e validada.

### O que falta para atender às novas regras de negócio?
Atualmente, todo o código está centralizado em um único arquivo (`src/server.js`) e não há persistência de dados (banco de dados). Para suportar o período de testes de 2 dias, os webhooks de pagamento e o bloqueio automático, faremos uma **evolução arquitetural em camadas**.

---

## 2. A Stack Recomendada para o Back-end

Mantemos a base em JavaScript/Node.js, adicionando apenas o que é essencial para escalabilidade e controle:

| Papel | Tecnologia / Ferramenta | Motivo da Escolha |
| :--- | :--- | :--- |
| **Runtime & Base** | **Node.js (ES Modules)** | Já em uso, leve e com ótimo suporte assíncrono. |
| **Framework HTTP** | **Express 5** | Já em uso; versão 5 com suporte nativo a `async/await` em middlewares e rotas sem necessidade de wrappers externos. |
| **Banco de Dados** | **SQLite (via Prisma ou Drizzle)** ou **PostgreSQL** | Precisamos registrar os clientes, status (`trial`, `ativo`, `expirado`), datas de término e IDs de pagamento. SQLite via Docker roda com zero configuração externa; PostgreSQL no `compose.yaml` se preferir banco corporativo. |
| **ORM / Query Builder** | **Prisma** ou **Drizzle ORM** | Facilita migrações, tipagem, queries seguras e troca de banco no futuro sem reescrever código. |
| **Agendador de Tarefas** | **node-cron** | Executa rotinas em segundo plano (ex: a cada hora) para verificar contas expiradas e desativar no Jellyfin. |
| **Comunicação Jellyfin** | `fetch` nativo do Node.js | Evita dependências pesadas; a API REST do Jellyfin é simples de consumir diretamente. |
| **Segurança e Tokens** | `jsonwebtoken` (JWT) + `bcryptjs` | Controle de sessão do seu front-end independente do token mestre do Jellyfin. |

---

## 3. Arquitetura em Camadas (Layered Architecture)

Para facilitar a manutenção e garantir que a aplicação cresça de forma organizada, o monolito atual de `src/server.js` será desacoplado na seguinte estrutura:

```text
src/
├── config/             # Configurações globais e variáveis de ambiente
│   ├── env.js          # Validação e exportação segura das variáveis (.env)
│   └── database.js     # Conexão com o banco de dados (Prisma/Drizzle)
│
├── controllers/        # Camada de Entrada HTTP (valida req, chama service e responde res)
│   ├── authController.js       # Registro, login e status da conta
│   ├── paymentController.js    # Criação de cobrança e recebimento de webhooks
│   └── userController.js       # Perfil e informações da conta
│
├── services/           # Camada de Regras de Negócio (Core da aplicação)
│   ├── authService.js          # Lógica de login, validação de dias restantes
│   ├── jellyfinService.js      # Integração completa com API Jellyfin (criar, banir, deslogar)
│   ├── paymentService.js       # Comunicação com a API de pagamento escolhida
│   └── subscriptionService.js  # Lógica de ativar/desativar assinatura e controle de prazos
│
├── repositories/       # Camada de Dados (consultas ao banco de dados)
│   ├── userRepository.js       # Busca e atualização de clientes no banco
│   └── paymentRepository.js    # Registro de transações e webhooks
│
├── middlewares/        # Interceptadores de requisições
│   ├── authMiddleware.js       # Validação do token JWT e injeção do usuário
│   ├── checkSubscription.js   # Middleware que bloqueia rotas protegidas se expirado
│   ├── rateLimiter.js          # Limite de requisições (evitar brute force)
│   └── errorHandler.js         # Tratamento centralizado de erros
│
├── jobs/               # Rotinas em segundo plano
│   └── checkExpiredTrials.js   # Cron que busca contas vencidas e chama o Jellyfin para desativar
│
├── routes/             # Definição dos endpoints da API
│   ├── authRoutes.js           # /api/auth/*
│   ├── paymentRoutes.js        # /api/payments/* (inclui webhook)
│   └── index.js                # Agrupador de rotas
│
├── app.js              # Configuração dos middlewares do Express e rotas
└── server.js           # Inicialização do servidor HTTP e conexão com o banco
```

---

## 4. Modelagem Básica do Banco de Dados

Para viabilizar o trial e a assinatura, precisamos da seguinte entidade principal:

### Tabela: `User`
- `id`: UUID ou Inteiro auto-incremento (ID no seu sistema).
- `jellyfin_user_id`: String (ID retornado pelo Jellyfin ao criar a conta).
- `username`: String (único).
- `password_hash`: String (senha criptografada caso queira autenticar no seu backend).
- `email`: String (único, para cobrança e recuperação).
- `status`: Enum (`trial_ativo`, `trial_expirado`, `ativo`, `bloqueado`).
- `trial_ends_at`: DateTime (definido para `DataAtual + 2 dias` no cadastro).
- `subscription_ends_at`: DateTime (atualizado a cada confirmação de pagamento).
- `created_at` / `updated_at`: DateTime.

---

## 5. Plano de Implementação Passo a Passo

### Fase 1: Estruturação das Camadas & Banco de Dados
- [ ] Instalar as novas dependências (`prisma` ou `drizzle`, `node-cron`, `jsonwebtoken`, `bcryptjs`).
- [ ] Inicializar o schema do banco de dados (tabelas `User` e `Subscription/Payment`).
- [ ] Migrar a lógica monolítica de `src/server.js` para `app.js` e a estrutura de pastas proposta.

### Fase 2: Evolução do `jellyfinService`
- [ ] Manter o método existente de criar usuário (`POST /Users/New`).
- [ ] Adicionar método de **desativação de conta**:
  - `POST /Users/{userId}/Policy` com `{ IsDisabled: true }`.
- [ ] Adicionar método de **reativação de conta**:
  - `POST /Users/{userId}/Policy` com `{ IsDisabled: false }`.
- [ ] Adicionar método de **derrubar sessões ativas**:
  - `POST /Sessions/Logout` passando a sessão do usuário quando o trial vencer.

### Fase 3: Módulo de Autenticação e Cálculo do Trial
- [ ] Criar endpoint `POST /api/auth/register`:
  - Cria o usuário no banco com `trial_ends_at = hoje + 2 dias` e status `trial_ativo`.
  - Chama o Jellyfin para criar a conta de streaming.
- [ ] Criar endpoint `POST /api/auth/login`:
  - Valida as credenciais.
  - Verifica se a data atual ultrapassou o `trial_ends_at` (se sim e não pago, responde com status `trial_expirado` e instrução de pagamento).
  - Se válido, retorna o JWT de sessão.
- [ ] Criar endpoint `GET /api/auth/me`:
  - Retorna o status atual, tempo restante de trial ou data de expiração da assinatura.

### Fase 4: Integração com Gateway de Pagamento e Webhooks
- [ ] Criar `POST /api/payments/create`:
  - Gera cobrança (PIX / Cartão) na API de pagamentos.
- [ ] Criar `POST /api/payments/webhook`:
  - Recebe a notificação de confirmação da operadora de pagamento.
  - Atualiza o banco do cliente para `status: ativo` e adiciona `+30 dias` na assinatura.
  - Chama imediatamente o `jellyfinService.enableUser(jellyfin_user_id)`.

### Fase 5: Cron Job de Bloqueio Automático
- [ ] Implementar a rotina agendada com `node-cron`:
  - Roda a cada hora (ou intervalo configurável).
  - Busca usuários onde `trial_ends_at < NOW()` e status ainda está como `trial_ativo`.
  - Atualiza o banco para `trial_expirado`.
  - Executa `jellyfinService.disableUser()` e derruba as sessões ativas.

### Fase 6: Ajustes no Docker e Testes
- [ ] Atualizar o `compose.yaml` (incluir volume para persistência do banco SQLite ou serviço PostgreSQL).
- [ ] Realizar testes de ponta a ponta simulando:
  1. Criação de conta com 2 dias de trial.
  2. Expiração forçada e verificação do bloqueio no Jellyfin.
  3. Simulação de webhook de pagamento e desbloqueio imediato.
