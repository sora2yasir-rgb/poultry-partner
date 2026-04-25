import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Payment, Customer, Bill } from "./db";
import { db } from "./db";

function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface PaymentExportRow {
  payment: Payment;
  customerName: string;
  billNo?: string;
}

export async function buildPaymentRows(payments: Payment[]): Promise<PaymentExportRow[]> {
  const customerIds = Array.from(new Set(payments.map((p) => p.customer_id)));
  const billIds = Array.from(
    new Set(payments.map((p) => p.bill_id).filter((x): x is number => x != null)),
  );
  const [customers, bills] = await Promise.all([
    db.customers.bulkGet(customerIds),
    db.bills.bulkGet(billIds),
  ]);
  const cmap = new Map<number, Customer>();
  customers.forEach((c) => c?.id != null && cmap.set(c.id, c));
  const bmap = new Map<number, Bill>();
  bills.forEach((b) => b?.id != null && bmap.set(b.id, b));

  return payments.map((p) => ({
    payment: p,
    customerName: cmap.get(p.customer_id)?.name ?? `Customer #${p.customer_id}`,
    billNo: p.bill_id ? bmap.get(p.bill_id)?.bill_no : undefined,
  }));
}

export function paymentsToCsv(rows: PaymentExportRow[]): string {
  const header = [
    "Payment ID",
    "Date",
    "Customer",
    "Bill No",
    "Mode",
    "Amount",
    "Note",
    "Created At",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.payment.id,
        r.payment.date,
        r.customerName,
        r.billNo ?? "",
        r.payment.mode,
        r.payment.amount,
        r.payment.note ?? "",
        r.payment.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function paymentsToPdf(rows: PaymentExportRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595;
  const pageH = 842;
  const margin = 36;
  const lineH = 14;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (
    text: string,
    x: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; align?: "right" | "left" },
  ) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? bold : font;
    let drawX = x;
    if (opts?.align === "right") {
      const w = f.widthOfTextAtSize(text, size);
      drawX = x - w;
    }
    page.drawText(text, { x: drawX, y: yPos, size, font: f, color: rgb(0, 0, 0) });
  };

  // Column layout
  const cols = {
    date: margin,
    customer: margin + 70,
    bill: margin + 230,
    mode: margin + 290,
    amount: pageW - margin,
  };

  const drawHeader = () => {
    draw("Payments Backup", margin, y, { size: 14, bold: true });
    draw(`Generated ${new Date().toLocaleString("en-IN")}`, pageW - margin, y, {
      size: 9,
      align: "right",
    });
    y -= 20;
    draw(`Total records: ${rows.length}`, margin, y, { size: 9 });
    const total = rows.reduce((s, r) => s + r.payment.amount, 0);
    draw(`Total amount: Rs ${total.toLocaleString("en-IN")}`, pageW - margin, y, {
      size: 9,
      align: "right",
    });
    y -= 18;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    draw("Date", cols.date, y - 10, { size: 9, bold: true });
    draw("Customer", cols.customer, y - 10, { size: 9, bold: true });
    draw("Bill", cols.bill, y - 10, { size: 9, bold: true });
    draw("Mode", cols.mode, y - 10, { size: 9, bold: true });
    draw("Amount", cols.amount, y - 10, { size: 9, bold: true, align: "right" });
    y -= 20;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
  };

  drawHeader();

  for (const r of rows) {
    if (y < margin + 30) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    const dateStr = new Date(r.payment.date).toLocaleDateString("en-GB");
    const cust =
      r.customerName.length > 26 ? r.customerName.slice(0, 25) + "…" : r.customerName;
    draw(dateStr, cols.date, y, { size: 9 });
    draw(cust, cols.customer, y, { size: 9 });
    draw(r.billNo ? `#${r.billNo}` : "—", cols.bill, y, { size: 9 });
    draw(r.payment.mode, cols.mode, y, { size: 9 });
    draw(`Rs ${r.payment.amount.toLocaleString("en-IN")}`, cols.amount, y, {
      size: 9,
      align: "right",
    });
    y -= lineH;
  }

  return await doc.save();
}