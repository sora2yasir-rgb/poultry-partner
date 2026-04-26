import { useEffect } from "react";
import { toast } from "sonner";
import { runDailyBackupIfDue, isDailyBackupEnabled } from "@/lib/dailyBackup";
import {
  runRegisterDailyPdfIfDue,
  isRegisterAutoEnabled,
} from "@/lib/registerBackup";

/**
 * Mount-once hook: on app start (and every hour after), if the user has
 * opted in to daily backups and today's backup hasn't run yet, trigger
 * the CSV+PDF download for today's payments.
 */
export function useDailyBackup() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        if (isDailyBackupEnabled()) {
          const did = await runDailyBackupIfDue();
          if (did) {
            toast.success("Daily payments backup downloaded", {
              description: "CSV + PDF saved to your device.",
            });
          }
        }
        if (isRegisterAutoEnabled()) {
          const did = await runRegisterDailyPdfIfDue();
          if (did) {
            toast.success("Daily Register PDF saved", {
              description: "Today's register downloaded to your device.",
            });
          }
        }
      } catch (e) {
        console.error("daily backup failed", e);
      }
    }

    // Run shortly after mount so the UI is settled.
    const t = setTimeout(tick, 1500);
    // Re-check every hour in case the app is left open across midnight.
    const i = setInterval(tick, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);
}
