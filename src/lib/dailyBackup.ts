import { db } from "./db";
import {
  buildPaymentRows,
  paymentsToCsv,
  paymentsToPdf,
  downloadBlob,
} from "./paymentExport";

const ENABLED_KEY = "payments_daily_backup_enabled";
const LAST_DAY_KEY = "payments_daily_backup_last_day";
const LAST_AT_KEY = "payments_daily_backup_last_at";
export const LAST_EXPORT_KEY = "payments_last_export_at";

export function isDailyBackupEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setDailyBackupEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

export function getLastBackupDay(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_DAY_KEY);
}

export function getLastBackupAt(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_AT_KEY);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Run the daily backup if enabled and not yet run today.
 * Triggers a browser download of two files (CSV + PDF) for today's payments.
 * Returns true if a backup was produced.
 */
export async function runDailyBackupIfDue(opts?: { force?: boolean }): Promise<boolean> {
  if (!opts?.force && !isDailyBackupEnabled()) return false;
  const today = todayKey();
  if (!opts?.force && getLastBackupDay() === today) return false;

  // Export everything from today (calendar day, local).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startISO = startOfDay.toISOString();

  const all = await db.payments.orderBy("created_at").toArray();
  const list = all.filter((p) => p.created_at >= startISO);
  if (list.length === 0) {
    // Mark the day as handled so we don't retry every minute.
    localStorage.setItem(LAST_DAY_KEY, today);
    localStorage.setItem(LAST_AT_KEY, new Date().toISOString());
    return false;
  }

  const rows = await buildPaymentRows(list);
  const stamp = today;
  const base = `payments-daily-${stamp}`;

  const csv = paymentsToCsv(rows);
  downloadBlob(csv, `${base}.csv`, "text/csv;charset=utf-8");

  const bytes = await paymentsToPdf(rows);
  downloadBlob(bytes.buffer as ArrayBuffer, `${base}.pdf`, "application/pdf");

  const now = new Date().toISOString();
  localStorage.setItem(LAST_DAY_KEY, today);
  localStorage.setItem(LAST_AT_KEY, now);
  // Also advance the "last export" marker so the "new since" badge resets.
  localStorage.setItem(LAST_EXPORT_KEY, now);
  return true;
}
