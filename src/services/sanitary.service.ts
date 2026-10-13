// Regras de negócio do manejo sanitário — funções puras, fáceis de testar.
import {
  DEFAULT_TIME_ZONE,
  addDays,
  calendarDateOf,
  todayInTimeZone,
} from "../lib/dates.js";

// Antecedência padrão do alerta, em dias. Cada fazenda pode mudar a sua nas
// configurações (G2 — Farm.reapplyAlertDays); este é só o valor quando nada é informado.
export const DEFAULT_REAPPLY_ALERT_DAYS = 7;

// Uma aplicação, do ponto de vista da regra de alerta (só o que importa aqui).
type ReapplyInput = {
  reapplyDate: Date | null;
};

// Diz se uma reaplicação deve virar alerta hoje, e se está vencida.
// Regra: é alerta se tem data de reaplicação E essa data é <= hoje + antecedência
// (isso inclui as vencidas). Antecedência 0 = só no dia (e as vencidas). "overdue" = a data é ANTERIOR a hoje.
//
// "Hoje" é o dia de calendário no fuso da fazenda (F-04): antes, às 21h em
// Brasília a reaplicação de amanhã já aparecia como vencida, porque a conta
// usava o relógio UTC.
export function classifyReapplication(
  application: ReapplyInput,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
  alertDays: number = DEFAULT_REAPPLY_ALERT_DAYS,
): { isAlert: boolean; overdue: boolean } {
  if (!application.reapplyDate) {
    return { isAlert: false, overdue: false };
  }

  const today = todayInTimeZone(timeZone, now);
  const reapplyDay = calendarDateOf(application.reapplyDate);
  const limit = addDays(today, alertDays);

  return {
    isAlert: reapplyDay <= limit,
    overdue: reapplyDay < today,
  };
}
