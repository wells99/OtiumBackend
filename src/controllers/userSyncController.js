import { userSyncService } from "../services/userSyncService.js";

export const userSyncController = {
  async preview(_req, res, next) {
    try {
      res.json(await userSyncService.preview());
    } catch (err) {
      next(err);
    }
  },

  async fromJellyfin(_req, res, next) {
    try {
      res.json(await userSyncService.importJellyfinUsers());
    } catch (err) {
      next(err);
    }
  },

  async toJellyfin(req, res, next) {
    try {
      res.json(await userSyncService.exportDatabaseUsers(req.body?.passwords));
    } catch (err) {
      next(err);
    }
  },
};
