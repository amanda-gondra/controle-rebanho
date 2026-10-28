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

// ── Carência (D-12, RN-SAN-009/010) ──

// Fim da carência = data da aplicação + dias informados no produto. Sem dias
// informados, não há fim (carência "não informada" — nunca zero).
export function withdrawalEndDate(applicationDate: string, days: number | null | undefined): string | null {
  return days === null || days === undefined ? null : addDays(applicationDate, days);
}

export type WithdrawalRecord = {
  animalId: string;
  tag: string;
  productName: string;
  applicationDate: string; // AAAA-MM-DD
  withdrawalEndDate: string; // AAAA-MM-DD
};

// Animais em carência registrada NA DATA da venda: aplicação até a data e fim
// da carência depois dela. Um aviso por animal — o fim mais distante.
// Ordenado por brinco. Só aviso: quem decide é o produtor (RN-SAN-010).
export function findWithdrawalConflicts(saleDate: string, records: WithdrawalRecord[]): WithdrawalRecord[] {
  const latest = new Map<string, WithdrawalRecord>();
  for (const record of records) {
    if (record.applicationDate > saleDate || record.withdrawalEndDate <= saleDate) continue;
    const current = latest.get(record.animalId);
    if (!current || record.withdrawalEndDate > current.withdrawalEndDate) latest.set(record.animalId, record);
  }
  return [...latest.values()].sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR", { numeric: true }));
}

// ── Lembrete (D-40, RN-SAN-007/008) ──

// O lembrete continua aberto até: (a) a reaplicação ser registrada a partir
// dele; (b) ser dispensado; (c) nenhum animal do grupo continuar ativo.
// Nunca sai sozinho só porque o tempo passou.
export function isReminderOpen(state: { dismissed: boolean; reapplied: boolean; activeAnimals: number }): boolean {
  return !state.dismissed && !state.reapplied && state.activeAnimals > 0;
}
