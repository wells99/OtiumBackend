import { Router } from "express";
import authRoutes from "./authRoutes.js";
import paymentRoutes from "./paymentRoutes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/payments", paymentRoutes);

export default router;
