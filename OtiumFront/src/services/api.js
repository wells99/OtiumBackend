import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para injetar o token JWT em todas as requisições autenticadas
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("@otium:token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de resposta: preserva erros de credenciais nas rotas públicas de autenticação.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const accountStatus = error.response?.data?.accountStatus;

    if (status === 403 && (accountStatus === "trial_expirado" || accountStatus === "bloqueado")) {
      // Notifica a aplicação sobre a expiração
      window.dispatchEvent(new CustomEvent("otium:account_expired", { detail: error.response.data }));
    } else if (status === 401 && !["/auth/login", "/auth/register"].includes(error.config?.url)) {
      localStorage.removeItem("@otium:token");
      localStorage.removeItem("@otium:user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
