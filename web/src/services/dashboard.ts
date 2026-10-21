import { request } from "./api.js";
import type { Dashboard } from "../types/dashboard.js";

export function getDashboard(period: { from?: string; to?: string } = {}): Promise<Dashboard> {
  const params = new URLSearchParams();
  if (period.from) params.set("from", period.from);
  if (period.to) params.set("to", period.to);
  const query = params.toString();
  return request<Dashboard>(`/dashboard${query ? `?${query}` : ""}`);
}
