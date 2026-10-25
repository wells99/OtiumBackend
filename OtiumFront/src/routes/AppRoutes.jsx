import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard, PublicOnlyGuard } from "./AuthGuard.jsx";
import { Login } from "../pages/Login.jsx";
import { Register } from "../pages/Register.jsx";
import { Home } from "../pages/Home.jsx";
import { Watch } from "../pages/Watch.jsx";
import { Checkout } from "../pages/Checkout.jsx";

export function AppRoutes() {
  return (
    <Routes>
      {/* Rotas públicas (apenas deslogados) */}
      <Route element={<PublicOnlyGuard />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Rota de Checkout acessível para renovação ou contas expiradas */}
      <Route path="/checkout" element={<Checkout />} />

      {/* Rotas protegidas (exigem estar logado e com trial/assinatura válidos) */}
      <Route element={<AuthGuard />}>
        <Route path="/" element={<Home />} />
        <Route path="/watch/:id" element={<Watch />} />
      </Route>

      {/* Rota padrão */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
