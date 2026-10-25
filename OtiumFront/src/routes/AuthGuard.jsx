import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function AuthGuard() {
  const { signed, loading, isTrialExpired } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0c10] text-rose-500">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" replace />;
  }

  if (isTrialExpired) {
    return <Navigate to="/checkout" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyGuard() {
  const { signed, loading, isTrialExpired } = useAuth();

  if (loading) return null;

  if (signed) {
    if (isTrialExpired) {
      return <Navigate to="/checkout" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
