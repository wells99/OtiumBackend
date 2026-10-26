import { Router } from "express";
import { paymentController } from "../controllers/paymentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { paymentCreationLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

router.post("/create", authMiddleware, paymentCreationLimiter, paymentController.create);
router.post("/confirm", authMiddleware, paymentController.confirm);

// O webhook é confirmado no servidor por meio do endpoint payment_check.
router.post("/webhook", paymentController.webhook);

export default router;
