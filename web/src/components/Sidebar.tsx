import { initialsOf } from "../types/format.js";
import { List, PlusCircle, Syringe, LogOut, Settings, Handshake, LayoutDashboard, Layers } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { sectionOf, type Section } from "../navigation/origin.js";
import { useAuth } from "./AuthProvider.js";
import { t, type MessageKey } from "../i18n/index.js";


// `mobile: false` = fica só no menu do computador (a barra do celular tem
// espaço para poucos itens; "Cadastrar animal" está no topo da lista)
const NAV_ITEMS = [
  { section: "dashboard", to: "/painel", end: false, label: "nav.dashboard", short: "nav.dashboardShort", Icon: LayoutDashboard, mobile: true },
  { section: "herd", to: "/", end: true, label: "nav.herd", short: "nav.herdShort", Icon: List, mobile: true },
  { section: "addAnimal", to: "/animais/novo", end: false, label: "nav.addAnimal", short: "nav.addAnimalShort", Icon: PlusCircle, mobile: false },
  { section: "lots", to: "/lotes", end: false, label: "nav.lots", short: "nav.lotsShort", Icon: Layers, mobile: true },
  { section: "sanitary", to: "/manejo", end: false, label: "nav.sanitary", short: "nav.sanitaryShort", Icon: Syringe, mobile: true },
  { section: "trades", to: "/negociacoes", end: false, label: "nav.trades", short: "nav.tradesShort", Icon: Handshake, mobile: true },
] satisfies { section: Section; to: string; end: boolean; label: MessageKey; short: MessageKey; Icon: unknown; mobile: boolean }[];

// Configurações (G2): fica separada, logo acima do usuário (desktop); no
// celular entra como mais um botão da barra inferior.
const SETTINGS_ITEM = {
  section: "settings" as Section,
  to: "/configuracoes",
  end: false,
  label: "nav.settings",
  short: "nav.settingsShort",
  Icon: Settings,
} satisfies { label: MessageKey; short: MessageKey } & Record<string, unknown>;

export function Sidebar() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  // Item marcado pela SEÇÃO (ficha do animal → Rebanho; aplicação e produtos → Manejo)
  const active = sectionOf(useLocation().pathname);

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
          {/* Logo oficial (versão para fundo escuro) */}
          <div className="flex items-center gap-2.5 px-1 py-2 mb-6">
            <img src="/brand/camporico-mark.png" alt="" className="w-11 h-auto" />
            <img src="/brand/camporico-wordmark-dark.png" alt={t("brand.name")} className="h-[26px] w-auto" />
          </div>

          {/* Navegação */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ section, to, end, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-current={active === section ? "page" : undefined}
                className={() =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] cursor-pointer transition-colors ${
                    active === section
                      ? "bg-sidebar-ativo text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={20} aria-hidden="true" />
                {t(label)}
              </NavLink>
            ))}
          </nav>

          {/* Empurra o bloco de usuário pra base */}
          <div className="flex-1" />

          <NavLink
            to={SETTINGS_ITEM.to}
            aria-current={active === SETTINGS_ITEM.section ? "page" : undefined}
            className={() =>
              `flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-[15px] cursor-pointer transition-colors ${
                active === SETTINGS_ITEM.section
                  ? "bg-sidebar-ativo text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <SETTINGS_ITEM.Icon size={20} aria-hidden="true" />
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

        {/* Paisagem decorativa: morros, árvores e um boi em silhueta (z-0) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 260 190"
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-x-0 bottom-0 z-0 w-full h-48 pointer-events-none opacity-90"
        >
          <path d="M0 110 C 50 80, 95 95, 140 112 S 215 128, 260 98 L260 190 L0 190 Z" fill="#183320" />
          <g fill="#1D3B24">
            <ellipse cx="38" cy="96" rx="20" ry="13" />
            <rect x="36" y="100" width="4" height="22" />
            <ellipse cx="62" cy="104" rx="12" ry="9" />
            <rect x="61" y="106" width="3" height="14" />
            <ellipse cx="214" cy="92" rx="18" ry="12" />
            <rect x="212" y="96" width="4" height="20" />
          </g>
          <path d="M0 136 C 60 112, 110 128, 170 134 S 230 142, 260 132 L260 190 L0 190 Z" fill="#1F3D24" />
          {/* boi */}
          <path
            d="M112 128 c3-4 9-6 16-6 h20 c4 0 7 1 9 3 l5-3 c2-1 4 0 4 2 l-1 4 c2 2 2 5 0 7 l-3 2 v8 h-3 v-6 h-2 v6 h-3 v-8 h-18 v8 h-3 v-6 h-2 v6 h-3 v-9 c-3-1-5-3-6-5 z"
            fill="#244527"
          />
          <path d="M0 160 C 70 146, 130 156, 190 160 S 240 164, 260 158 L260 190 L0 190 Z" fill="#22422A" />
        </svg>
      </aside>

      {/* BARRA INFERIOR — só no mobile (some no md pra cima) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar flex justify-around items-center h-16 z-40">
        {[...NAV_ITEMS.filter((item) => item.mobile), SETTINGS_ITEM].map(({ section, to, end, short, Icon }) => (
          <NavLink
            aria-current={active === section ? "page" : undefined}
            key={to}
            to={to}
            end={end}
            className={() =>
              `flex flex-col items-center gap-1 text-[11px] min-w-0 px-0.5 ${
                active === section ? "text-white font-medium" : "text-white/60"
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
