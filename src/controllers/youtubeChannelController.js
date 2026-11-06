import { youtubeChannelService } from "../services/youtubeChannelService.js";

const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;

export const youtubeChannelController = {
  async list(req, res, next) {
    try {
      const result = await youtubeChannelService.list(req.user.id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async add(req, res, next) {
    try {
      const input = req.body?.channel;
      if (typeof input !== "string" || input.trim().length < 3 || input.length > 2048) {
        return res.status(400).json({ error: "Informe um ID, @handle ou URL de canal válida." });
      }
      const result = await youtubeChannelService.add({ userId: req.user.id, input });
      if (result.duplicate) {
        return res.status(409).json({ error: "Este canal já está associado à sua conta.", entitlement: result });
      }
      return res.status(201).json({ message: "Canal adicionado. Vídeos publicados antes da primeira inclusão não serão importados.", ...result });
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const { channelId } = req.params;
      if (!CHANNEL_ID_PATTERN.test(channelId)) {
        return res.status(400).json({ error: "ID de canal inválido." });
      }
      const result = await youtubeChannelService.remove({ userId: req.user.id, channelId });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
