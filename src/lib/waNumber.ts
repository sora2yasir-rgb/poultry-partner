export const WA_STORAGE_KEY = "mh:waNumber";

export function sanitizeWaNumber(input: string): string {
  return input.replace(/\D/g, "").slice(0, 15);
}

export function getStoredWaNumber(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(WA_STORAGE_KEY);
    return stored ? sanitizeWaNumber(stored) : "";
  } catch {
    return "";
  }
}