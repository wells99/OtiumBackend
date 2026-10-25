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

## 7. Causa identificada e correção aplicada

A causa primária dos erros `net::ERR_SSL_PROTOCOL_ERROR` e da violação de CSP no formulário foi identificada:
- O pacote **Helmet (v8)** inclui por padrão a diretiva `upgrade-insecure-requests` em seu Content Security Policy (CSP).
- Ao acessar a página por HTTP puro (`http://192.168.1.182:3005`), o navegador recebia esse cabeçalho e forçava a conversão de todos os recursos estáticos (`/styles.css`, `/app.js`, `ok.png`) para `https://192.168.1.182:3005/...`.
- Como a porta 3005 no container fala apenas HTTP, a tentativa de handshake SSL resultava em `ERR_SSL_PROTOCOL_ERROR`.
- Como o `app.js` não carregava, o `event.preventDefault()` nunca era registrado. O clique no formulário disparava o submit HTML padrão, que também era forçado para HTTPS pelo navegador, violando a política `form-action 'self'`.

### Correção aplicada em `src/server.js`:
O Helmet foi reconfigurado para anular a diretiva `upgrade-insecure-requests`:

```javascript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "upgrade-insecure-requests": null,
      },
    },
  })
);
```

## 8. Estado do projeto e próximos passos

- **Código corrigido:** `src/server.js` atualizado para desativar o upgrade automático para HTTPS no Helmet.
- **Próximo passo imediato:**
  1. Reconstruir e subir o container Docker com a nova imagem: feito
     ```bash
     docker compose up -d --build
     ```
  2. Testar o carregamento da página em `http://192.168.1.182:3005` (preferencialmente em janela anônima para evitar cache anterior). feito
  3. Validar se `styles.css`, `app.js` e `ok.png` carregam com status 200 via HTTP.
  passo 3 feito
  4. Testar a submissão do formulário e validar a criação de usuário no endpoint `/api/users` integrando com o Jellyfin (`POST /Users/New`).

passo 4 testado:
- Carregamento estático 100% funcional.
- O formulário enviou a requisição e o backend respondeu com status 502 devido a retorno 401 (Unauthorized) do Jellyfin:
  `Jellyfin recusou a criação de usuário. Status: 401`

### Causa do 401 e Correção:
1. O backend estava enviando apenas o cabeçalho legado `X-Emby-Token: JELLYFIN_API_KEY`. Nas versões recentes do Jellyfin (10.9+), este cabeçalho legado foi descontinuado ou restrito em endpoints de administração como `/Users/New`, exigindo o cabeçalho padrão:
   `Authorization: MediaBrowser Client="OtiumPlayer", Device="Server", DeviceId="OtiumPlayer-Backend", Version="1.0.0", Token="..."`
2. Foi adicionado o cabeçalho `Authorization` padronizado e a exibição detalhada da resposta de erro do Jellyfin no console do backend.
3. Se o 401 persistir após o rebuild, verificar se a chave `JELLYFIN_API_KEY` no `.env` foi gerada por um usuário Administrador no painel do Jellyfin (Painel de Controle -> Chaves de API).

## Nesse momento, o sistema foi testado e funcionou corretamenta para a criação de
## uma nova conta.