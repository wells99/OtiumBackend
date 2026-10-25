
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const app = express();

const {
  PORT = 3000,
  JELLYFIN_URL,
  JELLYFIN_API_KEY,
  NODE_ENV = "production",
} = process.env;

if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
  throw new Error("Configure JELLYFIN_URL e JELLYFIN_API_KEY no .env");
}

const jellyfinUrl = JELLYFIN_URL.replace(/\/+$/, "");

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas. Tente novamente mais tarde.",
  },
});

app.use(express.static("public"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/users", registrationLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Informe um usuário e uma senha válidos.",
    });
  }

  const normalizedUsername = username.trim();

  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(normalizedUsername)) {
    return res.status(400).json({
      error:
        "O usuário deve ter entre 3 e 30 caracteres: letras, números, ponto, hífen ou sublinhado.",
    });
  }

  if (
    password.length < 12 ||
    password.length > 128 ||
    password.trim().length === 0
  ) {
    return res.status(400).json({
      error: "A senha deve ter entre 12 e 128 caracteres.",
    });
  }

  try {
    const response = await fetch(`${jellyfinUrl}/Users/New`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": JELLYFIN_API_KEY,
      },
      body: JSON.stringify({
        Name: normalizedUsername,
        Password: password,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 409) {
        return res.status(409).json({
          error:
            "Não foi possível criar a conta. Verifique o nome de usuário.",
        });
      }

      console.error(
        "Jellyfin recusou a criação de usuário. Status:",
        response.status
      );

      return res.status(502).json({
        error: "Não foi possível concluir o cadastro agora.",
      });
    }

    const user = await response.json();

    return res.status(201).json({
      message: "Conta criada com sucesso!",
      username: user.Name ?? normalizedUsername,
    });
  } catch (error) {
    console.error(
      "Falha na comunicação com Jellyfin:",
      error.name === "TimeoutError" ? "timeout" : error.name
    );

    return res.status(502).json({
      error: "Servidor de mídia indisponível no momento.",
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "JSON inválido.",
    });
  }

  console.error("Erro inesperado na aplicação.");

  return res.status(500).json({
    error: "Erro interno.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aplicação iniciada na porta ${PORT}`);
});
