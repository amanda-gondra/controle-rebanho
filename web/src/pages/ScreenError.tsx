import { useRouteError } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { buttonClass } from "../components/buttonStyles.js";
import { t } from "../i18n/index.js";

// Falha inesperada ao desenhar uma tela (erro de programação, versão antiga em
// cache...): no lugar da página técnica do React Router, uma mensagem simples
// e o caminho de volta. Os detalhes vão só para o console de quem desenvolve.
export function ScreenError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="min-h-screen bg-bege flex items-center justify-center p-4">
      <div role="alert" className="bg-card border border-borda rounded-xl p-8 text-center max-w-md">
        <h1 className="text-xl font-semibold text-texto mb-2">{t("screenError.title")}</h1>
        <p className="text-texto-suave mb-5">{t("screenError.help")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary")}>
            <RotateCcw size={16} aria-hidden="true" /> {t("screenError.reload")}
          </button>
          <a href="/painel" className={buttonClass("secondary")}>
            {t("screenError.toDashboard")}
          </a>
        </div>
      </div>
    </div>
  );
}
