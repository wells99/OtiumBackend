import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { registrationLimiter, loginLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

router.post("/register", registrationLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.get("/me", authMiddleware, authController.me);

export default router;
