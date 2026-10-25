import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import * as jellyfinService from "./jellyfinService.js";

export const authService = {
  async register({ username, password, email }) {
    const normalizedUsername = username.trim();

    // Validações
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(normalizedUsername)) {
      const err = new Error("O usuário deve ter entre 3 e 30 caracteres: letras, números, ponto, hífen ou sublinhado.");
      err.statusCode = 400;
      throw err;
    }

    if (!password || password.length < 8 || password.length > 128) {
      const err = new Error("A senha deve ter entre 8 e 128 caracteres.");
      err.statusCode = 400;
      throw err;
    }

    // Verifica se já existe localmente
    const existingUser = await userRepository.findByUsername(normalizedUsername);
    if (existingUser) {
      const err = new Error("Nome de usuário já está em uso.");
      err.statusCode = 409;
      throw err;
    }

    if (email) {
      const existingEmail = await userRepository.findByEmail(email.trim().toLowerCase());
      if (existingEmail) {
        const err = new Error("E-mail já cadastrado.");
        err.statusCode = 409;
        throw err;
      }
    }

    // Cria o usuário na API do Jellyfin
    const jellyfinUser = await jellyfinService.createUser(normalizedUsername, password);

    // Calcula período de avaliação de 2 dias (ou valor em env.trialDays)
    const trialEndsAt = new Date(Date.now() + env.trialDays * 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(password, 10);

    // Cria o usuário no banco local
    const createdUser = await userRepository.create({
      username: normalizedUsername,
      email: email ? email.trim().toLowerCase() : null,
      passwordHash,
      jellyfinUserId: jellyfinUser.Id,
      status: "trial_ativo",
      trialEndsAt,
    });

    const token = jwt.sign(
      {
        id: createdUser.id,
        username: createdUser.username,
        jellyfinUserId: createdUser.jellyfinUserId,
      },
      env.jwtSecret,
      { expiresIn: "7d" }
    );

    return {
      user: {
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        status: createdUser.status,
        trialEndsAt: createdUser.trialEndsAt,
      },
      token,
    };
  },

  async login({ username, password }) {
    const normalizedUsername = (username || "").trim();
    const user = await userRepository.findByUsername(normalizedUsername);

    if (!user) {
      const err = new Error("Usuário ou senha incorretos.");
      err.statusCode = 401;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const err = new Error("Usuário ou senha incorretos.");
      err.statusCode = 401;
      throw err;
    }

    const now = new Date();

    // Verificação de expiração do trial
    if (user.status === "trial_ativo" && user.trialEndsAt < now) {
      await userRepository.update(user.id, { status: "trial_expirado" });
      if (user.jellyfinUserId) {
        await jellyfinService.setUserDisabledState(user.jellyfinUserId, true).catch(() => {});
      }
      user.status = "trial_expirado";
    }

    // Se estiver expirado ou bloqueado, informa o status para que o front-end envie para pagamento
    if (user.status === "trial_expirado" || user.status === "bloqueado") {
      const err = new Error("Seu período de teste expirou. Assine para continuar assistindo.");
      err.statusCode = 403;
      err.accountStatus = user.status;
      err.userId = user.id;
      throw err;
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        jellyfinUserId: user.jellyfinUserId,
      },
      env.jwtSecret,
      { expiresIn: "7d" }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
      },
      token,
    };
  },

  async getMe(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error("Usuário não encontrado.");
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    let currentStatus = user.status;

    if (currentStatus === "trial_ativo" && user.trialEndsAt < now) {
      currentStatus = "trial_expirado";
      await userRepository.update(user.id, { status: currentStatus });
      if (user.jellyfinUserId) {
        await jellyfinService.setUserDisabledState(user.jellyfinUserId, true).catch(() => {});
      }
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      status: currentStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionEndsAt: user.subscriptionEndsAt,
    };
  },
};
