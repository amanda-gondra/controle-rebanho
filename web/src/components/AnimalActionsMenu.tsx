import { Handshake, Pencil, Trash2 } from "lucide-react";
import { ActionsMenu, type MenuAction } from "./ui/ActionsMenu.js";
import { t } from "../i18n/index.js";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  onSell?: () => void; // só para animais ativos (G5)
};

// Menu ⋮ de um animal na lista do rebanho
export function AnimalActionsMenu({ onEdit, onDelete, onSell }: Props) {
  const actions: MenuAction[] = [
    { label: t("common.edit"), icon: <Pencil size={15} aria-hidden="true" />, onSelect: onEdit },
    ...(onSell ? [{ label: t("animalTrades.registerSale"), icon: <Handshake size={15} aria-hidden="true" />, onSelect: onSell }] : []),
    { label: t("common.delete"), icon: <Trash2 size={15} aria-hidden="true" />, onSelect: onDelete, danger: true },
  ];
  return <ActionsMenu actions={actions} />;
}
