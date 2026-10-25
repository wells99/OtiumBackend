# Definição de Stack e Plano de Implementação do Front-end

Este documento define a arquitetura técnica, as ferramentas e o plano de desenvolvimento passo a passo do Front-end para a plataforma de streaming baseada na API do Jellyfin, com controle de trial e assinatura.

---

## 1. Análise: React (Vite) vs Next.js

Para o seu objetivo de **máxima liberdade, flexibilidade e capacidade de contornar problemas futuros**, a escolha recomendada é **React com Vite (SPA - Single Page Application)**.

### Por que React + Vite em vez de Next.js para este cenário?

| Critério | React + Vite (SPA) | Next.js (SSR/RSC) |
| :--- | :--- | :--- |
| **Players de Vídeo (HLS/DOM)** | **100% nativo no Client**. Zero conflitos com `window`, `document` ou hidratação SSR. | Frequentes erros de *hydration mismatch* com players que manipulam DOM diretamente. |
| **Liberdade Arquitetural** | Total liberdade para escolher bibliotecas, roteadores e interceptadores de rede. | Mais opinativo; amarrado às regras de convenção do Next (App Router, Server Actions, etc.). |
| **Portabilidade Futura** | **Altíssima**: O mesmo código pode ser empacotado para **Desktop (Tauri/Electron)**, **Mobile (Capacitor)** ou **Smart TV** com facilidade. | Complexo de exportar para outros ecossistemas que não sejam servidores web Node.js. |
| **Hospedagem & Deploy** | Extremamente leve. Gera arquivos estáticos (HTML/CSS/JS) que rodam em qualquer CDN (Cloudflare Pages, Vercel, S3, Nginx). | Exige servidor Node rodando ou adaptações para export estático. |

---

## 2. A Stack Recomendada

### Núcleo (Core)
- **Linguagem:** JavaScript (com suporte a JSX) ou TypeScript (caso queira tipagem forte da API do Jellyfin, mas 100% flexível com JS moderno ESNext).
- **Build Tool:** [Vite](https://vitejs.dev/) (ultrarrápido para desenvolvimento e build otimizado).
- **Biblioteca Base:** [React 18+](https://react.dev/).

### Roteamento e Proteção de Rotas
- **[React Router DOM](https://reactrouter.com/):** O padrão da comunidade. Permite criar `ProtectedRoutes` e interceptar acessos com base no status do usuário (`ativo`, `trial`, `expirado`).

### Streaming e Player de Vídeo
- **[Video.js](https://video.js.org/)** ou **[HLS.js](https://github.com/video-dev/hls.js/):**
  - O **Video.js** é a opção mais testada na indústria: possui suporte nativo a HLS (`.m3u8`), seleção de faixas de áudio, legendas externas/embutidas, atalhos de teclado (estilo YouTube/Netflix) e suporte a plugins caso queira adicionar controle de qualidade, Picture-in-Picture ou bloqueio de captura de tela.

### Comunicação com a API e Estado Global
- **[Axios](https://axios-http.com/):** Ideal pelo recurso de **Interceptors**. Se o backend ou o Jellyfin retornar `401 Unauthorized` ou `403 Forbidden` (trial expirado), o interceptor captura a resposta globalmente e redireciona imediatamente para a tela de pagamento.
- **[TanStack Query (React Query)](https://tanstack.com/query/):** Gerencia cache do catálogo, paginação infinita, busca instantânea e evita requisições redundantes de metadados ao Jellyfin.
- **[Zustand](https://github.com/pmndrs/zustand):** Gerenciamento de estado leve para manter a sessão do usuário (token, tempo restante de trial, dados do perfil e último ponto assistido).

### Interface e Estilização (UI/UX)
- **[Tailwind CSS](https://tailwindcss.com/):** Estilização rápida, responsiva e sem conflito de classes.
- **[Lucide React](https://lucide.dev/):** Pacote de ícones moderno e leve (play, pause, volume, engrenagem, cartão, etc.).
- **[Radix UI](https://www.radix-ui.com/) ou [shadcn/ui](https://ui.shadcn.com/):** Componentes prontos e customizáveis (modais, menus de contexto, alertas e sliders de volume/progresso).

---

## 3. Estrutura de Pastas Sugerida

```text
src/
├── assets/             # Imagens, logos e fontes
├── components/         # Componentes reutilizáveis
│   ├── layout/         # Header, Sidebar, Footer
│   ├── player/         # VideoPlayer customizado com Video.js / HLS
│   ├── catalog/        # Cards de mídia, banners (hero), carrosséis
│   └── ui/             # Botões, modais, inputs, loaders
├── context/            # Contextos globais (AuthContext, PlayerContext)
├── hooks/              # Hooks customizados (useJellyfin, usePayment, useAuth)
├── pages/              # Telas da aplicação
│   ├── Login.jsx       # Tela de login
│   ├── Register.jsx    # Cadastro com ativação de 2 dias de trial
│   ├── Home.jsx        # Catálogo principal (vitrine)
│   ├── Details.jsx     # Detalhes do filme/vídeo (sinopse, elenco)
│   ├── Watch.jsx       # Tela de reprodução em tela cheia
│   └── Checkout.jsx    # Tela de pagamento / renovação de assinatura
├── routes/             # Configuração de rotas e Guards de acesso
│   ├── AppRoutes.jsx
│   └── AuthGuard.jsx   # Bloqueia se o trial expirou e redireciona para Checkout
├── services/           # Comunicação HTTP
│   ├── api.js          # Instância do Axios com interceptors
│   ├── authService.js  # Chamadas de login/cadastro/status
│   └── jellyfinService.js # Chamadas para itens, streaming e bibliotecas
└── utils/              # Formatadores de tempo, helpers de URL de mídia
```

---

## 4. Plano de Implementação Passo a Passo

### Fase 1: Setup do Ambiente e Estrutura Base
- [x] Inicializar o projeto com Vite (`OtiumFront`, React + Vite).
- [x] Configurar Tailwind CSS e biblioteca de ícones (`lucide-react`).
- [x] Montar a estrutura de pastas e arquivo de variáveis de ambiente (`.env`) contendo a URL base da API.

### Fase 2: Autenticação, Trial e Controle de Acesso
- [x] Criar o `authService` e a instância do Axios com interceptor de tokens.
- [x] Desenvolver as telas de **Cadastro** (iniciando o trial de 2 dias) e **Login**.
- [x] Implementar o `AuthGuard` no React Router:
  - Se não logado $\rightarrow$ Redireciona para `/login`.
  - Se logado com trial/assinatura válidos $\rightarrow$ Permite acesso às rotas internas (`/`, `/watch/:id`).
  - Se logado mas expirado $\rightarrow$ Redireciona obrigatoriamente para `/checkout`.

### Fase 3: Integração com o Catálogo do Jellyfin
- [ ] Conectar com a API do Jellyfin (`/Items`) para listar bibliotecas e mídias. *(Implementação inicial existe em `jellyfinService.js`; requer validação com a configuração real de autenticação/CORS do Jellyfin.)*
- [ ] Montar a tela inicial (`Home.jsx`):
  - Banner principal (Hero item em destaque);
  - Trilhas/Carrosséis por categoria (Continuar assistindo, Lançamentos, etc.);
  - Imagens de capa carregadas diretamente via URL de imagem da API do Jellyfin (`/Items/{id}/Images/Primary`).
- [ ] Desenvolver modal ou tela de detalhes (`Details.jsx`) com sinopse e botão de "Assistir".

### Fase 4: O Player de Vídeo e Streaming
- [ ] Implementar o componente de player (`components/player/VideoPlayer.jsx`) usando `Video.js` ou `hls.js`.
- [ ] Configurar a URL de stream do Jellyfin (`/Videos/{itemId}/stream.m3u8` ou stream direto).
- [ ] Adicionar suporte a:
  - Retomar de onde parou (*resume playback* via API do Jellyfin `/Sessions/Playing/Progress`);
  - Troca de áudio e legendas;
  - Atalhos de teclado (Espaço = pause, Setas = avançar/retroceder, F = tela cheia).

### Fase 5: Tela de Pagamento e Liberação
- [x] Desenvolver a tela `Checkout.jsx` informando que o período de testes terminou.
- [ ] Exibir opções de pagamento (PIX / Cartão) geradas pela sua API de pagamentos. *(Aguardando a documentação do provedor; a simulação foi removida.)*
- [ ] Adicionar verificação de status (polling ou WebSocket): assim que o webhook do pagamento aprovar no backend, o front-end detecta e libera a navegação de volta para o catálogo sem precisar recarregar.

### Fase 6: Polimento e Proteção Contra Burlar Acesso
- [ ] Validar comportamento quando a assinatura expira no meio de um vídeo: o backend corta a sessão e o interceptor do Axios no front-end fecha o player e exibe a mensagem de cobrança.
- [ ] Testar responsividade em dispositivos móveis e navegadores diferentes.

### Estado da implementação no OtiumFront — 25/10/2026
- Cadastro envia `username`, `password` e `email` para `POST /api/auth/register`, confere a senha e aplica no navegador os limites de nome/senha aceitos pelo backend.
- Login usa `POST /api/auth/login`; sessão JWT e perfil são mantidos no `localStorage`, e a sessão existente é validada por `GET /api/auth/me`.
- Os endpoints correspondem às rotas atuais do backend (`src/routes/authRoutes.js`). Defina `VITE_API_URL` no `.env` do frontend apontando para a base `/api` do backend. Em desenvolvimento local, `http://localhost:3000/api` é o padrão do projeto.
- Checkout agora é uma tela de preparação sem chamadas inventadas a endpoints de pagamento; preços e processamento serão integrados quando a documentação chegar.
- Validação local em 25/10/2026: o backend iniciou em modo development e `GET http://localhost:3000/api/health` respondeu `200` (`{"status":"ok"}`). A URL pública do Jellyfin respondeu `200`, e uma leitura administrativa autenticada (`GET /Users`) também respondeu `200`.
- Integração de cadastro validada: foi enviado um cadastro temporário pela rota usada pelo frontend (`POST /api/auth/register`); o backend respondeu `201`, criando a conta no Jellyfin. Em seguida a conta temporária foi removida do Jellyfin (`204`) e a linha correspondente foi removida do banco local (1 registro). Nenhuma conta de teste ficou no ambiente.
- O build de produção (`npm run build`) concluiu com sucesso. O lint (`npm run lint`) conclui sem erros e mantém dois avisos não bloqueantes: uso de `Date` durante renderização no `Navbar` e exportação do hook junto ao provider em `AuthContext`.
