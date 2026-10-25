import express from "express";
import helmet from "helmet";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import { authController } from "./controllers/authController.js";
import { registrationLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.disable("x-powered-by");

// Segurança HTTP
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

// Habilita CORS para permitir que o front-end React consuma a API
app.use(cors());

// Parse de JSON com limite seguro
app.use(express.json({ limit: "15kb" }));

// Servir arquivos estáticos existentes da pasta public
app.use(express.static("public"));

// Rota de compatibilidade com o formulário legatário em public/app.js
app.post("/api/users", registrationLimiter, authController.register);

// Rotas da API da aplicação
app.use("/api", apiRoutes);

// Middleware centralizado de tratamento de erros
app.use(errorHandler);

export default app;
