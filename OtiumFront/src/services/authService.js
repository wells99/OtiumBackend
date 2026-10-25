import { api } from "./api.js";

export const authService = {
  async register({ username, password, email }) {
    const response = await api.post("/auth/register", { username, password, email });
    return response.data;
  },

  async login({ username, password }) {
    const response = await api.post("/auth/login", { username, password });
    return response.data;
  },

  async getMe() {
    const response = await api.get("/auth/me");
    return response.data;
  },
};
