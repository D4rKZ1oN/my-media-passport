import type { MediaStatus } from "./types";

export const STATUS_VALUES: MediaStatus[] = ["Watching", "Completed", "Plan to Watch", "On Hold", "Dropped"];
export const STATUS_LABELS: Record<string, string> = {
  Watching: "Viendo",
  Completed: "Ya la vi",
  "Plan to Watch": "Próximo en ver",
  "On Hold": "En pausa",
  Dropped: "Abandonado"
};

export function isTruthy(value: unknown) {
  if (value === true) return true;
  const t = String(value ?? "").trim().toLowerCase();
  return ["true", "verdadero", "yes", "si", "sí", "1"].includes(t);
}

export function safeStatus(value: unknown): MediaStatus {
  const v = String(value || "Plan to Watch") as MediaStatus;
  return STATUS_VALUES.includes(v) ? v : "Plan to Watch";
}
