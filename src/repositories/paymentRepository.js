import prisma from "../config/database.js";

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

  async updateStatus(id, status, rawWebhook = null) {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(rawWebhook ? { rawWebhook: JSON.stringify(rawWebhook) } : {}),
      },
    });
  },
};
