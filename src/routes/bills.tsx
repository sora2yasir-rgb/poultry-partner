import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/bills")({
  head: () => ({
    meta: [
      { title: "Bills — Murgi Hisaab" },
      { name: "description", content: "All generated bills with totals, payments and outstanding baki." },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const bills = useLiveQuery(() => db.bills.orderBy("updated_at").reverse().toArray(), []);
  return (
    <div>
      <PageHeader title="Bills" description="All generated bills" />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Birds</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Baki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills && bills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      <Receipt className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      No bills yet. Create one from a DC.
                    </TableCell>
                  </TableRow>
                )}
                {bills?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link to="/bills/$billId" params={{ billId: String(b.id) }} className="font-medium hover:underline">
                        #{b.bill_no}
                      </Link>
                    </TableCell>
                    <TableCell>{fmtDate(b.date)}</TableCell>
                    <TableCell>{b.customer_name}</TableCell>
                    <TableCell className="text-right">{fmtInt(b.total_birds)}</TableCell>
                    <TableCell className="text-right">{fmt(b.total_weight)}</TableCell>
                    <TableCell className="text-right">{fmt(b.rate)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(b.amount)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(b.baki)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}