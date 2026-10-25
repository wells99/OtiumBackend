# Resumo do projeto — OtiumPlayer / Cadastro de usuários Jellyfin

**Atualizado em:** 24/10/2026  
**Objetivo:** documentar o estado atual do projeto e o próximo problema a corrigir, para continuidade com outra IA.

## 1. Objetivo do projeto

Criar uma página pública de cadastro de usuários para um servidor Jellyfin. A pessoa informa seu nome de usuário e senha; um backend Node.js recebe os dados e chama a API REST do Jellyfin para criar a conta.

O projeto está sendo desenvolvido primeiro em Docker no Windows e depois migrado para o Ubuntu Server com CasaOS, onde está o Jellyfin.

## 2. Arquitetura planejada

- **Frontend:** HTML, Tailwind CSS compilado localmente e JavaScript.
- **Backend:** Node.js + Express.
- **Integração:** API REST do Jellyfin, endpoint `POST /Users/New`.
- **Autenticação da API Jellyfin:** chave guardada no `.env` e enviada pelo backend, nunca pelo navegador.
- **Container:** Docker Compose.
- **Porta publicada no host:** `3005`.
- **Porta interna do Express:** `3000`.

Fluxo esperado:

1. O navegador acessa a página servida pelo Express.
2. O JavaScript envia `POST /api/users` para a mesma origem, usando `fetch("/api/users", ...)`.
3. O backend valida os campos e chama `JELLYFIN_URL/Users/New`.
4. O Jellyfin cria o usuário e o backend devolve uma resposta controlada.

O navegador **não deve** chamar diretamente o Jellyfin nem conhecer sua chave de API.

## 3. Ambiente atual

- Ubuntu Server 24.04 LTS com CasaOS.
- IP do servidor Jellyfin/Ubuntu: `192.168.1.182`.
- Projeto na pasta: `/DATA/AppData/OtiumPlayer`.
- Acesso da página: `http://192.168.1.182:3005`.
- Container: `OtiumPlayer`.
- Nome da imagem Docker: `otiumplayer:latest` — nomes de imagens Docker devem estar em minúsculas.
- Mapeamento de portas: `3005:3000`.
- O container foi construído e iniciado com `docker compose up -d --build`.
- Endpoint de saúde esperado: `http://127.0.0.1:3005/api/health`, com resposta `{"status":"ok"}`.

## 4. Compose atual

O arquivo `compose.yaml` está configurado assim:

```yaml
services:
  OtiumPlayer:
    build:
      context: .
      dockerfile: Dockerfile
    image: otiumplayer:latest
    container_name: OtiumPlayer
    restart: unless-stopped

    env_file:
      - .env

    ports:
      - "3005:3000"

    init: true
    read_only: true

    tmpfs:
      - /tmp

    security_opt:
      - no-new-privileges:true
```

## 5. Arquivos e decisões já estabelecidas

A estrutura esperada é:

```text
/DATA/AppData/OtiumPlayer/
├── src/
│   ├── server.js
│   └── input.css
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── .env
├── .gitignore
├── Dockerfile
├── compose.yaml
├── package.json
└── package-lock.json
```

- `src/input.css` contém `@import "tailwindcss";`.
- O Tailwind foi alterado de CDN para CSS compilado localmente por causa da Content Security Policy (CSP) do Helmet.
- `public/index.html` deve carregar o CSS local com `<link rel="stylesheet" href="/styles.css">` e o JS local com `<script src="/app.js" defer></script>`.
- O formulário deve ter `id="register-form"`.
- `public/app.js` deve interceptar o evento `submit`, chamar `event.preventDefault()` e enviar `fetch("/api/users", ...)`.
- O formulário possui campos `username`, `password` e `confirmPassword`.
- O backend usa Express, Helmet, `express-rate-limit` e `dotenv`.
- A chave de API fica em `JELLYFIN_API_KEY` no `.env`; nunca deve ser colocada no HTML ou no JavaScript frontend.
- `JELLYFIN_URL` deve apontar para o endereço do Jellyfin acessível **a partir do container**, não para o próprio container de cadastro.
- Para produção pública, ainda são necessários HTTPS, CAPTCHA validado no backend, limites contra abuso e revisão das permissões padrão de usuários Jellyfin.

## 6. Erro atual a corrigir

A página abre em `http://192.168.1.182:3005`, mas os recursos estáticos falham com erros SSL, e o navegador tenta enviar o formulário para HTTPS.

Console reportado:

```text
(index):1 The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was untrustworthy. It was defined either in the final response or a redirect. Please deliver the response using the HTTPS protocol. You can also use the 'localhost' origin instead.

(index):1 The page requested an origin-keyed agent cluster using the Origin-Agent-Cluster header, but could not be origin-keyed since the origin 'http://192.168.1.182:3005' had previously been placed in a site-keyed agent cluster. Update your headers to uniformly request origin-keying for all pages on the origin.

styles.css:1 Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR
app.js:1 Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR
:3005/ok.png:1 Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR

(index):1 Unsafe attempt to load URL https://192.168.1.182:3005/ from frame with URL http://192.168.1.182:3005/. Domains, protocols and ports must match.

(index):1 Sending form data to 'https://192.168.1.182:3005/?username=juliejulie&password=assimquesefaz&confirmPassword=assimquesefaz' violates the following Content Security Policy directive: "form-action 'self'". The request has been blocked.
```

**Observação de segurança:** a mensagem do console inclui credenciais digitadas no formulário. Não reutilize essa senha; ela deve ser considerada exposta e trocada caso seja uma senha real.

## 7. Hipótese principal para investigação

O navegador está carregando a página por HTTP, mas tenta acessar `/styles.css`, `/app.js` e a página de destino por HTTPS. Isso sugere que o navegador pode estar aplicando HTTPS-First/HTTPS automático, uma política HSTS, uma extensão ou uma configuração anterior; também é preciso verificar se os caminhos e o HTML servidos pelo container correspondem aos arquivos atuais.

Não desativar o Helmet/CSP como primeira medida. A CSP `form-action 'self'` está bloqueando o envio a HTTPS porque a página original foi aberta em HTTP; não é a causa primária. O aviso de `Cross-Origin-Opener-Policy` é secundário e não explica sozinho o CSS ausente.

### Diagnóstico sugerido, em ordem

1. Abrir explicitamente `http://192.168.1.182:3005` numa janela privada, sem extensões, e confirmar se o navegador muda para HTTPS.
2. No DevTools → Network, verificar os URLs exatos e os cabeçalhos de resposta de `/`, `/styles.css` e `/app.js`.
3. Confirmar no `public/index.html` que os recursos são relativos:
   - `<link rel="stylesheet" href="/styles.css">`
   - `<script src="/app.js" defer></script>`
   e que não existe `action="https://..."`, `<base href="https://...">` ou outro URL HTTPS.
4. Verificar se `public/app.js` está sendo carregado; se não carregar, `event.preventDefault()` não será executado e o formulário tentará o envio tradicional.
5. Testar os recursos diretamente por HTTP:
   - `curl -I http://127.0.0.1:3005/styles.css`
   - `curl -I http://127.0.0.1:3005/app.js`
   - `curl -s http://127.0.0.1:3005/`
6. Verificar a versão efetiva dos arquivos dentro do container e reconstruir se necessário:
   - `docker compose logs --tail=100 OtiumPlayer`
   - `docker compose up -d --build`
7. Só depois de o HTTP funcionar, planejar HTTPS real por proxy reverso para uso público.

## 8. Estado do projeto

- O container foi criado no Ubuntu/CasaOS.
- O serviço parece estar acessível na porta `3005`.
- O problema atual ocorre no carregamento de CSS/JS e no envio do formulário, antes de confirmar a integração de criação de usuário com Jellyfin.
- A próxima IA deve primeiro diagnosticar a conversão HTTP→HTTPS e validar os recursos estáticos. Não avançar para testes de criação de usuário até o frontend e o JavaScript carregarem corretamente.
