import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router-dom";
import { originFrom, pathWithSearch, type OriginState } from "./origin.js";

// Abrir outra tela deixando a marca de onde veio (para o "voltar" voltar aqui)
export function useOpen() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (to: string, options: NavigateOptions = {}) =>
      navigate(to, { ...options, state: { from: pathWithSearch(location) } }),
    [navigate, location],
  );
}

// Para <Link state={...}>: a mesma marca
export function useOriginState() {
  const location = useLocation();
  return useMemo(() => ({ from: pathWithSearch(location) }), [location]);
}

// Voltar / cancelar / depois de salvar, a partir da origem desta tela.
// `fallback` = destino fixo quando a tela foi aberta sem origem (link direto).
export function useOrigin(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const origin = originFrom(location.state as OriginState);

  return useMemo(
    () => ({
      hasOrigin: origin !== null,
      // Volta para a tela anterior (a do sistema que abriu esta), com os filtros dela
      goBack: () => (origin ? navigate(-1) : navigate(fallback, { replace: true })),
      // Troca esta tela por outra mantendo a mesma origem (ex.: formulário
      // salvo → detalhe; o "voltar" do detalhe não reabre o formulário)
      replaceWith: (to: string) => navigate(to, { replace: true, state: origin ? { from: origin } : undefined }),
    }),
    [navigate, origin, fallback],
  );
}
