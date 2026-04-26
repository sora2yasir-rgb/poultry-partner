import { useEffect } from "react";
import { toast } from "sonner";
import { runDailyBackupIfDue, isDailyBackupEnabled } from "@/lib/dailyBackup";

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
      if (!isDailyBackupEnabled()) return;
      try {
        const did = await runDailyBackupIfDue();
        if (did) {
          toast.success("Daily payments backup downloaded", {
            description: "CSV + PDF saved to your device.",
          });
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
