import { downloadBlob } from "./paymentExport";
import { buildRegisterReport, registerToPdf } from "./registerPdf";

const ENABLED_KEY = "register_daily_pdf_enabled";
const LAST_DAY_KEY = "register_daily_pdf_last_day";
const LAST_AT_KEY = "register_daily_pdf_last_at";

export function isRegisterAutoEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}
export function setRegisterAutoEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}
export function getRegisterLastAt(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_AT_KEY);
}
export function getRegisterLastDay(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_DAY_KEY);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build today's Daily Register PDF and save it to this device.
 * If `force` is false, only runs once per calendar day when enabled.
 * Returns true if a file was downloaded.
 */
export async function runRegisterDailyPdfIfDue(opts?: {
  date?: string;
  force?: boolean;
}): Promise<boolean> {
  const date = opts?.date ?? todayKey();
  if (!opts?.force) {
    if (!isRegisterAutoEnabled()) return false;
    if (getRegisterLastDay() === date) return false;
  }

  const report = await buildRegisterReport(date);
  if (!opts?.force && report.rows.length === 0) {
    // Don't spam empty PDFs; mark day handled and bail.
    localStorage.setItem(LAST_DAY_KEY, date);
    localStorage.setItem(LAST_AT_KEY, new Date().toISOString());
    return false;
  }

  const bytes = await registerToPdf(report);
  downloadBlob(bytes.buffer as ArrayBuffer, `register-${date}.pdf`, "application/pdf");

  localStorage.setItem(LAST_DAY_KEY, date);
  localStorage.setItem(LAST_AT_KEY, new Date().toISOString());
  return true;
}
