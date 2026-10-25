import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Film, User, LogOut, CreditCard } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();

  const getStatusBadge = () => {
    if (!user) return null;

    if (user.status === "trial_ativo") {
      const endsAt = new Date(user.trialEndsAt);
      const diffHours = Math.max(0, Math.round((endsAt - new Date()) / (1000 * 60 * 60)));
      return (
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">
          Trial: ~{diffHours}h restantes
        </span>
      );
    }

    if (user.status === "ativo") {
      return (
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
          Assinante Ativo
        </span>
      );
    }

    return (
      <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">
        Acesso Expirado
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-800 bg-[#0b0c10]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-rose-500 hover:text-rose-400 transition">
            <Film className="h-6 w-6" />
            <span>OtiumPlayer</span>
          </Link>
          <nav className="hidden md:flex gap-4 text-sm text-gray-300">
            <Link to="/" className="hover:text-white transition">Início</Link>
            <Link to="/checkout" className="hover:text-white transition">Planos</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {getStatusBadge()}

          {user && (
            <div className="flex items-center gap-3">
              <Link
                to="/checkout"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition"
              >
                <CreditCard className="h-4 w-4" />
                Assinar
              </Link>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-white">{user.username}</span>
              </div>
              <button
                onClick={logout}
                title="Sair"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-rose-400 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
