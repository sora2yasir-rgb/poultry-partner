import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";
import { buildRegisterReport, registerToPdf } from "@/lib/registerPdf";
import { downloadBlob } from "@/lib/paymentExport";
import {
  isRegisterAutoEnabled,
  setRegisterAutoEnabled,
  getRegisterLastAt,
  runRegisterDailyPdfIfDue,
} from "@/lib/registerBackup";
import { toast } from "sonner";
import { FileText, CalendarClock, Eye, EyeOff, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/app/register")({
  head: () => ({
    meta: [
      { title: "Daily Register — PoultryBooks" },
      { name: "description", content: "Daily retailer register: birds, weight, rate, amount, paid and balance." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [date, setDate] = useState(todayStr());
  const [autoOn, setAutoOn] = useState(false);
  const [lastAutoAt, setLastAutoAt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmpty, setPreviewEmpty] = useState(false);

  useEffect(() => {
    setAutoOn(isRegisterAutoEnabled());
    setLastAutoAt(getRegisterLastAt());
  }, []);

  async function buildPreview() {
    setPreviewLoading(true);
    setPreviewEmpty(false);
    try {
      const report = await buildRegisterReport(date);
      if (report.rows.length === 0) {
        setPreviewEmpty(true);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        return;
      }
      const bytes = await registerToPdf(report);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not build preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (!previewOpen) return;
    buildPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, date]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto(on: boolean) {
    setRegisterAutoEnabled(on);
    setAutoOn(on);
    if (on) {
      toast.success("Auto-save enabled", {
        description: "Today's Daily Register PDF will be saved to this device once a day.",
      });
    } else {
      toast.message("Auto-save turned off");
    }
  }

  async function downloadPdf(forceAuto = false) {
    setDownloading(true);
    try {
      if (forceAuto) {
        const did = await runRegisterDailyPdfIfDue({ date, force: true });
        setLastAutoAt(getRegisterLastAt());
        if (!did) toast.info("Nothing to export for this date");
        return;
      }
      const report = await buildRegisterReport(date);
      if (report.rows.length === 0) {
        toast.info("No bills or payments for this date");
        return;
      }
      const bytes = await registerToPdf(report);
      downloadBlob(bytes.buffer as ArrayBuffer, `register-${date}.pdf`, "application/pdf");
      toast.success(`Register PDF downloaded for ${fmtDate(date)}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  const data = useLiveQuery(async () => {
    const bills = await db.bills.where("date").equals(date).toArray();
    const payments = await db.payments.where("date").equals(date).toArray();
    const customers = await db.customers.toArray();
    // Bills in order they were created (matches the physical book)
    bills.sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Per-bill Paid is derived from payments linked via bill_id (source of truth).
    const paidByBill = new Map<number, number>();
    for (const p of payments) {
      if (p.bill_id == null) continue;
      paidByBill.set(p.bill_id, (paidByBill.get(p.bill_id) ?? 0) + p.amount);
    }
    const billRows = bills.map((b) => {
      const paid = paidByBill.get(b.id!) ?? 0;
      return {
        ...b,
        paid_linked: paid,
        baki_linked: Math.max(0, b.grand_total - paid),
      };
    });
    // Payment-only rows: customers who paid today but have no bill on this date
    const billedCustomerIds = new Set(bills.map((b) => b.customer_id));
    const paymentOnlyByCustomer = new Map<number, { cash: number; online: number; firstAt: string }>();
    for (const p of payments) {
      if (billedCustomerIds.has(p.customer_id)) continue; // already shown via bill row
      const cur = paymentOnlyByCustomer.get(p.customer_id) ?? { cash: 0, online: 0, firstAt: p.created_at };
      if (p.mode === "cash") cur.cash += p.amount;
      else cur.online += p.amount;
      if (p.created_at < cur.firstAt) cur.firstAt = p.created_at;
      paymentOnlyByCustomer.set(p.customer_id, cur);
    }
    const paymentOnlyRows = Array.from(paymentOnlyByCustomer.entries())
      .map(([customerId, v]) => {
        const c = customers.find((x) => x.id === customerId);
        return {
          customerId,
          name: c?.name ?? "Unknown",
          cash: v.cash,
          online: v.online,
          firstAt: v.firstAt,
        };
      })
      .sort((a, b) => a.firstAt.localeCompare(b.firstAt));
    return { bills: billRows, payments, paymentOnlyRows };
  }, [date]);

  const totals = (data?.bills ?? []).reduce(
    (s, b) => ({
      birds: s.birds + b.total_birds,
      weight: s.weight + b.total_weight,
      amount: s.amount + b.amount,
      paid: s.paid + b.paid_linked,
      baki: s.baki + b.baki_linked,
    }),
    { birds: 0, weight: 0, amount: 0, paid: 0, baki: 0 },
  );
  const cash = (data?.payments ?? []).filter((p) => p.mode === "cash").reduce((s, p) => s + p.amount, 0);
  const online = (data?.payments ?? []).filter((p) => p.mode === "online").reduce((s, p) => s + p.amount, 0);

  const billRowCount = data?.bills.length ?? 0;
  const paymentOnlyTotal = (data?.paymentOnlyRows ?? []).reduce((s, r) => s + r.cash + r.online, 0);
  const hasAnyRows = billRowCount > 0 || (data?.paymentOnlyRows.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Daily Register"
        description={fmtDate(date)}
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="date" className="text-sm">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            <Button variant="outline" onClick={() => setPreviewOpen((v) => !v)}>
              {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {previewOpen ? "Hide preview" : "Preview PDF"}
            </Button>
            <Button variant="outline" onClick={() => downloadPdf(false)} disabled={downloading}>
              <FileText className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {previewOpen && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">PDF preview — {fmtDate(date)}</div>
                  <div className="text-xs text-muted-foreground">
                    Live preview of the Daily Register PDF before download or auto-save.
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={buildPreview} disabled={previewLoading}>
                  <RefreshCw className={"h-4 w-4 " + (previewLoading ? "animate-spin" : "")} />
                  Refresh
                </Button>
              </div>
              {previewLoading && (
                <div className="h-[600px] flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                  Generating preview…
                </div>
              )}
              {!previewLoading && previewEmpty && (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                  No bills or payments for this date.
                </div>
              )}
              {!previewLoading && !previewEmpty && previewUrl && (
                <iframe
                  title="Daily Register PDF preview"
                  src={previewUrl}
                  className="w-full h-[600px] border rounded-md bg-muted"
                />
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <CalendarClock className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <div className="text-sm font-medium">Auto-save Daily Register PDF</div>
                  <div className="text-xs text-muted-foreground">
                    Saves today's register PDF to this device, once a day, while the app is open.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {lastAutoAt
                      ? `Last auto-save: ${new Date(lastAutoAt).toLocaleString("en-IN")}`
                      : "Never run yet"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" onClick={() => downloadPdf(true)} disabled={downloading}>
                  Save now
                </Button>
                <Switch checked={autoOn} onCheckedChange={toggleAuto} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Birds</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Prev Bal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && !hasAnyRows && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      No bills or payments for this date.
                    </TableCell>
                  </TableRow>
                )}
                {data?.bills.map((b, i) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link to="/app/bills/$billId" params={{ billId: String(b.id) }} className="font-medium hover:underline">
                        {b.customer_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{fmtInt(b.total_birds)}</TableCell>
                    <TableCell className="text-right">{fmt(b.total_weight)}</TableCell>
                    <TableCell className="text-right">{fmt(b.rate)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(b.amount)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(b.prev_baki)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(b.grand_total)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(b.paid_linked)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(b.baki_linked)}</TableCell>
                  </TableRow>
                ))}
                {data?.paymentOnlyRows.map((r, i) => (
                  <TableRow key={`pmt-${r.customerId}`} className="bg-muted/10">
                    <TableCell className="text-muted-foreground">{billRowCount + i + 1}</TableCell>
                    <TableCell>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">(payment only)</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.cash + r.online)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                ))}
                {data && hasAnyRows && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell></TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtInt(totals.birds)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.weight)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.amount)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.paid + paymentOnlyTotal)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.baki)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Cash Collected" value={fmtMoney(cash)} />
          <Stat label="Online Collected" value={fmtMoney(online)} />
          <Stat label="Total Collected" value={fmtMoney(cash + online)} highlight />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={"text-2xl font-semibold mt-1 " + (highlight ? "text-primary" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}