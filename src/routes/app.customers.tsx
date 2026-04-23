import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO, type Customer } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/customers")({
  head: () => ({
    meta: [
      { title: "Customers — PoultryBooks" },
      { name: "description", content: "Manage your retailer customers, phone numbers and opening balances." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useLiveQuery(() => db.customers.orderBy("name").toArray(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Retailers / parties you sell to"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers && customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No customers yet. Add your first retailer to get started.
                  </TableCell>
                </TableRow>
              )}
              {customers?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell className="text-right">{fmtMoney(c.opening_balance)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Delete ${c.name}? This will not delete bills.`)) return;
                        await db.customers.delete(c.id!);
                        toast.success("Customer deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <CustomerDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
    </div>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Customer | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [opening, setOpening] = useState(String(editing?.opening_balance ?? 0));

  // reset when editing changes
  useState(() => {
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setOpening(String(editing?.opening_balance ?? 0));
  });

  // reset on open
  if (open && editing && name !== editing.name && !document.activeElement?.matches("input")) {
    // no-op guard
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) {
        setName(editing?.name ?? "");
        setPhone(editing?.phone ?? "");
        setOpening(String(editing?.opening_balance ?? 0));
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Chicken Mart" />
          </div>
          <div>
            <Label>WhatsApp Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 919876543210" />
            <p className="text-xs text-muted-foreground mt-1">Include country code (no + or spaces)</p>
          </div>
          <div>
            <Label>Opening Balance</Label>
            <Input
              type="number"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!name.trim()) {
                toast.error("Name is required");
                return;
              }
              const data = {
                name: name.trim(),
                phone: phone.trim() || undefined,
                opening_balance: Number(opening) || 0,
                updated_at: nowISO(),
              };
              if (editing?.id) {
                await db.customers.update(editing.id, data);
                toast.success("Customer updated");
              } else {
                await db.customers.add({ ...data, created_at: nowISO() });
                toast.success("Customer added");
              }
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}