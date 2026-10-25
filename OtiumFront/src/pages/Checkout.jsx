import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Navbar } from "../components/layout/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export function Checkout() {
  const { user, isTrialExpired } = useAuth();

  return (
    <div className="min-h-screen bg-[#0b0c10] pb-24">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold text-rose-300">
            <Sparkles className="h-4 w-4" />
            {isTrialExpired ? "Período de teste encerrado" : "Planos OtiumPlayer"}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold text-white sm:text-4xl">
            {isTrialExpired ? "Continue sua experiência" : "Escolha seu plano"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400">
            {isTrialExpired
              ? `Olá, ${user?.username || ""}. Seu acesso ao catálogo está pausado. Em breve você poderá escolher uma forma de pagamento para reativar sua conta.`
              : "As opções de assinatura e pagamento estarão disponíveis em breve."}
          </p>
        </div>

        <section className="mx-auto mt-10 max-w-lg rounded-2xl border border-gray-800 bg-gray-900/60 p-7 shadow-2xl sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600/15 text-rose-400">
            <CreditCard className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-white">Assinatura mensal</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Aqui serão apresentados os planos, valores e meios de pagamento assim que a integração de pagamentos estiver definida.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-rose-400" /> Acesso ao catálogo Jellyfin</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-rose-400" /> Ativação após confirmação do pagamento</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-rose-400" /> PIX e cartão conforme disponibilidade</li>
          </ul>
          <div className="mt-7 rounded-lg border border-gray-800 bg-black/20 px-4 py-3 text-center text-sm text-gray-400" role="status">
            Pagamentos ainda não configurados
          </div>
          <Link to={isTrialExpired ? "/login" : "/"} className="mt-5 block text-center text-sm font-medium text-rose-400 hover:text-rose-300">
            {isTrialExpired ? "Voltar ao login" : "Voltar ao catálogo"}
          </Link>
        </section>
      </main>
    </div>
  );
}
