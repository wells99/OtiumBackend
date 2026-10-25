import { authService } from "../services/authService.js";

export const authController = {
  async register(req, res, next) {
    try {
      const { username, password, email } = req.body ?? {};
      const result = await authService.register({ username, password, email });
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { username, password } = req.body ?? {};
      const result = await authService.login({ username, password });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const result = await authService.getMe(req.user.id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
