import prisma from "../config/database.js";
import { env } from "../config/env.js";
import { youtubeChannelResolver } from "./youtubeChannelResolver.js";

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isEligible(user, now) {
  if (user.status === "trial_ativo") return user.trialEndsAt > now;
  if (user.status === "ativo") return !user.subscriptionEndsAt || user.subscriptionEndsAt > now;
  return false;
}

function entitlementFor(user, used, now = new Date()) {
  const limit = user.plan?.maxYoutubeChannels ?? 0;
  const eligible = isEligible(user, now) && Boolean(user.plan?.active);
  return {
    plan: user.plan ? { code: user.plan.code, name: user.plan.name } : null,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    eligible,
    workerEnabled: env.youtubeChannelsWorkerEnabled,
  };
}

export const youtubeChannelService = {
  async list(userId) {
    const [user, associations] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { plan: true } }),
      prisma.userYoutubeChannel.findMany({
        where: { userId },
        include: { channel: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!user) throw serviceError("Usuário não encontrado.", 404);

    return {
      ...entitlementFor(user, associations.length),
      channels: associations.map(({ channel, status, createdAt }) => ({
        id: channel.id,
        name: channel.name,
        url: channel.url,
        status,
        addedAt: createdAt,
        lastCheckedAt: channel.lastCheckedAt,
      })),
    };
  },

  async add({ userId, input }) {
    const resolved = await youtubeChannelResolver.resolve(input);
    const now = new Date();

    return prisma.$transaction(async (transaction) => {
      // Serialize additions for one account so concurrent requests cannot exceed its plan limit.
      await transaction.$queryRaw`SELECT id FROM \`User\` WHERE id = ${userId} FOR UPDATE`;
      const user = await transaction.user.findUnique({ where: { id: userId }, include: { plan: true } });
      if (!user) throw serviceError("Usuário não encontrado.", 404);

      const key = { userId_channelId: { userId, channelId: resolved.id } };
      const existing = await transaction.userYoutubeChannel.findUnique({ where: key });
      const count = await transaction.userYoutubeChannel.count({ where: { userId } });
      if (existing) {
        return { duplicate: true, ...entitlementFor(user, count, now) };
      }

      if (!isEligible(user, now) || !user.plan?.active) {
        throw serviceError("Sua conta não está elegível para adicionar canais no momento.", 403);
      }
      const limit = user.plan.maxYoutubeChannels;
      if (count >= limit) {
        throw serviceError("Você já atingiu o limite de canais do seu plano.", 409);
      }

      await transaction.youtubeChannel.upsert({
        where: { id: resolved.id },
        create: { ...resolved, addedAt: now },
        update: { name: resolved.name, url: resolved.url },
      });
      await transaction.userYoutubeChannel.create({ data: { userId, channelId: resolved.id } });

      return {
        duplicate: false,
        channel: resolved,
        ...entitlementFor(user, count + 1, now),
      };
    }, { isolationLevel: "Serializable" });
  },

  async remove({ userId, channelId }) {
    const result = await prisma.userYoutubeChannel.deleteMany({ where: { userId, channelId } });
    if (result.count === 0) throw serviceError("Canal não encontrado na sua lista.", 404);
    return { removed: true };
  },
};
