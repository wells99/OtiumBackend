# OtiumFront

Aplicação React + Vite do OtiumPlayer. O backend da aplicação deve estar disponível na URL configurada em `VITE_API_URL`.

## Desenvolvimento local

1. Configure o backend em execução na porta `3000` e suas variáveis Jellyfin conforme o `.env-example` da raiz.
2. Copie `.env.example` para `.env` se precisar ajustar endereços. O padrão da API é `http://localhost:3000/api`.
3. Instale as dependências com `npm install` e inicie com `npm run dev`.

O cadastro chama `POST /api/auth/register` com `username`, `password` e `email` opcional. O login e a validação da sessão usam `POST /api/auth/login` e `GET /api/auth/me`. Para outra máquina/ambiente, ajuste `VITE_API_URL` para a URL pública do backend, incluindo `/api`.

O checkout é apenas uma tela de preparação até a definição do provedor e da documentação de pagamentos.
