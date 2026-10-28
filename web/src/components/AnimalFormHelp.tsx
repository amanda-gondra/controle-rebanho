import { Tag, Users, CalendarDays } from "lucide-react";
import { t } from "../i18n/index.js";
import { CowIcon } from "./ui/CowIcon.js";

// Painel de ajuda ao lado do cadastro/edição do animal: o que importa preencher
// certo. Só orientação — nenhum dado da fazenda.
export function AnimalFormHelp() {
  const items = [
    { icon: Tag, color: "text-verde", title: t("animal.form.helpPanel.tagTitle"), text: t("animal.form.helpPanel.tagText") },
    { icon: Users, color: "text-verde", title: t("animal.form.helpPanel.categoryTitle"), text: t("animal.form.helpPanel.categoryText") },
    { icon: CalendarDays, title: t("animal.form.helpPanel.entryTitle"), text: t("animal.form.helpPanel.entryText"), color: "text-[#1D5FA8]" },
  ];
  return (
    <aside className="bg-card border border-borda rounded-xl p-6 xl:sticky xl:top-6">
      <CowIcon size={64} className="text-verde" />
      <div aria-hidden="true" className="w-10 h-0.5 bg-verde my-4" />
      <h2 className="text-lg font-semibold text-texto leading-snug">{t("animal.form.helpPanel.title")}</h2>
      <p className="text-sm text-texto-suave mt-2 mb-6">{t("animal.form.helpPanel.subtitle")}</p>
      <ul className="space-y-4">
        {items.map(({ icon: Icon, title, text, color }) => (
          <li key={title} className="flex gap-3">
            <Icon size={18} aria-hidden="true" className={`${color} mt-0.5 shrink-0`} />
            <div>
              <p className="text-sm font-medium text-texto">{title}</p>
              <p className="text-sm text-texto-suave">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
