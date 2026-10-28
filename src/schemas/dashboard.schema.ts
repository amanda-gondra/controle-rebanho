import { z } from "zod";
import { calendarDate } from "./common.schema.js";

// Painel (D-50): período opcional (padrão = mês corrente até hoje)
export const MAX_DASHBOARD_PERIOD_DAYS = 731;

export const dashboardQuerySchema = z
  .object({ from: calendarDate.optional(), to: calendarDate.optional() })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "A data inicial não pode ser depois da final.",
    path: ["to"],
    params: { code: "PERIOD_INVALID" },
  });
