import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Bill, BillCage } from "./db";
import { getStoredWaNumber } from "./waNumber";

export async function generateBillPdf(bill: Bill, cages: BillCage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  let y = height - 40;
  const left = 30;
  const right = width - 30;

  const draw = (text: string, x: number, yPos: number, opts?: { size?: number; bold?: boolean; align?: "right" | "left" | "center" }) => {
    const size = opts?.size ?? 11;
    const f = opts?.bold ? bold : font;
    let drawX = x;
    if (opts?.align === "right") {
      const w = f.widthOfTextAtSize(text, size);
      drawX = x - w;
    } else if (opts?.align === "center") {
      const w = f.widthOfTextAtSize(text, size);
      drawX = x - w / 2;
    }
    page.drawText(text, { x: drawX, y: yPos, size, font: f, color: rgb(0, 0, 0) });
  };
  const line = (yPos: number) => {
    page.drawLine({ start: { x: left, y: yPos }, end: { x: right, y: yPos }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2) });
  };

  draw(`DATE: ${formatDate(bill.date)}`, left, y, { size: 10 });
  draw(`No. ${bill.bill_no}`, right, y, { size: 10, align: "right" });
  y -= 20;
  draw(bill.customer_name.toUpperCase(), width / 2, y, { size: 16, bold: true, align: "center" });
  y -= 14;
  line(y);
  y -= 16;

  draw("Cage", left, y, { bold: true, size: 10 });
  draw("Birds", left + 90, y, { bold: true, size: 10 });
  draw("Weight", right - 10, y, { bold: true, size: 10, align: "right" });
  y -= 6;
  line(y);
  y -= 14;

  for (const c of cages) {
    draw(`(${c.cage_no})`, left, y, { size: 11 });
    draw(String(c.birds), left + 90, y, { size: 11 });
    draw(c.weight.toFixed(2), right - 10, y, { size: 11, align: "right" });
    y -= 14;
  }
  y -= 4;
  line(y);
  y -= 16;

  draw("Total", left, y, { bold: true });
  draw(String(bill.total_birds), left + 90, y, { bold: true });
  draw(bill.total_weight.toFixed(2), right - 10, y, { bold: true, align: "right" });
  y -= 18;

  draw(`× ${bill.rate}`, right - 10, y, { align: "right", size: 11 });
  y -= 6;
  line(y);
  y -= 16;
  draw(String(bill.amount), right - 10, y, { align: "right", bold: true, size: 13 });
  y -= 18;
  draw(`Prev: ${bill.prev_baki}`, right - 10, y, { align: "right", size: 11 });
  y -= 6;
  line(y);
  y -= 16;
  draw(String(bill.grand_total), right - 10, y, { align: "right", bold: true, size: 14 });
  y -= 22;

  if (bill.paid_cash || bill.paid_online) {
    draw(`Paid Cash: ${bill.paid_cash}`, left, y, { size: 10 });
    draw(`Paid Online: ${bill.paid_online}`, left + 130, y, { size: 10 });
    y -= 14;
  }
  draw(`Balance: ${bill.baki}`, right - 10, y, { align: "right", bold: true, size: 13 });

  return await doc.save();
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareOnWhatsApp({
  bill,
  cages,
  phone,
}: {
  bill: Bill;
  cages: BillCage[];
  phone?: string;
}) {
  const bytes = await generateBillPdf(bill, cages);
  const filename = `Bill-${bill.bill_no}-${bill.customer_name.replace(/\s+/g, "_")}.pdf`;

  const message = `${bill.customer_name}\nBill #${bill.bill_no} — ${formatDate(bill.date)}\nBirds: ${bill.total_birds}, Weight: ${bill.total_weight.toFixed(2)} kg\nRate: ₹${bill.rate}\nAmount: ₹${bill.amount}\nPrevious Balance: ₹${bill.prev_baki}\n*Total Balance: ₹${bill.baki}*`;

  // Try Web Share API (mobile) with file
  const file = new File([bytes as BlobPart], filename, { type: "application/pdf" });
  // Type-safe feature detection
  const navAny = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (navAny.canShare && navAny.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message, title: `Bill #${bill.bill_no}` });
      return;
    } catch {
      // user cancelled — fall through to download path
    }
  }
  // Desktop fallback: download PDF, open WhatsApp Web
  downloadPdf(bytes, filename);
  // Prefer the customer's phone; fall back to the configured WhatsApp number from settings.
  const num = (phone || getStoredWaNumber() || "").replace(/\D/g, "");
  const url = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(message)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}