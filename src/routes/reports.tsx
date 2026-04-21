import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, fmtInt, fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Murgi Hisaab" },
      { name: "description", content: "Date-range reports for sales, payments and customer baki." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());

  const data = useLiveQuery(async () => {
    const bills = await db.bills
      .where("date")
      .between(from, to, true, true)
      .toArray();
    const payments = await db.payments
      .where("date")
      .between(from, to, true, true)
      .toArray();
    const customers = await db.customers.toArray();

    const byCust = new Map<number, { name: string; birds: number; weight: number; amount: number; paid: number }>();
    for (const c of customers) byCust.set(c.id!, { name: c.name, birds: 0, weight: 0, amount: 0, paid: 0 });
    for (const b of bills) {
      const r = byCust.get(b.customer_id);
      if (r) {
        r.birds += b.total_birds;
        r.weight += b.total_weight;
        r.amount += b.amount;
      }
    }
    for (const p of payments) {
      const r = byCust.get(p.customer_id);
      if (r) r.paid += p.amount;
    }
    const rows = Array.from(byCust.values()).filter((r) => r.amount > 0 || r.paid > 0);
    return { bills, payments, rows };
  }, [from, to]);

  const totals = (data?.rows ?? []).reduce(
    (s, r) => ({
      birds: s.birds + r.birds,
      weight: s.weight + r.weight,
      amount: s.amount + r.amount,
      paid: s.paid + r.paid,
    }),
    { birds: 0, weight: 0, amount: 0, paid: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-sm">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Label className="text-sm">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Birds</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No activity in this date range.
                    </TableCell>
                  </TableRow>
                )}
                {data?.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.birds)}</TableCell>
                    <TableCell className="text-right">{fmt(r.weight)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.amount)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.paid)}</TableCell>
                  </TableRow>
                ))}
                {data && data.rows.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtInt(totals.birds)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.weight)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.amount)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(totals.paid)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}