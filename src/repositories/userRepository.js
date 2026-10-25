import prisma from "../config/database.js";

export const userRepository = {
  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByUsername(username) {
    return prisma.user.findUnique({ where: { username } });
  },

  async findByEmail(email) {
    if (!email) return null;
    return prisma.user.findUnique({ where: { email } });
  },

  async create(data) {
    return prisma.user.create({ data });
  },

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async findExpiredTrials(referenceDate = new Date()) {
    return prisma.user.findMany({
      where: {
        status: "trial_ativo",
        trialEndsAt: {
          lt: referenceDate,
        },
      },
    });
  },
};
