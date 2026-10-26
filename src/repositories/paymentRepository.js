import prisma from "../config/database.js";

function parseStoredData(rawWebhook) {
  if (!rawWebhook) return {};
  try {
    return JSON.parse(rawWebhook);
  } catch {
    return {};
  }
}

export const paymentRepository = {
  async create(data) {
    return prisma.payment.create({ data });
  },

  async findByExternalId(externalPaymentId) {
    return prisma.payment.findUnique({
      where: { externalPaymentId },
      include: { user: true },
    });
  },

  async saveCheckoutUrl(id, checkoutUrl) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    const storedData = parseStoredData(payment?.rawWebhook);
    return prisma.payment.update({
      where: { id },
      data: { rawWebhook: JSON.stringify({ ...storedData, checkoutUrl }) },
    });
  },

  async markFailed(id) {
    return prisma.payment.update({ where: { id }, data: { status: "failed" } });
  },

  async approveAndRenew(id, confirmation) {
    return prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!payment) return null;

      if (payment.status === "approved") {
        return {
          payment,
          user: payment.user,
          subscriptionEndsAt: payment.user.subscriptionEndsAt,
          alreadyApproved: true,
        };
      }

      if (payment.status !== "pending") {
        const error = new Error("Esta cobrança não está mais pendente.");
        error.statusCode = 409;
        throw error;
      }

      const now = new Date();
      const currentExpiration = payment.user.subscriptionEndsAt;
      const startDate = currentExpiration && currentExpiration > now ? currentExpiration : now;
      const subscriptionEndsAt = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const storedData = parseStoredData(payment.rawWebhook);

      await transaction.payment.update({
        where: { id },
        data: {
          status: "approved",
          rawWebhook: JSON.stringify({ ...storedData, ...confirmation }),
        },
      });
      const user = await transaction.user.update({
        where: { id: payment.userId },
        data: { status: "ativo", subscriptionEndsAt },
      });

      return { payment, user, subscriptionEndsAt, alreadyApproved: false };
    });
  },
};
