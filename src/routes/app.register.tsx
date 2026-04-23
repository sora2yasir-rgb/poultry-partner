import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";

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
  const data = useLiveQuery(async () => {
    const bills = await db.bills.where("date").equals(date).toArray();
    const payments = await db.payments.where("date").equals(date).toArray();
    return { bills, payments };
  }, [date]);

  const totals = (data?.bills ?? []).reduce(
    (s, b) => ({
      birds: s.birds + b.total_birds,
      weight: s.weight + b.total_weight,
      amount: s.amount + b.amount,
      paid: s.paid + (b.paid_cash + b.paid_online),
      baki: s.baki + b.baki,
    }),
    { birds: 0, weight: 0, amount: 0, paid: 0, baki: 0 },
  );
  const cash = (data?.payments ?? []).filter((p) => p.mode === "cash").reduce((s, p) => s + p.amount, 0);
  const online = (data?.payments ?? []).filter((p) => p.mode === "online").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader
        title="Daily Register"
        description={fmtDate(date)}
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="date" className="text-sm">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        }
      />
      <div className="p-6 space-y-4">
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
                {data && data.bills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      No bills for this date.
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
                    <TableCell className="text-right">{fmtMoney(b.paid_cash + b.paid_online)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(b.baki)}</TableCell>
                  </TableRow>
                ))}
                {data && data.bills.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell></TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtInt(totals.birds)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.weight)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.amount)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.paid)}</TableCell>
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