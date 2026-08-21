import { List, PlusCircle } from "lucide-react";
import { NavLink } from "react-router-dom";

export function Sidebar() {
  const linkBase =
    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer";
  const linkActive = "bg-verde-claro text-verde-escuro font-medium";
  const linkInactive = "text-texto-suave hover:bg-bege";

  return (
    <aside className="w-60 bg-card border-r border-borda min-h-screen p-4">
      {/* Logo (placeholder por enquanto) */}
      <div className="flex items-center gap-2 px-2 py-3 mb-4">
        <span className="text-xl">🐂</span>
        <span className="font-medium text-verde text-lg">Rebanho</span>
      </div>

      {/* Menu — só os itens da v1 */}
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
  );
}