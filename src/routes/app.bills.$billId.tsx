import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO, getCustomerBakiExcluding } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Share2, IndianRupee } from "lucide-react";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";
import { generateBillPdf, downloadPdf, shareOnWhatsApp } from "@/lib/billPdf";
import { toast } from "sonner";

export const Route = createFileRoute("/app/bills/$billId")({
  component: BillDetailPage,
});

function BillDetailPage() {
  const { billId } = Route.useParams();
  const id = Number(billId);
  const bill = useLiveQuery(() => db.bills.get(id), [id]);
  const cages = useLiveQuery(() => db.bill_cages.where("bill_id").equals(id).toArray(), [id]);
  const customer = useLiveQuery(
    async () => (bill ? await db.customers.get(bill.customer_id) : undefined),
    [bill?.customer_id, bill],
  );
  const payments = useLiveQuery(() => db.payments.where("bill_id").equals(id).toArray(), [id]);

  const [editingRate, setEditingRate] = useState(false);
  const [rateVal, setRateVal] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  if (!bill) return <div className="p-6">Loading…</div>;
  // Capture non-null bill for closures below
  const currentBill = bill;

  async function recalc(updates: Partial<typeof currentBill>) {
    const merged = { ...currentBill, ...updates };
    const amount = Math.round(merged.total_weight * merged.rate);
    const prevBaki = await getCustomerBakiExcluding(merged.customer_id, merged.id);
    const grand = amount + prevBaki;
    const paid = (merged.paid_cash || 0) + (merged.paid_online || 0);
    await db.bills.update(merged.id!, {
      ...updates,
      amount,
      prev_baki: prevBaki,
      grand_total: grand,
      baki: grand - paid,
      updated_at: nowISO(),
    });
  }

  async function saveRate() {
    const r = Number(rateVal);
    if (!r || r <= 0) {
      toast.error("Enter valid rate");
      return;
    }
    await recalc({ rate: r });
    setEditingRate(false);
    toast.success("Rate updated");
  }

  async function handlePdf() {
    const bytes = await generateBillPdf(currentBill, cages ?? []);
    downloadPdf(bytes, `Bill-${currentBill.bill_no}-${currentBill.customer_name.replace(/\s+/g, "_")}.pdf`);
  }

  async function handleShare() {
    try {
      await shareOnWhatsApp({ bill: currentBill, cages: cages ?? [], phone: customer?.phone });
    } catch (e) {
      console.error(e);
      toast.error("Share failed");
    }
  }

  return (
    <div>
      <PageHeader
        title={`Bill #${bill.bill_no}`}
        description={`${bill.customer_name} · ${fmtDate(bill.date)}`}
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/bills"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <Button variant="outline" onClick={handlePdf}><Download className="h-4 w-4" /> PDF</Button>
            <Button onClick={handleShare}><Share2 className="h-4 w-4" /> WhatsApp</Button>
          </>
        }
      />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm text-muted-foreground">DATE: {fmtDate(bill.date)}</div>
                <div className="text-sm text-muted-foreground">No. {bill.bill_no}</div>
              </div>
              <h2 className="text-2xl font-bold text-center uppercase tracking-wide my-2">{bill.customer_name}</h2>
              <div className="border-t border-foreground/30 my-3" />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cage</TableHead>
                    <TableHead className="text-right">Birds</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cages?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>({c.cage_no})</TableCell>
                      <TableCell className="text-right">{fmtInt(c.birds)}</TableCell>
                      <TableCell className="text-right">{fmt(c.weight)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2 border-foreground/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtInt(bill.total_birds)}</TableCell>
                    <TableCell className="text-right">{fmt(bill.total_weight)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1 text-right">
                <div className="flex justify-end items-center gap-2">
                  <span className="text-sm text-muted-foreground">× Rate</span>
                  {editingRate ? (
                    <>
                      <Input
                        className="h-8 w-24"
                        type="number"
                        step="0.01"
                        value={rateVal}
                        onChange={(e) => setRateVal(e.target.value)}
                      />
                      <Button size="sm" onClick={saveRate}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingRate(false)}>X</Button>
                    </>
                  ) : (
                    <button
                      className="text-base font-semibold hover:underline"
                      onClick={() => { setRateVal(String(bill.rate)); setEditingRate(true); }}
                    >
                      {fmt(bill.rate)}
                    </button>
                  )}
                </div>
                <div className="border-t border-foreground/30 mt-1 pt-1">
                  <div className="text-lg font-semibold">{fmtMoney(bill.amount)}</div>
                </div>
                <div className="text-sm">P+ {fmtInt(bill.prev_baki)}</div>
                <div className="border-t border-foreground/30 mt-1 pt-1">
                  <div className="text-xl font-bold">{fmtMoney(bill.grand_total)}</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Paid: ₹{fmtInt((bill.paid_cash || 0) + (bill.paid_online || 0))}
                </div>
                <div className="text-lg font-bold text-primary">Baki: {fmtMoney(bill.baki)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Payments</h3>
                <Button size="sm" onClick={() => setPayOpen(true)}>
                  <IndianRupee className="h-3.5 w-3.5" /> Record
                </Button>
              </div>
              {payments && payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments?.map((p) => (
                    <li key={p.id} className="flex justify-between border-b pb-1">
                      <span>
                        {fmtDate(p.date)} · <span className="capitalize">{p.mode}</span>
                      </span>
                      <span className="font-medium">{fmtMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 text-sm space-y-1">
              <h3 className="font-semibold mb-2">Customer</h3>
              <div>{customer?.name}</div>
              <div className="text-muted-foreground">{customer?.phone || "No phone saved"}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        billId={id}
        customerId={bill.customer_id}
        defaultDate={bill.date}
        onSaved={async (amt, mode) => {
          const newCash = currentBill.paid_cash + (mode === "cash" ? amt : 0);
          const newOnline = currentBill.paid_online + (mode === "online" ? amt : 0);
          await recalc({ paid_cash: newCash, paid_online: newOnline });
          toast.success("Payment recorded");
        }}
      />
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  billId,
  customerId,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  billId: number;
  customerId: number;
  defaultDate: string;
  onSaved: (amt: number, mode: "cash" | "online") => void;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [date, setDate] = useState(defaultDate);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) { setAmount(""); setMode("cash"); setDate(defaultDate); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "cash" | "online")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            const a = Number(amount);
            if (!a || a <= 0) { toast.error("Enter valid amount"); return; }
            await db.payments.add({
              customer_id: customerId,
              bill_id: billId,
              date,
              amount: a,
              mode,
              created_at: nowISO(),
            });
            onOpenChange(false);
            onSaved(a, mode);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}