import { Router } from "express";
import { paymentController } from "../controllers/paymentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Criação de intenção de pagamento (autenticada)
router.post("/create", authMiddleware, paymentController.create);

// Webhook de notificação de pagamento (aberto para as operadoras)
router.post("/webhook", paymentController.webhook);

export default router;
