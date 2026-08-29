// Regras de negócio do manejo sanitário — funções puras, fáceis de testar.

// Quantos dias de antecedência o alerta aparece.
export const REAPPLY_ALERT_WINDOW_DAYS = 7;

// Uma aplicação, do ponto de vista da regra de alerta (só o que importa aqui).
type ReapplyInput = {
  reapplyDate: Date | null;
};

// Diz se uma reaplicação deve virar alerta hoje, e se está vencida.
// Regra: é alerta se tem data de reaplicação E essa data é <= hoje + janela
// (isso inclui as vencidas, cuja data já passou). "overdue" = a data já passou.
export function classifyReapplication(
  application: ReapplyInput,
  now: Date = new Date(),
): { isAlert: boolean; overdue: boolean } {
  if (!application.reapplyDate) {
    return { isAlert: false, overdue: false };
  }

  const limit = new Date(now);
  limit.setDate(limit.getDate() + REAPPLY_ALERT_WINDOW_DAYS);

  const isAlert = application.reapplyDate <= limit;
  const overdue = application.reapplyDate < now;

  return { isAlert, overdue };
}