import { List, PlusCircle, Syringe, ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";

// Placeholder do usuário — login é uma versão futura. Por ora, fixo.
const USER = { name: "Amanda Gondra", initials: "AG" };

const NAV_ITEMS = [
  { to: "/", end: true, label: "Rebanho", Icon: List },
  { to: "/animais/novo", end: false, label: "Cadastrar animal", Icon: PlusCircle },
  { to: "/manejo", end: false, label: "Manejo sanitário", Icon: Syringe },
];

export function Sidebar() {
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
              alt="Rebanho"
              className="w-8 h-8 [filter:brightness(0)_invert(1)]"
            />
            <span className="text-xl font-semibold">Rebanho</span>
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
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Empurra o bloco de usuário pra base */}
          <div className="flex-1" />

          {/* Usuário (placeholder — sem ação por enquanto) */}
          <div className="flex items-center gap-3 px-2 py-3 border-t border-white/10">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-verde text-white text-sm font-semibold shrink-0">
              {USER.initials}
            </span>
            <span className="flex-1 text-sm font-medium truncate">
              {USER.name}
            </span>
            <ChevronDown size={16} className="text-white/50 shrink-0" />
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
        {NAV_ITEMS.map(({ to, end, label, Icon }) => (
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
            {label === "Cadastrar animal" ? "Cadastrar" : label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
