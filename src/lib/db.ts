import Dexie, { type Table } from "dexie";

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  opening_balance: number;
  created_at: string;
  updated_at: string;
}

export interface DC {
  id?: number;
  order_no: string;
  trader_name?: string;
  order_date?: string;
  lifting_date?: string;
  vehicle_no?: string;
  driver_name?: string;
  driver_no?: string;
  farm?: string;
  lot_number?: string;
  supervisor?: string;
  raw_json?: string;
  created_at: string;
  updated_at: string;
}

export interface DCCage {
  id?: number;
  dc_id: number;
  cage_no: string;
  birds: number;
  weight_kg: number;
  assigned_bill_id?: number | null;
}

export interface Bill {
  id?: number;
  bill_no: string;
  date: string; // yyyy-MM-dd
  customer_id: number;
  customer_name: string;
  rate: number;
  total_birds: number;
  total_weight: number;
  amount: number;
  prev_baki: number;
  grand_total: number;
  paid_cash: number;
  paid_online: number;
  baki: number;
  status: "draft" | "saved" | "paid";
  created_at: string;
  updated_at: string;
}

export interface BillCage {
  id?: number;
  bill_id: number;
  dc_id: number;
  dc_cage_id: number;
  cage_no: string;
  birds: number;
  weight: number;
}

export interface Payment {
  id?: number;
  customer_id: number;
  bill_id?: number | null;
  date: string;
  amount: number;
  mode: "cash" | "online";
  note?: string;
  created_at: string;
}

class WholesalerDB extends Dexie {
  customers!: Table<Customer, number>;
  dcs!: Table<DC, number>;
  dc_cages!: Table<DCCage, number>;
  bills!: Table<Bill, number>;
  bill_cages!: Table<BillCage, number>;
  payments!: Table<Payment, number>;

  constructor() {
    super("wholesaler_db");
    this.version(1).stores({
      customers: "++id, name, phone, updated_at",
      dcs: "++id, order_no, lifting_date, vehicle_no, updated_at",
      dc_cages: "++id, dc_id, cage_no, assigned_bill_id, [dc_id+cage_no]",
      bills: "++id, bill_no, date, customer_id, status, updated_at",
      bill_cages: "++id, bill_id, dc_id, dc_cage_id",
      payments: "++id, customer_id, bill_id, date, mode",
    });
  }
}

export const db = new WholesalerDB();

export function nowISO() {
  return new Date().toISOString();
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Get current outstanding baki for a customer (opening + bills - payments) */
export async function getCustomerBaki(customerId: number): Promise<number> {
  const customer = await db.customers.get(customerId);
  if (!customer) return 0;
  const bills = await db.bills.where("customer_id").equals(customerId).toArray();
  const payments = await db.payments.where("customer_id").equals(customerId).toArray();
  // Sum of bill amounts (without prev_baki to avoid double counting)
  const billed = bills.reduce((s, b) => s + b.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return customer.opening_balance + billed - paid;
}

/** Get baki excluding a specific bill (used when generating that bill so prev_baki is correct) */
export async function getCustomerBakiExcluding(customerId: number, excludeBillId?: number): Promise<number> {
  const customer = await db.customers.get(customerId);
  if (!customer) return 0;
  const bills = await db.bills.where("customer_id").equals(customerId).toArray();
  const payments = await db.payments.where("customer_id").equals(customerId).toArray();
  const billed = bills
    .filter((b) => b.id !== excludeBillId)
    .reduce((s, b) => s + b.amount, 0);
  const paid = payments
    .filter((p) => p.bill_id !== excludeBillId)
    .reduce((s, p) => s + p.amount, 0);
  return customer.opening_balance + billed - paid;
}

export async function nextBillNo(): Promise<string> {
  const all = await db.bills.toArray();
  const max = all.reduce((m, b) => {
    const n = parseInt(b.bill_no, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return String(max + 1);
}