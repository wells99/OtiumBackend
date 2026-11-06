const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const CHANNEL_TABS = new Set(["videos", "shorts", "streams", "live", "featured", "playlists", "community", "about"]);
const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;
const HANDLE_PATTERN = /^@[a-zA-Z0-9._-]{3,100}$/;
const BARE_HANDLE_PATTERN = /^[a-zA-Z0-9._-]{3,100}$/;

function serviceError(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function parseChannelInput(input) {
  const value = input.trim();
  if (CHANNEL_ID_PATTERN.test(value)) return { kind: "id", value };
  if (HANDLE_PATTERN.test(value)) return { kind: "handle", value };
  if (BARE_HANDLE_PATTERN.test(value)) return { kind: "handle", value: `@${value}` };

  let url;
  try {
    url = new URL(value);
  } catch {
    throw serviceError("Informe um ID, @handle ou URL válida de canal do YouTube.");
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password) {
    throw serviceError("Só aceitamos canais no domínio oficial youtube.com.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "channel" && CHANNEL_ID_PATTERN.test(parts[1] || "")
    && (parts.length === 2 || (parts.length === 3 && CHANNEL_TABS.has(parts[2])))) {
    return { kind: "id", value: parts[1] };
  }
  if (HANDLE_PATTERN.test(parts[0] || "")
    && (parts.length === 1 || (parts.length === 2 && CHANNEL_TABS.has(parts[1])))) {
    return { kind: "handle", value: parts[0] };
  }
  if (parts.length === 2 && ["c", "user"].includes(parts[0]) && /^[a-zA-Z0-9._-]{1,100}$/.test(parts[1])) {
    return { kind: "legacy-url", value: `https://www.youtube.com/${parts[0]}/${parts[1]}` };
  }
  if (parts.length === 3 && ["c", "user"].includes(parts[0]) && CHANNEL_TABS.has(parts[2])
    && /^[a-zA-Z0-9._-]{1,100}$/.test(parts[1])) {
    return { kind: "legacy-url", value: `https://www.youtube.com/${parts[0]}/${parts[1]}` };
  }

  throw serviceError("A URL precisa apontar para um canal, não para vídeo, playlist ou outra página.");
}

async function fetchText(url, timeoutMs = 10000) {
  let target = new URL(url);
  let response;
  try {
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      response = await fetch(target, {
        headers: { "User-Agent": "OtiumFlix/1.0 (public YouTube channel validation)" },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === 5) throw new Error("redirect-limit");
      target = new URL(location, target);
      if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname) || target.username || target.password) {
        throw new Error("redirect-host");
      }
    }
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw serviceError("O YouTube demorou para responder. Tente novamente.", 503);
    }
    if (error.message === "redirect-host") throw serviceError("O YouTube redirecionou para um endereço não permitido.");
    if (error.message === "redirect-limit") throw serviceError("O endereço do canal redirecionou muitas vezes.");
    throw serviceError("Não foi possível consultar o canal no YouTube agora.", 503);
  }
  if (response.status === 404 || response.status === 410) {
    throw serviceError("Canal inexistente ou indisponível publicamente.");
  }
  if (!response.ok) {
    throw serviceError("Não foi possível confirmar o acesso público ao canal.", response.status >= 500 ? 503 : 422);
  }
  return response.text();
}

async function fetchChannelPage(reference) {
  const url = reference.kind === "id"
    ? `https://www.youtube.com/channel/${reference.value}`
    : reference.kind === "handle"
      ? `https://www.youtube.com/${encodeURIComponent(reference.value)}`
      : reference.value;
  const html = await fetchText(url, 12000);
  const patterns = [
    /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
    /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
    /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[a-zA-Z0-9_-]{22})["']/i,
    /<link[^>]+itemprop=["']url["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})["']/i,
    /<meta[^>]+itemprop=["']url["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})["']/i,
  ];
  const channelId = reference.kind === "id"
    ? reference.value
    : patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);
  if (!channelId) throw serviceError("Não foi possível identificar um canal público com esse endereço.");

  const rawName = html.match(/<meta[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s*-\s*YouTube\s*$/i, "");
  const name = rawName ? decodeXml(rawName).trim().slice(0, 191) : channelId;
  return { id: channelId, name: name || channelId };
}

export const youtubeChannelResolver = {
  async resolve(input) {
    const reference = parseChannelInput(input);
    const channel = await fetchChannelPage(reference);
    return {
      ...channel,
      url: `https://www.youtube.com/channel/${channel.id}`,
    };
  },
};
