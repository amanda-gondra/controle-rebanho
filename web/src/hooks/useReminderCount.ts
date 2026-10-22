import { useEffect, useState } from "react";
import { listAlerts } from "../services/sanitary.js";

// Quantos lembretes sanitários estão abertos (vencidos + chegando) — o
// mesmo de GET /alerts. Guardado por 60 s para não buscar a cada tela.
type Count = { overdue: number; upcoming: number };
let cache: { at: number; value: Count } | null = null;
let pending: Promise<Count> | null = null;
const TTL_MS = 60_000;

function load(): Promise<Count> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.value);
  pending ??= listAlerts()
    .then((alerts) => {
      const value = {
        overdue: alerts.filter((alert) => alert.overdue).length,
        upcoming: alerts.filter((alert) => !alert.overdue).length,
      };
      cache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

// Quem está mostrando o número (o sino) e precisa recarregar
const listeners = new Set<() => void>();

// Depois de registrar, dispensar ou excluir uma aplicação: esquece o número
// guardado e avisa o sino que já está na tela
export function invalidateReminderCount() {
  cache = null;
  listeners.forEach((listener) => listener());
}

export function useReminderCount(): Count | null {
  const [count, setCount] = useState<Count | null>(cache?.value ?? null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      load()
        .then((value) => !cancelled && setCount(value))
        .catch(() => !cancelled && setCount(null)); // sem número: o sino fica sem ponto
    refresh();
    listeners.add(refresh);
    return () => {
      cancelled = true;
      listeners.delete(refresh);
    };
  }, []);
  return count;
}
