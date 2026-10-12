import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.js";

// Protege as telas do sistema: sem login, manda para a tela de entrar e
// lembra para onde a pessoa queria ir (volta para lá depois de entrar).
export function RequireAuth() {
  const { loading, account } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bege flex items-center justify-center text-texto-suave">
        Carregando...
      </div>
    );
  }

  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

// O contrário: quem já está logado não precisa ver entrar/criar conta.
export function RedirectIfLoggedIn() {
  const { loading, account } = useAuth();
  if (loading) return null;
  if (account) return <Navigate to="/" replace />;
  return <Outlet />;
}
