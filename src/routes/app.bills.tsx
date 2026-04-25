import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";
import { Receipt, Share2 } from "lucide-react";
import { shareOnWhatsApp } from "@/lib/billPdf";
import { toast } from "sonner";
import type { Bill } from "@/lib/db";

export const Route = createFileRoute("/app/bills")({
  head: () => ({
    meta: [
      { title: "Bills — PoultryBooks" },
      { name: "description", content: "All generated bills with totals, payments and outstanding balance." },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const bills = useLiveQuery(() => db.bills.orderBy("updated_at").reverse().toArray(), []);

  async function handleShare(b: Bill) {
    try {
      const cages = await db.bill_cages.where("bill_id").equals(b.id!).toArray();
      const customer = await db.customers.get(b.customer_id);
      await shareOnWhatsApp({ bill: b, cages, phone: customer?.phone });
    } catch (e) {
      console.error(e);
      toast.error("Could not share bill");
    }
  }

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
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills && bills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      <Receipt className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      No bills yet. Create one from a DC.
                    </TableCell>
                  </TableRow>
                )}
                {bills?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link to="/app/bills/$billId" params={{ billId: String(b.id) }} className="font-medium hover:underline">
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShare(b)}
                        title="Share PDF on WhatsApp"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </TableCell>
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