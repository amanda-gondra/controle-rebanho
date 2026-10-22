import { initialsOf } from "../types/format.js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "./AuthProvider.js";
import { useReminderCount } from "../hooks/useReminderCount.js";
import { useOriginState } from "../navigation/hooks.js";
import { t } from "../i18n/index.js";

// Canto superior direito (computador): sino dos lembretes sanitários e menu da
// conta. O sino leva ao manejo; o ponto aparece só com lembrete aberto.
export function TopBarActions() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  const originState = useOriginState();
  const reminders = useReminderCount();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const total = reminders ? reminders.overdue + reminders.upcoming : 0;
  const name = account?.user.name ?? "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !wrapper.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="hidden md:flex items-center gap-4">
      <Link
        to="/manejo"
        state={originState}
        aria-label={total > 0 ? t("topbar.remindersCount", { count: total }) : t("topbar.noReminders")}
        title={total > 0 ? t("topbar.remindersCount", { count: total }) : t("topbar.noReminders")}
        className="relative p-2 rounded-full text-texto-suave hover:bg-card hover:text-texto"
      >
        <Bell size={20} aria-hidden="true" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-bege ${reminders!.overdue > 0 ? "bg-alerta" : "bg-verde"}`}
          />
        )}
      </Link>
      <div ref={wrapper} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-card cursor-pointer"
        >
          <span aria-hidden="true" className="flex items-center justify-center w-9 h-9 rounded-full bg-verde-escuro text-white text-sm font-semibold">
            {initialsOf(name)}
          </span>
          <span className="text-sm font-medium text-texto max-w-[12rem] truncate">{name}</span>
          <ChevronDown size={16} aria-hidden="true" className="text-texto-suave" />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 min-w-52 bg-card border border-borda rounded-xl shadow-lg py-1 z-40">
            <p className="px-3 py-2 text-xs text-texto-suave border-b border-borda truncate">{account?.farm.name}</p>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/configuracoes", { state: originState });
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-texto hover:bg-bege cursor-pointer"
            >
              <Settings size={15} aria-hidden="true" /> {t("nav.settings")}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate("/login", { replace: true });
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-texto hover:bg-bege cursor-pointer"
            >
              <LogOut size={15} aria-hidden="true" /> {t("nav.logoutLabel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
