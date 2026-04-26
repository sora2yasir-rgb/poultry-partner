import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "./db";
import { fmt, fmtInt, fmtMoney, fmtDate } from "./format";

export interface RegisterRow {
  idx: number;
  name: string;
  birds: number | null;
  weight: number | null;
  rate: number | null;
  amount: number | null;
  prev: number | null;
  total: number | null;
  paid: number;
  balance: number | null;
}

export interface RegisterReport {
  date: string;
  rows: RegisterRow[];
  totals: { birds: number; weight: number; amount: number; paid: number; baki: number };
  cash: number;
  online: number;
}

export async function buildRegisterReport(date: string): Promise<RegisterReport> {
  const bills = await db.bills.where("date").equals(date).toArray();
  const payments = await db.payments.where("date").equals(date).toArray();
  const customers = await db.customers.toArray();
  bills.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const paidByBill = new Map<number, number>();
  for (const p of payments) {
    if (p.bill_id == null) continue;
    paidByBill.set(p.bill_id, (paidByBill.get(p.bill_id) ?? 0) + p.amount);
  }

  const rows: RegisterRow[] = [];
  bills.forEach((b, i) => {
    const paid = paidByBill.get(b.id!) ?? 0;
    rows.push({
      idx: i + 1,
      name: b.customer_name,
      birds: b.total_birds,
      weight: b.total_weight,
      rate: b.rate,
      amount: b.amount,
      prev: b.prev_baki,
      total: b.grand_total,
      paid,
      balance: Math.max(0, b.grand_total - paid),
    });
  });

  const billedCustomerIds = new Set(bills.map((b) => b.customer_id));
  const paymentOnly = new Map<number, { cash: number; online: number; firstAt: string }>();
  for (const p of payments) {
    if (billedCustomerIds.has(p.customer_id)) continue;
    const cur = paymentOnly.get(p.customer_id) ?? { cash: 0, online: 0, firstAt: p.created_at };
    if (p.mode === "cash") cur.cash += p.amount;
    else cur.online += p.amount;
    if (p.created_at < cur.firstAt) cur.firstAt = p.created_at;
    paymentOnly.set(p.customer_id, cur);
  }
  Array.from(paymentOnly.entries())
    .sort((a, b) => a[1].firstAt.localeCompare(b[1].firstAt))
    .forEach(([customerId, v], i) => {
      const c = customers.find((x) => x.id === customerId);
      rows.push({
        idx: bills.length + i + 1,
        name: `${c?.name ?? "Unknown"} (payment only)`,
        birds: null,
        weight: null,
        rate: null,
        amount: null,
        prev: null,
        total: null,
        paid: v.cash + v.online,
        balance: null,
      });
    });

  const totals = rows.reduce(
    (s, r) => ({
      birds: s.birds + (r.birds ?? 0),
      weight: s.weight + (r.weight ?? 0),
      amount: s.amount + (r.amount ?? 0),
      paid: s.paid + r.paid,
      baki: s.baki + (r.balance ?? 0),
    }),
    { birds: 0, weight: 0, amount: 0, paid: 0, baki: 0 },
  );
  const cash = payments.filter((p) => p.mode === "cash").reduce((s, p) => s + p.amount, 0);
  const online = payments.filter((p) => p.mode === "online").reduce((s, p) => s + p.amount, 0);

  return { date, rows, totals, cash, online };
}

export async function registerToPdf(report: RegisterReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Landscape A4
  const pageW = 842;
  const pageH = 595;
  const margin = 32;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (
    text: string,
    x: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; align?: "right" | "left" | "center" },
  ) => {
    const size = opts?.size ?? 9;
    const f = opts?.bold ? bold : font;
    let drawX = x;
    if (opts?.align === "right") drawX = x - f.widthOfTextAtSize(text, size);
    else if (opts?.align === "center") drawX = x - f.widthOfTextAtSize(text, size) / 2;
    page.drawText(text, { x: drawX, y: yPos, size, font: f, color: rgb(0, 0, 0) });
  };

  // Columns: # | Name | Birds | Weight | Rate | Amount | Prev | Total | Paid | Balance
  const cols = {
    idx: margin + 8,
    name: margin + 36,
    birds: margin + 250,
    weight: margin + 320,
    rate: margin + 385,
    amount: margin + 460,
    prev: margin + 535,
    total: margin + 605,
    paid: margin + 680,
    balance: pageW - margin - 4,
  };

  const drawHeader = () => {
    draw("Daily Register", margin, y, { size: 16, bold: true });
    draw(fmtDate(report.date), pageW - margin, y, { size: 11, align: "right" });
    y -= 16;
    draw(`Generated ${new Date().toLocaleString("en-IN")}`, margin, y, { size: 8 });
    y -= 14;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    draw("#", cols.idx, y - 10, { bold: true });
    draw("Name", cols.name, y - 10, { bold: true });
    draw("Birds", cols.birds, y - 10, { bold: true, align: "right" });
    draw("Weight", cols.weight, y - 10, { bold: true, align: "right" });
    draw("Rate", cols.rate, y - 10, { bold: true, align: "right" });
    draw("Amount", cols.amount, y - 10, { bold: true, align: "right" });
    draw("Prev Bal", cols.prev, y - 10, { bold: true, align: "right" });
    draw("Total", cols.total, y - 10, { bold: true, align: "right" });
    draw("Paid", cols.paid, y - 10, { bold: true, align: "right" });
    draw("Balance", cols.balance, y - 10, { bold: true, align: "right" });
    y -= 18;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
  };

  drawHeader();

  const lineH = 14;
  const dash = "—";

  if (report.rows.length === 0) {
    draw("No bills or payments for this date.", pageW / 2, y - 30, {
      size: 11,
      align: "center",
    });
  }

  for (const r of report.rows) {
    if (y < margin + 60) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    const name = r.name.length > 32 ? r.name.slice(0, 31) + "…" : r.name;
    draw(String(r.idx), cols.idx, y);
    draw(name, cols.name, y);
    draw(r.birds != null ? fmtInt(r.birds) : dash, cols.birds, y, { align: "right" });
    draw(r.weight != null ? fmt(r.weight) : dash, cols.weight, y, { align: "right" });
    draw(r.rate != null ? fmt(r.rate) : dash, cols.rate, y, { align: "right" });
    draw(r.amount != null ? fmtMoney(r.amount) : dash, cols.amount, y, { align: "right" });
    draw(r.prev != null ? fmtMoney(r.prev) : dash, cols.prev, y, { align: "right" });
    draw(r.total != null ? fmtMoney(r.total) : dash, cols.total, y, { align: "right" });
    draw(fmtMoney(r.paid), cols.paid, y, { align: "right" });
    draw(r.balance != null ? fmtMoney(r.balance) : dash, cols.balance, y, { align: "right" });
    y -= lineH;
  }

  // Totals row
  if (report.rows.length > 0) {
    if (y < margin + 60) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    y -= 4;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    draw("Total", cols.name, y - 6, { bold: true });
    draw(fmtInt(report.totals.birds), cols.birds, y - 6, { bold: true, align: "right" });
    draw(fmt(report.totals.weight), cols.weight, y - 6, { bold: true, align: "right" });
    draw(fmtMoney(report.totals.amount), cols.amount, y - 6, { bold: true, align: "right" });
    draw(fmtMoney(report.totals.paid), cols.paid, y - 6, { bold: true, align: "right" });
    draw(fmtMoney(report.totals.baki), cols.balance, y - 6, { bold: true, align: "right" });
    y -= 26;
  }

  // Summary
  y -= 6;
  draw(`Cash collected: ${fmtMoney(report.cash)}`, margin, y, { size: 10, bold: true });
  draw(`Online collected: ${fmtMoney(report.online)}`, margin + 220, y, { size: 10, bold: true });
  draw(`Total collected: ${fmtMoney(report.cash + report.online)}`, pageW - margin, y, {
    size: 10,
    bold: true,
    align: "right",
  });

  return await doc.save();
}
