import { paymentRepository } from "../repositories/paymentRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import * as jellyfinService from "./jellyfinService.js";

export const paymentService = {
  /**
   * Registra uma intenção de pagamento no banco local.
   * Pode ser expandido com a chamada à API do gateway (Mercado Pago, Asaas, etc.).
   */
  async createPayment({ userId, amount, provider = "mercadopago", externalPaymentId }) {
    return paymentRepository.create({
      userId,
      amount: Number(amount),
      provider,
      externalPaymentId: externalPaymentId || `simulated_${Date.now()}`,
      status: "pending",
    });
  },

  /**
   * Processa a notificação/webhook de pagamento aprovado
   */
  async processPaymentApproval(externalPaymentId, webhookPayload = null) {
    const payment = await paymentRepository.findByExternalId(externalPaymentId);

    if (!payment) {
      const err = new Error(`Pagamento com ID externo ${externalPaymentId} não encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    // Atualiza status do pagamento
    await paymentRepository.updateStatus(payment.id, "approved", webhookPayload);

    // Concede 30 dias a partir de agora (ou da data atual de expiração se ainda for futura)
    const baseDate = payment.user.subscriptionEndsAt && payment.user.subscriptionEndsAt > new Date()
      ? payment.user.subscriptionEndsAt
      : new Date();

    const newSubscriptionEndsAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Reativa a conta do usuário no banco local
    await userRepository.update(payment.userId, {
      status: "ativo",
      subscriptionEndsAt: newSubscriptionEndsAt,
    });

    // Desbloqueia o usuário na API do Jellyfin imediatamente
    if (payment.user.jellyfinUserId) {
      await jellyfinService.setUserDisabledState(payment.user.jellyfinUserId, false);
    }

    return {
      success: true,
      userId: payment.userId,
      status: "ativo",
      subscriptionEndsAt: newSubscriptionEndsAt,
    };
  },
};
