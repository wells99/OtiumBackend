# Análise de Viabilidade: Front-end Próprio para Streaming Jellyfin com Gestão de Assinatura

Este documento analisa a viabilidade de utilizar o **Jellyfin** como backend de streaming desacoplado, consumido por um **Web Client próprio**, com sistema de trial de 2 dias e controle de acesso integrado a pagamentos.

---

## 1. Viabilidade Geral

**A ideia é 100% viável e representa a melhor arquitetura para criar um serviço personalizado (SaaS/White-label).**

- **Jellyfin possui API REST completa:** O Jellyfin foi projetado de forma desacoplada. Todo o ecossistema (autenticação, listagem de bibliotecas, busca, metadados, capas e URLs de streaming via HLS/Direct Play) é exposto via endpoints HTTP REST documentados.
- **Controle Total no Front-end Próprio:** Construir um front-end customizado (React, Vue, Next.js, etc.) com bibliotecas de player modernas (`video.js`, `Plyr`, `hls.js`, etc.) permite interceptar rotas protegidas, controlar o player, exibir bloqueios e integrar checkout transparente ou telas de renovação.

---

## 2. Controle de Acesso e Bloqueio Efetivo

### O Risco de Bloquear Apenas no Front-end
Se a validação do status for feita **exclusivamente no front-end**:
- Um usuário mais experiente pode inspecionar a aba *Network* do navegador, extrair o token ou URL do stream HLS e reproduzir em players externos (como VLC ou o aplicativo oficial do Jellyfin), mantendo o acesso mesmo com a conta "expirada".

### Abordagem Recomendada: Dupla Camada (Front-end + Backend/API Jellyfin)

O backend do seu sistema (responsável pelo ciclo de vida da conta e pagamento) deve gerenciar o status tanto no banco de dados da aplicação quanto na API do Jellyfin:

1. **Desativação na Fonte (API do Jellyfin):**
   - O Jellyfin conta com o endpoint `POST /Users/{userId}/Policy`, onde é possível definir `IsDisabled: true`.
2. **Encerramento de Sessões Ativas:**
   - Se o usuário estiver assistindo no momento da expiração do trial, a API do Jellyfin permite derrubar sessões ativas (`POST /Sessions/Logout` ou revogação de tokens de autenticação), cortando o stream imediatamente.
3. **No Front-end:**
   - O front-end consulta o status da conta. Caso esteja como `trial_expirado` ou `pagamento_pendente`, os dados da sessão local (cookies/localStorage) são limpos e o cliente é redirecionado para a tela de pagamento.

---

## 3. Arquitetura e Fluxo do Sistema

```text
[ Cliente (Seu Front-end Web) ]
             |
             v
   [ Seu Backend / API ]  <---- Webhooks de Pagamento (Mercado Pago, Stripe, etc.)
      |              |
      | (Valida status: trial ativo / pago)
      v              v
[ Banco de Dados ]   [ Jellyfin API (Porta interna / protegida) ]
```

### Ciclo de Vida da Conta:

1. **Cadastro e Início do Trial (Dia 0):**
   - Usuário se cadastra no seu sistema.
   - O backend cria a conta com `trial_until = hoje + 2 dias` e status `trial_ativo`.
   - O backend cria ou ativa o usuário correspondente no Jellyfin via API.
   - Login liberado no front-end web.

2. **Período de Avaliação (Dias 1 e 2):**
   - Usuário navega pelo catálogo e assiste ao conteúdo normalmente através do seu web client.

3. **Expiração do Trial sem Pagamento (Dia 3):**
   - Um job/rotina no backend (ou verificação na requisição de autenticação/token) detecta `trial_until < hoje && status != 'pago'`.
   - O status é alterado para `inativo`.
   - O backend invoca a API do Jellyfin desativando o usuário (`IsDisabled = true`) e encerra sessões ativas.
   - O front-end bloqueia o acesso e direciona o usuário para a tela de pagamento.

4. **Confirmação de Pagamento (Webhook):**
   - A operadora de pagamento notifica o backend via Webhook.
   - O backend atualiza o prazo (`expires_at = hoje + 30 dias`) e muda o status para `ativo`.
   - O backend reativa o usuário no Jellyfin (`IsDisabled = false`).
   - O acesso volta a ser liberado imediatamente.

---

## 4. Pontos de Atenção e Boas Práticas

1. **Ocultar o Jellyfin do Acesso Público Direto:**
   - Evitar expor a porta padrão do Jellyfin (8096) diretamente na internet aberta com IPs visíveis, impedindo que usuários usem a interface nativa do Jellyfin. Recomenda-se utilizar proxy reverso (Nginx, Traefik, Cloudflare) intermediando os acessos.
2. **Consumo de Hardware e Largura de Banda (Transcoding):**
   - Conexões simultâneas de streaming exigem largura de banda de upload consistente.
   - Caso os formatos dos arquivos não sejam compatíveis nativamente com os navegadores dos clientes (Direct Play), o Jellyfin acionará transcodificação, consumindo recursos de CPU/GPU do servidor.

---

## 5. Próximos Passos Recomendados

- [ ] Definir a stack do **Front-end** (ex.: Next.js/React + Tailwind + Video.js/Plyr).
- [ ] Definir a stack do **Backend de Gestão** (ex.: Node.js, Python FastAPI, Go, etc.) integrado com o banco de dados e a API REST do Jellyfin.
- [ ] Escolher e configurar a integração com o Gateway de Pagamentos (ex.: Mercado Pago, Asaas, Stripe).
- [ ] Implementar a rotina/job de verificação diária e expiração automática de trials.
