import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./config/database.js";
import { initTrialExpirationJob } from "./jobs/checkExpiredTrials.js";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`[Server] OtiumPlayer Back-end rodando na porta ${env.port} em modo ${env.nodeEnv}`);

  // Inicia a rotina agendada de verificação de trials
  initTrialExpirationJob();
});

// Encerramento gracioso
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Recebido ${signal}. Encerrando com segurança...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[Server] Conexões fechadas. Processo finalizado.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
