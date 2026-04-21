

# Chicken Wholesaler Management Software

A complete offline-first system to digitize the daily workflow: import the company DC (delivery chalan), assign cages to retailers, auto-generate bills, send bills on WhatsApp, and view a daily admin dashboard.

## What you will get

### 1. DC Import (the company chalan)
- Upload the DC PDF (like `DO_Chalan_2071394012_1.pdf`).
- An OCR/AI extractor reads it automatically and pulls every field as-is:
  - Order No, Trader Name, Order Date, Lifting Date/Time, Vehicle No, Driver Name & No, Farm, Lot Number, Supervisor.
  - The full cage table: **Cage No | Quantity (birds) | Weight (kg)**.
- A review screen lets you verify/edit any value before saving.
- Saved DCs become your **Digital DC Register** — searchable by date, order no, vehicle, lot.

### 2. Digital Daily Register (the retailer book)
- One register per day, exactly mirroring your physical book columns:
  `# | Name | Nag | Weight | Rate | Amount | P+B | Total | Paid | Baki`
- Customers list is reusable (Royal Chicken, Bismillah Bhai, Tabrez Bhai, etc.) — add once, pick anytime.
- Previous Baki (P+B) auto-carries forward from the customer's last day.
- Cash / Online / Total summary row at the bottom.

### 3. Cage Assignment → Auto Bill
- Open a saved DC, tick the cages going to a retailer (e.g. cage 3 & 4).
- Click **Send to** → choose retailer → bill is created automatically.
- Selected cages become **unavailable** for any other retailer (no double-assignment).

### 4. Bill Screen (matches your handwritten bill)
Mirrors `Javeed Kg` style bill exactly:
```text
DATE: 12.04.2026                         No. 69
JAVEED KG
─────────────────────────────────────────
 Cage  Birds   Weight
 (28)   15  -  51.60
 (40)   15  -  51.50
 (42)   15  -  54.15
─────────────────────────────────────────
 Total  45    157.25
              x 97          ← rate (editable)
        ─────────
              15253         ← amount
        P+   34316          ← previous baki
        ─────────
              49569         ← grand total / new baki
```
- Rate field is editable; amount, total and Baki recalculate live.
- Buttons: **Save**, **Print PDF**, **Send on WhatsApp** (opens WhatsApp with the PDF + a pre-filled message to the customer's number).
- Record Payment (Cash / Online) — updates Baki immediately.

### 5. Admin Dashboard (daily report)
- Today at a glance: total birds out, total weight, total billed, total collected (Cash + Online), total outstanding Baki.
- Per-customer summary: Name | Nag | Weight | Amount | Paid | Baki.
- Top debtors list (kisko kitna baki).
- Filter by date / date range; export day report as PDF or share to admin's WhatsApp.

### 6. Offline-first with sync
- All data stored locally in the browser (works without internet).
- When internet is available, it syncs to Lovable Cloud so the admin can view the dashboard from anywhere and WhatsApp sending works.
- WhatsApp uses `wa.me` deep link (no API cost; opens WhatsApp Web/App with bill ready to send).

## Technical details

- **Stack**: TanStack Start (React 19) + Tailwind + shadcn/ui (already in project).
- **Local storage**: IndexedDB via Dexie (full offline DB — DCs, bills, customers, payments).
- **Sync layer**: Lovable Cloud (Supabase) — background sync when online; conflict resolution by `updated_at`.
- **DC PDF extraction**: HuggingFace Inference API for layout-aware extraction (or a lightweight pdf.js + table-parse fallback). User reviews before save.
- **Bill PDF**: generated client-side with `pdf-lib` so it works offline.
- **WhatsApp**: `https://wa.me/<number>?text=<encoded message>` + attached PDF via Web Share API on mobile; on desktop the PDF downloads and WhatsApp Web opens with the message.
- **Routes** (file-based under `src/routes/`):
  - `/` Dashboard (today's summary)
  - `/dc` DC list + upload
  - `/dc/$orderNo` DC detail (cage table + assign)
  - `/register` Daily register
  - `/customers` Customer master
  - `/bills` Bill list
  - `/bills/$billId` Bill detail / edit / share
  - `/reports` Admin reports
- **Data model** (local + cloud):
  - `customers` (id, name, phone, opening_balance)
  - `dcs` (order_no, date, vehicle, driver, farm, lot, supervisor, raw_json)
  - `dc_cages` (dc_id, cage_no, birds, weight_kg, assigned_bill_id)
  - `bills` (id, bill_no, date, customer_id, rate, total_birds, total_weight, amount, prev_baki, grand_total, paid_cash, paid_online, baki, status)
  - `bill_cages` (bill_id, dc_id, cage_no, birds, weight)
  - `payments` (id, customer_id, date, amount, mode)
- **Validation**: zod schemas on every form (rate > 0, weight > 0, etc.).
- **Licensing**: deferred — built later as a key-activation gate around the app shell.

## Build order
1. Local DB (Dexie) + customer master.
2. DC upload + AI extract + review/save + DC list.
3. Cage selection → bill creation flow.
4. Bill screen with live calc + PDF + WhatsApp share.
5. Daily register view.
6. Admin dashboard + reports.
7. Cloud sync layer.

