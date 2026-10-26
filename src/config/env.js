import "dotenv/config";

const {
  PORT = 3000,
  NODE_ENV = "development",
  DATABASE_URL = "file:./dev.db",
  JWT_SECRET = "chave_secreta_padrao_trocar_em_producao",
  TRIAL_DAYS = "2",
  JELLYFIN_URL,
  JELLYFIN_API_KEY,
  INFINITEPAY_API_KEY,
  INFINITEPAY_HANDLE,
  PUBLIC_APP_URL = "https://otiumflix.com",
} = process.env;

if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
  throw new Error("Configure JELLYFIN_URL e JELLYFIN_API_KEY no arquivo .env");
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
};
