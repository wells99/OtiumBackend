import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import * as jellyfinService from "./jellyfinService.js";

const INFINITEPAY_LINKS_URL = "https://api.checkout.infinitepay.io/links";
const INFINITEPAY_CHECK_URL = "https://api.checkout.infinitepay.io/payment_check";
const SUBSCRIPTION_PRICE_CENTS = 1000;
const SUBSCRIPTION_PRICE_REAIS = 10;

function serviceError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requirePaymentConfig() {
  if (!env.infinitePayApiKey || !env.infinitePayHandle || !env.publicAppUrl) {
    throw serviceError("O checkout ainda não está configurado no servidor.", 503);
  }
}

async function parseProviderResponse(response, action) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    console.error(`[InfinitePay] Falha ao ${action}; HTTP ${response.status}.`);
    throw serviceError(`A InfinitePay não conseguiu ${action}. Tente novamente mais tarde.`);
  }
  return payload;
}

export const paymentService = {
  async createPayment({ userId }) {
    requirePaymentConfig();

    const orderNsu = randomUUID();
    const payment = await paymentRepository.create({
      userId,
      amount: SUBSCRIPTION_PRICE_REAIS,
      currency: "BRL",
      provider: "infinitepay",
      externalPaymentId: orderNsu,
      status: "pending",
    });

    const webhookUrl = `${env.publicAppUrl}/api/payments/webhook`;
    const redirectUrl = `${env.publicAppUrl}/checkout`;
    const requestBody = {
      order_nsu: orderNsu,
      redirect_url: redirectUrl,
      items: [{ quantity: 1, price: SUBSCRIPTION_PRICE_CENTS, description: "Assinatura OtiumFlix por 30 dias" }],
      options: {
        single_payment: true,
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        payment_methods_enabled: ["credit_card", "pix"],
      },
      webhook: { url: webhookUrl, events: ["paid"] },
    };

    try {
      const response = await fetch(INFINITEPAY_LINKS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": env.infinitePayApiKey },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await parseProviderResponse(response, "criar o link de pagamento");
      const checkoutUrl = payload.url || payload.checkout_url || payload.data?.url;
      if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
        throw serviceError("A InfinitePay retornou um link de pagamento inválido.");
      }

      await paymentRepository.saveCheckoutUrl(payment.id, checkoutUrl);
      return {
        id: payment.id,
        orderNsu,
        amount: SUBSCRIPTION_PRICE_REAIS,
        currency: "BRL",
        status: "pending",
        checkoutUrl,
      };
    } catch (error) {
      await paymentRepository.markFailed(payment.id).catch((dbError) => {
        console.error("[InfinitePay] Não foi possível marcar a cobrança com falha:", dbError.message);
      });
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw serviceError("A InfinitePay demorou para responder. Tente gerar outro link.", 504);
      }
      throw error;
    }
  },

  async confirmPayment({ orderNsu, transactionNsu, invoiceSlug, userId }) {
    requirePaymentConfig();
    const payment = await paymentRepository.findByExternalId(orderNsu);
    if (!payment || payment.provider !== "infinitepay" || (userId && payment.userId !== userId)) {
      throw serviceError("Cobrança não encontrada.", 404);
    }

    if (payment.status === "approved") {
      const subscriptionIsActive = payment.user.status === "ativo"
        && payment.user.subscriptionEndsAt
        && payment.user.subscriptionEndsAt > new Date();
      if (subscriptionIsActive && payment.user.jellyfinUserId) {
        await jellyfinService.setUserDisabledState(payment.user.jellyfinUserId, false);
      }
      return {
        success: true,
        paid: true,
        status: "approved",
        subscriptionEndsAt: payment.user.subscriptionEndsAt,
      };
    }
    if (payment.status !== "pending") {
      throw serviceError("Esta cobrança não está mais pendente.", 409);
    }
    if (!transactionNsu || !invoiceSlug) {
      throw serviceError("A InfinitePay não retornou os dados necessários para verificar o pagamento.", 400);
    }

    let response;
    try {
      response = await fetch(INFINITEPAY_CHECK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": env.infinitePayApiKey },
        body: JSON.stringify({
          handle: env.infinitePayHandle,
          order_nsu: orderNsu,
          transaction_nsu: transactionNsu,
          slug: invoiceSlug,
        }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      console.error("[InfinitePay] Falha ao consultar o pagamento:", error.message);
      throw serviceError("Não foi possível confirmar o pagamento agora. Tente novamente.", 503);
    }

    const verification = await parseProviderResponse(response, "verificar o pagamento");
    if (verification.paid !== true) {
      return { success: true, paid: false, status: "pending" };
    }
    if (Number(verification.amount) !== Math.round(payment.amount * 100)) {
      console.error("[InfinitePay] Valor confirmado difere do valor da cobrança local.");
      throw serviceError("O valor confirmado não corresponde à cobrança.", 409);
    }

    const confirmation = {
      transactionNsu,
      invoiceSlug,
      captureMethod: verification.capture_method || null,
      paidAmountCents: Number.isFinite(Number(verification.paid_amount)) ? Number(verification.paid_amount) : null,
      verifiedAt: new Date().toISOString(),
    };
    const approved = await paymentRepository.approveAndRenew(payment.id, confirmation);
    if (!approved) throw serviceError("Cobrança não encontrada.", 404);

    if (approved.user.jellyfinUserId) {
      await jellyfinService.setUserDisabledState(approved.user.jellyfinUserId, false);
    }

    return {
      success: true,
      paid: true,
      status: "approved",
      subscriptionEndsAt: approved.subscriptionEndsAt,
    };
  },
};
