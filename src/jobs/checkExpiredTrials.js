import cron from "node-cron";
import { userRepository } from "../repositories/userRepository.js";
import * as jellyfinService from "../services/jellyfinService.js";

/**
 * Função executável manualmente ou pelo cron
 */
export async function runTrialExpirationCheck() {
  const now = new Date();
  try {
    const expiredUsers = await userRepository.findExpiredTrials(now);

    if (expiredUsers.length === 0) {
      return { expiredCount: 0 };
    }

    console.log(`[Cron] Encontradas ${expiredUsers.length} contas com trial expirado. Iniciando bloqueio...`);

    for (const user of expiredUsers) {
      try {
        await userRepository.update(user.id, { status: "trial_expirado" });

        if (user.jellyfinUserId) {
          await jellyfinService.setUserDisabledState(user.jellyfinUserId, true);
        }

        console.log(`[Cron] Usuário ${user.username} (${user.id}) desativado com sucesso.`);
      } catch (userErr) {
        console.error(`[Cron] Falha ao desativar usuário ${user.username}:`, userErr.message);
      }
    }

    return { expiredCount: expiredUsers.length };
  } catch (err) {
    console.error("[Cron] Erro ao executar verificação de expiração:", err.message);
    return { error: err.message };
  }
}

/**
 * Inicia o cron job para rodar a cada hora (no minuto 0)
 */
export function initTrialExpirationJob() {
  // Roda no minuto 0 de cada hora: '0 * * * *'
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Verificando contas com trial expirado...");
    await runTrialExpirationCheck();
  });

  console.log("[Cron] Job de verificação de trials agendado para rodar a cada hora.");
}
