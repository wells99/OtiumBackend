import { Router } from "express";
import { userSyncController } from "../controllers/userSyncController.js";
import { requireUserSyncAccess } from "../middlewares/userSyncAccess.js";

const router = Router();
router.use(requireUserSyncAccess);
router.get("/preview", userSyncController.preview);
router.post("/from-jellyfin", userSyncController.fromJellyfin);
router.post("/to-jellyfin", userSyncController.toJellyfin);

export default router;
