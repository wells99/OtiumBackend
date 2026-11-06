import { Router } from "express";
import { youtubeChannelController } from "../controllers/youtubeChannelController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { youtubeChannelAddLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

router.use(authMiddleware);
router.get("/", youtubeChannelController.list);
router.post("/", youtubeChannelAddLimiter, youtubeChannelController.add);
router.delete("/:channelId", youtubeChannelController.remove);

export default router;
