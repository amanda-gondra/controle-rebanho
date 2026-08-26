import { List, PlusCircle } from "lucide-react";
import { NavLink } from "react-router-dom";

export function Sidebar() {
  const linkBase =
    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer";
  const linkActive = "bg-verde-claro text-verde-escuro font-medium";
  const linkInactive = "text-texto-suave hover:bg-bege";

  return (
    <>
      {/* MENU LATERAL — só aparece no desktop (md pra cima) */}
      <aside className="hidden md:block w-60 bg-card border-r border-borda min-h-screen p-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <img src="/logo.png" alt="Rebanho" className="w-8 h-8" />
          <span className="font-medium text-verde text-lg">Rebanho</span>
        </div>

        {/* Menu */}
        <nav className="flex flex-col gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <List size={18} /> Rebanho
          </NavLink>
          <NavLink
            to="/animais/novo"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <PlusCircle size={18} /> Cadastrar animal
          </NavLink>
        </nav>
      </aside>

      {/* BARRA INFERIOR — só aparece no mobile (some no md pra cima) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-borda flex justify-around items-center h-16 z-40">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs ${
              isActive ? "text-verde-escuro font-medium" : "text-texto-suave"
            }`
          }
        >
          <List size={20} /> Rebanho
        </NavLink>
        <NavLink
          to="/animais/novo"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs ${
              isActive ? "text-verde-escuro font-medium" : "text-texto-suave"
            }`
          }
        >
          <PlusCircle size={20} /> Cadastrar
        </NavLink>
      </nav>
    </>
  );
}