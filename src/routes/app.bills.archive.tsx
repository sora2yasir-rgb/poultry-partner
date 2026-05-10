import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useMemo } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, fmtInt, fmtMoney, fmtDate } from "@/lib/format";
import { ChevronLeft, FolderOpen, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/bills/archive")({
  head: () => ({
    meta: [
      { title: "Bill Archive — PoultryBooks" },
      { name: "description", content: "Browse all bills by year, month and day stored locally on this device." },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const bills = useLiveQuery(() => db.bills.orderBy("date").reverse().toArray(), []);
  const [year, setYear] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const tree = useMemo(() => {
    const t: Record<string, Record<string, Record<string, typeof bills>>> = {};
    (bills ?? []).forEach((b) => {
      const [y, m, d] = b.date.split("-");
      if (!y || !m || !d) return;
      t[y] ??= {};
      t[y][m] ??= {};
      t[y][m][d] ??= [] as any;
      (t[y][m][d] as any).push(b);
    });
    return t;
  }, [bills]);

  const monthName = (m: string) =>
    new Date(2000, parseInt(m, 10) - 1, 1).toLocaleString("en-US", { month: "long" });

  const years = Object.keys(tree).sort((a, b) => b.localeCompare(a));
  const months = year ? Object.keys(tree[year] ?? {}).sort((a, b) => b.localeCompare(a)) : [];
  const days = year && month ? Object.keys(tree[year]?.[month] ?? {}).sort((a, b) => b.localeCompare(a)) : [];
  const dayBills = year && month && day ? (tree[year]?.[month]?.[day] ?? []) : [];

  function sumOf(list: any[]) {
    return list.reduce(
      (acc, b) => ({
        birds: acc.birds + (b.total_birds || 0),
        weight: acc.weight + (b.total_weight || 0),
        amount: acc.amount + (b.amount || 0),
        count: acc.count + 1,
      }),
      { birds: 0, weight: 0, amount: 0, count: 0 },
    );
  }

  const crumbs: { label: string; onClick: () => void }[] = [
    { label: "All Years", onClick: () => { setYear(null); setMonth(null); setDay(null); } },
  ];
  if (year) crumbs.push({ label: year, onClick: () => { setMonth(null); setDay(null); } });
  if (year && month) crumbs.push({ label: monthName(month), onClick: () => { setDay(null); } });
  if (year && month && day) crumbs.push({ label: day, onClick: () => {} });

  return (
    <div>
      <PageHeader
        title="Bill Archive"
        description="Browse bills stored locally on this device — Year → Month → Day"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/bills"><ChevronLeft className="h-4 w-4" /> Back to Bills</Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                onClick={c.onClick}
                className={i === crumbs.length - 1 ? "font-medium" : "text-primary hover:underline"}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>

        {!year && (
          <Card>
            <CardContent className="p-4">
              {years.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <FolderOpen className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No bills yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {years.map((y) => {
                    const all = Object.values(tree[y]).flatMap((m) => Object.values(m).flat());
                    const s = sumOf(all);
                    return (
                      <button
                        key={y}
                        onClick={() => setYear(y)}
                        className="rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                      >
                        <div className="text-2xl font-semibold">{y}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {s.count} bills · {fmtMoney(s.amount)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {year && !month && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {months.map((m) => {
                  const all = Object.values(tree[year][m]).flat();
                  const s = sumOf(all);
                  return (
                    <button
                      key={m}
                      onClick={() => setMonth(m)}
                      className="rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                    >
                      <div className="text-lg font-semibold">{monthName(m)} {year}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.count} bills · {fmtMoney(s.amount)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {year && month && !day && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {days.map((d) => {
                  const list = tree[year][month][d] ?? [];
                  const s = sumOf(list);
                  return (
                    <button
                      key={d}
                      onClick={() => setDay(d)}
                      className="rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        {d}/{month}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {s.count} bills
                      </div>
                      <div className="text-xs font-medium">{fmtMoney(s.amount)}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {year && month && day && (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayBills.map((b: any) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}