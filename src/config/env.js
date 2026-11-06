import "dotenv/config";

const {
  PORT = 3000,
  NODE_ENV = "development",
  DATABASE_URL,
  JWT_SECRET = "chave_secreta_padrao_trocar_em_producao",
  TRIAL_DAYS = "2",
  JELLYFIN_URL,
  JELLYFIN_API_KEY,
  INFINITEPAY_API_KEY,
  INFINITEPAY_HANDLE,
  PUBLIC_APP_URL = "https://otiumflix.com",
  USER_SYNC_ENABLED = "false",
  USER_SYNC_KEY = "",
  YOUTUBE_CHANNELS_WORKER_ENABLED = "false",
  YOUTUBE_CHANNELS_CHECK_CRON = "0 8,14,20 * * *",
  YOUTUBE_METUBE_URL = "",
} = process.env;

if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
  throw new Error("Configure JELLYFIN_URL e JELLYFIN_API_KEY no arquivo .env");
}

if (!DATABASE_URL || !DATABASE_URL.startsWith("mysql://")) {
  throw new Error("Configure DATABASE_URL com a conexão MySQL da Hostinger no arquivo .env");
}

if (USER_SYNC_ENABLED.toLowerCase() === "true" && USER_SYNC_KEY.trim().length < 32) {
  throw new Error("USER_SYNC_KEY deve ter pelo menos 32 caracteres quando USER_SYNC_ENABLED=true.");
}

if (YOUTUBE_CHANNELS_WORKER_ENABLED.toLowerCase() === "true" && !YOUTUBE_METUBE_URL) {
  throw new Error("Configure YOUTUBE_METUBE_URL quando YOUTUBE_CHANNELS_WORKER_ENABLED=true.");
}

if (YOUTUBE_METUBE_URL) {
  let metubeUrl;
  try {
    metubeUrl = new URL(YOUTUBE_METUBE_URL);
  } catch {
    throw new Error("YOUTUBE_METUBE_URL precisa ser uma URL HTTP/HTTPS válida.");
  }
  if (!["http:", "https:"].includes(metubeUrl.protocol) || metubeUrl.username || metubeUrl.password) {
    throw new Error("YOUTUBE_METUBE_URL precisa usar HTTP/HTTPS e não pode conter credenciais embutidas.");
  }
}

export const env = {
  port: Number(PORT) || 3000,
  nodeEnv: NODE_ENV,
  databaseUrl: DATABASE_URL,
  jwtSecret: JWT_SECRET,
  trialDays: Number(TRIAL_DAYS) || 2,
  jellyfinUrl: JELLYFIN_URL.replace(/\/+$/, ""),
  jellyfinApiKey: JELLYFIN_API_KEY,
  infinitePayApiKey: INFINITEPAY_API_KEY || "",
  infinitePayHandle: INFINITEPAY_HANDLE || "",
  publicAppUrl: PUBLIC_APP_URL.replace(/\/+$/, ""),
  userSyncEnabled: USER_SYNC_ENABLED.toLowerCase() === "true",
  userSyncKey: USER_SYNC_KEY,
  youtubeChannelsWorkerEnabled: YOUTUBE_CHANNELS_WORKER_ENABLED.toLowerCase() === "true",
  youtubeChannelsCheckCron: YOUTUBE_CHANNELS_CHECK_CRON,
  youtubeMetubeUrl: YOUTUBE_METUBE_URL.replace(/\/+$/, ""),
};
