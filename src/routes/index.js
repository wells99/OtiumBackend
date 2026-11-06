import { Router } from "express";
import authRoutes from "./authRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import youtubeChannelRoutes from "./youtubeChannelRoutes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/payments", paymentRoutes);
router.use("/youtube-channels", youtubeChannelRoutes);

export default router;
