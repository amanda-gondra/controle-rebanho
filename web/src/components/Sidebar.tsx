import { List, PlusCircle, Syringe, LogOut, Settings } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider.js";
import { t, type MessageKey } from "../i18n/index.js";

// Iniciais do nome para o "avatar" (ex.: "Maria Silva" → "MS")
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const NAV_ITEMS = [
  { to: "/", end: true, label: "nav.herd", short: "nav.herdShort", Icon: List },
  { to: "/animais/novo", end: false, label: "nav.addAnimal", short: "nav.addAnimalShort", Icon: PlusCircle },
  { to: "/manejo", end: false, label: "nav.sanitary", short: "nav.sanitaryShort", Icon: Syringe },
] satisfies { to: string; end: boolean; label: MessageKey; short: MessageKey; Icon: unknown }[];

// Configurações (G2): fica separada, logo acima do usuário (desktop); no
// celular entra como mais um botão da barra inferior.
const SETTINGS_ITEM = {
  to: "/configuracoes",
  end: false,
  label: "nav.settings",
  short: "nav.settingsShort",
  Icon: Settings,
} satisfies { label: MessageKey; short: MessageKey } & Record<string, unknown>;

export function Sidebar() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const userName = account?.user.name ?? "";
  const farmName = account?.farm.name ?? "";

  return (
    <>
      {/* MENU LATERAL — só no desktop (md pra cima) */}
      <aside className="hidden md:flex md:flex-col w-64 bg-sidebar text-white h-screen sticky top-0 overflow-hidden">
        {/* Conteúdo — acima dos morros (z-10) */}
        <div className="relative z-10 flex flex-col flex-1 p-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
            <img
              src="/logo.png"
              alt={t("common.appName")}
              className="w-8 h-8 [filter:brightness(0)_invert(1)]"
            />
            <span className="text-xl font-semibold">{t("common.appName")}</span>
          </div>

          {/* Navegação */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, end, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-sidebar-ativo text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                {t(label)}
              </NavLink>
            ))}
          </nav>

          {/* Empurra o bloco de usuário pra base */}
          <div className="flex-1" />

          <NavLink
            to={SETTINGS_ITEM.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-sidebar-ativo text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <SETTINGS_ITEM.Icon size={18} />
            {t(SETTINGS_ITEM.label)}
          </NavLink>

          {/* Usuário logado + sair (F-24) */}
          <div className="flex items-center gap-3 px-2 py-3 border-t border-white/10">
            <span
              aria-hidden="true"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-verde text-white text-sm font-semibold shrink-0"
            >
              {initialsOf(userName)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">{userName}</span>
              <span className="block text-xs text-white/60 truncate">{farmName}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              title={t("nav.logout")}
              aria-label={t("nav.logoutLabel")}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Morros decorativos — camadas de verde ao fundo (z-0) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 260 170"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 z-0 w-full h-44 pointer-events-none"
        >
          <path
            d="M0 90 C 45 55, 80 70, 120 95 S 200 120, 260 80 L260 170 L0 170 Z"
            fill="#1B331F"
          />
          <path
            d="M0 120 C 55 90, 95 110, 150 120 S 220 135, 260 115 L260 170 L0 170 Z"
            fill="#20391F"
          />
          <path
            d="M0 145 C 60 125, 110 140, 170 145 S 230 152, 260 145 L260 170 L0 170 Z"
            fill="#243E22"
          />
        </svg>
      </aside>

      {/* BARRA INFERIOR — só no mobile (some no md pra cima) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar flex justify-around items-center h-16 z-40">
        {[...NAV_ITEMS, SETTINGS_ITEM].map(({ to, end, short, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-xs ${
                isActive ? "text-white font-medium" : "text-white/60"
              }`
            }
          >
            <Icon size={20} />
            {t(short)}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-xs text-white/60 cursor-pointer"
        >
          <LogOut size={20} />
          {t("nav.logout")}
        </button>
      </nav>
    </>
  );
}
