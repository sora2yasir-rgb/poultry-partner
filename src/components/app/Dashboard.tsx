import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "@/lib/db";
import { PageHeader } from "./PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInt, fmtMoney, fmt } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function Dashboard() {
  const today = todayStr();

  const data = useLiveQuery(async () => {
    const bills = await db.bills.where("date").equals(today).toArray();
    const payments = await db.payments.where("date").equals(today).toArray();
    const customers = await db.customers.toArray();
    const allBills = await db.bills.toArray();
    const allPayments = await db.payments.toArray();

    const totalBirds = bills.reduce((s, b) => s + b.total_birds, 0);
    const totalWeight = bills.reduce((s, b) => s + b.total_weight, 0);
    const totalBilled = bills.reduce((s, b) => s + b.amount, 0);
    const cashCollected = payments.filter((p) => p.mode === "cash").reduce((s, p) => s + p.amount, 0);
    const onlineCollected = payments.filter((p) => p.mode === "online").reduce((s, p) => s + p.amount, 0);

    // outstanding per customer
    const debtors = customers
      .map((c) => {
        const billed = allBills.filter((b) => b.customer_id === c.id).reduce((s, b) => s + b.amount, 0);
        const paid = allPayments.filter((p) => p.customer_id === c.id).reduce((s, p) => s + p.amount, 0);
        const baki = c.opening_balance + billed - paid;
        return { id: c.id!, name: c.name, baki };
      })
      .filter((d) => d.baki > 0)
      .sort((a, b) => b.baki - a.baki);

    const outstanding = debtors.reduce((s, d) => s + d.baki, 0);

    return {
      totalBirds,
      totalWeight,
      totalBilled,
      cashCollected,
      onlineCollected,
      outstanding,
      debtors,
      todayBillCount: bills.length,
    };
  }, [today]);

  return (
    <div>
      <PageHeader
        title="Today's Dashboard"
        description={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <>
            <Button asChild variant="outline"><Link to="/dc">Upload DC</Link></Button>
            <Button asChild><Link to="/register">Open Register</Link></Button>
          </>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Birds Out" value={fmtInt(data?.totalBirds ?? 0)} sub="today" />
          <StatCard label="Weight (kg)" value={fmt(data?.totalWeight ?? 0)} sub="today" />
          <StatCard label="Billed Today" value={fmtMoney(data?.totalBilled ?? 0)} sub={`${data?.todayBillCount ?? 0} bills`} />
          <StatCard label="Outstanding Baki" value={fmtMoney(data?.outstanding ?? 0)} sub={`${data?.debtors.length ?? 0} customers`} highlight />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Today's Collection</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Row label="Cash" value={fmtMoney(data?.cashCollected ?? 0)} />
              <Row label="Online" value={fmtMoney(data?.onlineCollected ?? 0)} />
              <div className="border-t pt-2">
                <Row label="Total" value={fmtMoney((data?.cashCollected ?? 0) + (data?.onlineCollected ?? 0))} bold />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top Debtors (Baki)</CardTitle></CardHeader>
            <CardContent>
              {data && data.debtors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding balances. 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Baki</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.debtors.slice(0, 8).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.name}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(d.baki)}</TableCell>
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

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={"mt-1 text-2xl font-semibold " + (highlight ? "text-primary" : "")}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={"flex justify-between text-sm " + (bold ? "font-semibold" : "")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}