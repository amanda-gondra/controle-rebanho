import { Link } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.js";
import { buttonClass } from "../components/buttonStyles.js";
import { t } from "../i18n/index.js";

// Endereço que não existe dentro do sistema (antes: tela em branco)
export function NotFound() {
  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <div className="bg-card border border-borda rounded-xl p-8 text-center max-w-lg">
          <h1 className="text-xl font-semibold text-texto mb-2">{t("notFound.title")}</h1>
          <p className="text-texto-suave mb-5">{t("notFound.help")}</p>
          <Link to="/" className={buttonClass("primary")}>
            {t("notFound.toHerd")}
          </Link>
        </div>
      </main>
    </div>
  );
}
