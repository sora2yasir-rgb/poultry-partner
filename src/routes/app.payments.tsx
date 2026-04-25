import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO, todayStr } from "@/lib/db";
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
import { getCustomerBakiExcluding } from "@/lib/db";
import { toast } from "sonner";
import { IndianRupee, WifiOff } from "lucide-react";

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

  const [customerId, setCustomerId] = useState<string>("");
  const [billId, setBillId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const cidNum = customerId ? Number(customerId) : null;
  const bills = useLiveQuery(
    () =>
      cidNum
        ? db.bills.where("customer_id").equals(cidNum).reverse().sortBy("created_at")
        : Promise.resolve([]),
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

  return (
    <div>
      <PageHeader
        title="Quick Payment"
        description="Record a payment instantly. Saves locally — works fully offline."
      />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                Stored on this device. No internet needed.
              </div>

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