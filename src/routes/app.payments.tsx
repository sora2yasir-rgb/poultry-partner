import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO, todayStr, type Bill } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  buildPaymentRows,
  paymentsToCsv,
  paymentsToPdf,
  downloadBlob,
} from "@/lib/paymentExport";
import { getCustomerBakiExcluding } from "@/lib/db";
import { toast } from "sonner";
import { IndianRupee, WifiOff, FileDown, FileText, CheckCircle2 } from "lucide-react";

const LAST_EXPORT_KEY = "payments_last_export_at";

export const Route = createFileRoute("/app/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const navigate = useNavigate();
  const customers = useLiveQuery(() => db.customers.orderBy("name").toArray(), []);
  const recent = useLiveQuery(
    () => db.payments.orderBy("created_at").reverse().limit(15).toArray(),
    [],
  );

  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  useEffect(() => {
    setLastExportAt(localStorage.getItem(LAST_EXPORT_KEY));
  }, []);

  const unexportedCount = useLiveQuery(async () => {
    if (!lastExportAt) return await db.payments.count();
    return await db.payments.where("created_at").above(lastExportAt).count();
  }, [lastExportAt]);

  const [customerId, setCustomerId] = useState<string>("");
  const [billId, setBillId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const cidNum = customerId ? Number(customerId) : null;
  const bills = useLiveQuery<Bill[]>(
    () =>
      cidNum
        ? db.bills.where("customer_id").equals(cidNum).reverse().sortBy("created_at")
        : Promise.resolve([] as Bill[]),
    [cidNum],
  );

  const customerName = useMemo(
    () => customers?.find((c) => c.id === cidNum)?.name ?? "",
    [customers, cidNum],
  );

  async function handleSave() {
    const a = Number(amount);
    if (!cidNum) {
      toast.error("Pick a customer");
      return;
    }
    if (!a || a <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    setSaving(true);
    try {
      const bid = billId !== "none" ? Number(billId) : null;
      await db.payments.add({
        customer_id: cidNum,
        bill_id: bid,
        date,
        amount: a,
        mode,
        note: note.trim() || undefined,
        created_at: nowISO(),
      });

      // Keep linked bill totals in sync so register Paid stays accurate
      if (bid) {
        const bill = await db.bills.get(bid);
        if (bill) {
          const newCash = bill.paid_cash + (mode === "cash" ? a : 0);
          const newOnline = bill.paid_online + (mode === "online" ? a : 0);
          const prevBaki = await getCustomerBakiExcluding(bill.customer_id, bill.id);
          const grand = bill.amount + prevBaki;
          const paid = newCash + newOnline;
          await db.bills.update(bid, {
            paid_cash: newCash,
            paid_online: newOnline,
            prev_baki: prevBaki,
            grand_total: grand,
            baki: grand - paid,
            updated_at: nowISO(),
          });
        }
      }

      toast.success(`Saved ₹${a} from ${customerName}`);
      setAmount("");
      setNote("");
      setBillId("none");
    } catch (e) {
      console.error(e);
      toast.error("Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup(format: "csv" | "pdf", scope: "new" | "all") {
    const all = await db.payments.orderBy("created_at").toArray();
    const list =
      scope === "new" && lastExportAt
        ? all.filter((p) => p.created_at > lastExportAt)
        : all;
    if (list.length === 0) {
      toast.info("Nothing new to export");
      return;
    }
    const rows = await buildPaymentRows(list);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const base = `payments-backup-${scope}-${stamp}`;
    if (format === "csv") {
      const csv = paymentsToCsv(rows);
      downloadBlob(csv, `${base}.csv`, "text/csv;charset=utf-8");
    } else {
      const bytes = await paymentsToPdf(rows);
      downloadBlob(bytes, `${base}.pdf`, "application/pdf");
    }
    const now = new Date().toISOString();
    localStorage.setItem(LAST_EXPORT_KEY, now);
    setLastExportAt(now);
    toast.success(`Exported ${list.length} payment${list.length === 1 ? "" : "s"}`);
  }

  return (
    <div>
      <PageHeader
        title="Quick Payment"
        description="Record a payment instantly. Saves locally — works fully offline."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportBackup("csv", "new")}
              disabled={!unexportedCount}
            >
              <FileDown className="h-4 w-4" />
              Export new (CSV)
              {unexportedCount ? (
                <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 text-xs">
                  {unexportedCount}
                </span>
              ) : null}
            </Button>
            <Button variant="outline" onClick={() => exportBackup("pdf", "new")} disabled={!unexportedCount}>
              <FileText className="h-4 w-4" />
              Export new (PDF)
            </Button>
            <Button variant="ghost" onClick={() => exportBackup("csv", "all")}>
              All as CSV
            </Button>
          </>
        }
      />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                Stored on this device. No internet needed.
              </div>
              {lastExportAt ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Last backup exported {new Date(lastExportAt).toLocaleString("en-IN")}
                  {unexportedCount ? ` · ${unexportedCount} new since` : " · all caught up"}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No backup exported yet. Use the Export buttons above.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Customer *</Label>
                  <Select
                    value={customerId}
                    onValueChange={(v) => {
                      setCustomerId(v);
                      setBillId("none");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label>Against bill (optional)</Label>
                  <Select value={billId} onValueChange={setBillId} disabled={!cidNum}>
                    <SelectTrigger>
                      <SelectValue placeholder="On account (no bill)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">On account (no bill)</SelectItem>
                      {bills?.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          #{b.bill_no} · {fmtDate(b.date)} · {fmtMoney(b.baki)} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "cash" | "online")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div>
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. UPI ref"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  <IndianRupee className="h-4 w-4" />
                  {saving ? "Saving…" : "Save Payment"}
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/app/register" })}>
                  View Register
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3">Recent payments</h3>
              {recent && recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{fmtDate(p.date)}</TableCell>
                        <TableCell className="text-xs capitalize">{p.mode}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {fmtMoney(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}