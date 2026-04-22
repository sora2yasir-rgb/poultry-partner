import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO, nextBillNo, getCustomerBakiExcluding, todayStr, type Customer } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/app/dc/$dcId")({
  component: DCDetailPage,
});

function DCDetailPage() {
  const { dcId } = Route.useParams();
  const id = Number(dcId);
  const dc = useLiveQuery(() => db.dcs.get(id), [id]);
  const cages = useLiveQuery(
    () => db.dc_cages.where("dc_id").equals(id).sortBy("id"),
    [id],
  );
  const customers = useLiveQuery(() => db.customers.orderBy("name").toArray(), []);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const navigate = useNavigate();

  const totals = useMemo(() => {
    if (!cages) return { birds: 0, weight: 0 };
    return {
      birds: cages.reduce((s, c) => s + c.birds, 0),
      weight: cages.reduce((s, c) => s + c.weight_kg, 0),
    };
  }, [cages]);

  const selectedCages = useMemo(
    () => (cages ?? []).filter((c) => selected.has(c.id!)),
    [cages, selected],
  );
  const selTotals = useMemo(
    () => ({
      birds: selectedCages.reduce((s, c) => s + c.birds, 0),
      weight: selectedCages.reduce((s, c) => s + c.weight_kg, 0),
    }),
    [selectedCages],
  );

  if (!dc) return <div className="p-6">Loading…</div>;

  const toggle = (cid: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });
  };

  return (
    <div>
      <PageHeader
        title={`DC ${dc.order_no}`}
        description={`${dc.farm ?? ""} · ${dc.vehicle_no ?? ""}${dc.lifting_date ? " · " + fmtDate(dc.lifting_date) : ""}`}
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/dc"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <Button
              disabled={selected.size === 0}
              onClick={() => setSendOpen(true)}
            >
              <Send className="h-4 w-4" /> Send to Retailer ({selected.size})
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="Trader" v={dc.trader_name} />
          <Info label="Driver" v={dc.driver_name} />
          <Info label="Driver No" v={dc.driver_no} />
          <Info label="Lot" v={dc.lot_number} />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Cage No</TableHead>
                  <TableHead className="text-right">Birds</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cages?.map((c) => {
                  const assigned = !!c.assigned_bill_id;
                  return (
                    <TableRow key={c.id} className={assigned ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          disabled={assigned}
                          checked={selected.has(c.id!)}
                          onCheckedChange={() => toggle(c.id!)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.cage_no}</TableCell>
                      <TableCell className="text-right">{fmtInt(c.birds)}</TableCell>
                      <TableCell className="text-right">{fmt(c.weight_kg)}</TableCell>
                      <TableCell>
                        {assigned ? (
                          <Link to="/app/bills/$billId" params={{ billId: String(c.assigned_bill_id) }} className="text-xs text-primary hover:underline">
                            Bill #{c.assigned_bill_id}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Available</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell></TableCell>
                  <TableCell>Total ({cages?.length ?? 0} cages)</TableCell>
                  <TableCell className="text-right">{fmtInt(totals.birds)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.weight)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {selected.size > 0 && (
                  <TableRow className="bg-primary/5 font-medium">
                    <TableCell></TableCell>
                    <TableCell>Selected ({selected.size})</TableCell>
                    <TableCell className="text-right">{fmtInt(selTotals.birds)}</TableCell>
                    <TableCell className="text-right">{fmt(selTotals.weight)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        customers={customers ?? []}
        selectedCageIds={Array.from(selected)}
        dcId={id}
        onCreated={(billId) => {
          setSelected(new Set());
          setSendOpen(false);
          navigate({ to: "/app/bills/$billId", params: { billId: String(billId) } });
        }}
      />
    </div>
  );
}

function Info({ label, v }: { label: string; v?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{v || "—"}</div>
    </div>
  );
}

function SendDialog({
  open,
  onOpenChange,
  customers,
  selectedCageIds,
  dcId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: Customer[];
  selectedCageIds: number[];
  dcId: number;
  onCreated: (billId: number) => void;
}) {
  const [customerId, setCustomerId] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr());

  async function create() {
    const cid = Number(customerId);
    if (!cid) {
      toast.error("Select a customer");
      return;
    }
    const rateN = Number(rate);
    if (!rateN || rateN <= 0) {
      toast.error("Enter a valid rate");
      return;
    }
    const cages = await db.dc_cages.bulkGet(selectedCageIds);
    const valid = cages.filter((c): c is NonNullable<typeof c> => !!c && !c.assigned_bill_id);
    if (valid.length === 0) {
      toast.error("Selected cages already assigned");
      return;
    }
    const customer = customers.find((c) => c.id === cid)!;
    const totalBirds = valid.reduce((s, c) => s + c.birds, 0);
    const totalWeight = valid.reduce((s, c) => s + c.weight_kg, 0);
    const amount = Math.round(totalWeight * rateN);
    const prevBaki = await getCustomerBakiExcluding(cid);
    const billNo = await nextBillNo();

    const billId = await db.bills.add({
      bill_no: billNo,
      date,
      customer_id: cid,
      customer_name: customer.name,
      rate: rateN,
      total_birds: totalBirds,
      total_weight: Number(totalWeight.toFixed(2)),
      amount,
      prev_baki: prevBaki,
      grand_total: amount + prevBaki,
      paid_cash: 0,
      paid_online: 0,
      baki: amount + prevBaki,
      status: "saved",
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    await db.bill_cages.bulkAdd(
      valid.map((c) => ({
        bill_id: billId,
        dc_id: dcId,
        dc_cage_id: c.id!,
        cage_no: c.cage_no,
        birds: c.birds,
        weight: c.weight_kg,
      })),
    );
    await Promise.all(
      valid.map((c) => db.dc_cages.update(c.id!, { assigned_bill_id: billId })),
    );
    toast.success(`Bill #${billNo} created`);
    onCreated(billId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Cages to Retailer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
                {customers.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">No customers yet. Add one first.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rate (₹/kg) *</Label>
              <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 97" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedCageIds.length} cage(s) selected. Bill will be auto-generated and you can edit the rate later.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create}>Create Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}