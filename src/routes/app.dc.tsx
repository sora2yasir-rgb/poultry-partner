import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, nowISO } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, FileText, Plus, Trash2 } from "lucide-react";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/dc")({
  head: () => ({
    meta: [
      { title: "DC Register — Murgi Hisaab" },
      { name: "description", content: "Upload company DC PDFs and manage your digital chalan register." },
    ],
  }),
  component: DCListPage,
});

type ExtractedCage = { cage_no: string; birds: number; weight_kg: number };
type Extracted = {
  order_no?: string;
  trader_name?: string;
  order_date?: string;
  lifting_date?: string;
  vehicle_no?: string;
  driver_name?: string;
  driver_no?: string;
  farm?: string;
  lot_number?: string;
  supervisor?: string;
  cages: ExtractedCage[];
};

function DCListPage() {
  const dcs = useLiveQuery(() => db.dcs.orderBy("updated_at").reverse().toArray(), []);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<Extracted | null>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];

      const { data, error } = await supabase.functions.invoke("extract-dc", {
        body: { fileBase64: base64, fileName: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ex = data as Extracted;
      setReview({
        ...ex,
        cages: Array.isArray(ex.cages) ? ex.cages : [],
      });
      toast.success("DC extracted. Please review and save.");
    } catch (e) {
      console.error(e);
      toast.error("Could not extract DC: " + (e instanceof Error ? e.message : "unknown error"));
      // open empty review for manual entry
      setReview({ cages: [{ cage_no: "", birds: 0, weight_kg: 0 }] });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="DC Register"
        description="Digital chalan register — upload company DC and manage cages"
        actions={
          <>
            <input
              id="dc-upload"
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              onClick={() => document.getElementById("dc-upload")?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Extracting…" : "Upload DC PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setReview({ cages: [{ cage_no: "", birds: 0, weight_kg: 0 }] })}
            >
              <Plus className="h-4 w-4" /> Manual Entry
            </Button>
          </>
        }
      />
      <div className="p-6 space-y-6">
        {review && (
          <DCReview
            initial={review}
            onCancel={() => setReview(null)}
            onSaved={(id) => {
              setReview(null);
              navigate({ to: "/app/dc/$dcId", params: { dcId: String(id) } });
            }}
          />
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Lifting Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead className="text-right">Cages</TableHead>
                  <TableHead className="text-right">Birds</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dcs && dcs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      No DCs yet. Upload your first chalan PDF above.
                    </TableCell>
                  </TableRow>
                )}
                {dcs?.map((d) => (
                  <DCRow key={d.id} dcId={d.id!} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DCRow({ dcId }: { dcId: number }) {
  const dc = useLiveQuery(() => db.dcs.get(dcId), [dcId]);
  const cages = useLiveQuery(() => db.dc_cages.where("dc_id").equals(dcId).toArray(), [dcId]);
  if (!dc) return null;
  const totalBirds = cages?.reduce((s, c) => s + c.birds, 0) ?? 0;
  const totalWeight = cages?.reduce((s, c) => s + c.weight_kg, 0) ?? 0;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link to="/app/dc/$dcId" params={{ dcId: String(dc.id) }} className="hover:underline">
          {dc.order_no || `DC#${dc.id}`}
        </Link>
      </TableCell>
      <TableCell>{dc.lifting_date ? fmtDate(dc.lifting_date) : "—"}</TableCell>
      <TableCell>{dc.vehicle_no || "—"}</TableCell>
      <TableCell className="max-w-[200px] truncate">{dc.farm || "—"}</TableCell>
      <TableCell className="text-right">{cages?.length ?? 0}</TableCell>
      <TableCell className="text-right">{fmtInt(totalBirds)}</TableCell>
      <TableCell className="text-right">{fmt(totalWeight)}</TableCell>
      <TableCell className="text-right">
        <Button asChild size="sm" variant="ghost">
          <Link to="/app/dc/$dcId" params={{ dcId: String(dc.id) }}>Open</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DCReview({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Extracted;
  onCancel: () => void;
  onSaved: (id: number) => void;
}) {
  const [form, setForm] = useState<Extracted>(initial);
  const set = (k: keyof Extracted, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setCage = (i: number, k: keyof ExtractedCage, v: string | number) =>
    setForm((f) => ({
      ...f,
      cages: f.cages.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)),
    }));
  const addCage = () => setForm((f) => ({ ...f, cages: [...f.cages, { cage_no: "", birds: 0, weight_kg: 0 }] }));
  const delCage = (i: number) => setForm((f) => ({ ...f, cages: f.cages.filter((_, idx) => idx !== i) }));

  const totalBirds = form.cages.reduce((s, c) => s + (Number(c.birds) || 0), 0);
  const totalWeight = form.cages.reduce((s, c) => s + (Number(c.weight_kg) || 0), 0);

  async function save() {
    if (!form.order_no?.trim()) {
      toast.error("Order No is required");
      return;
    }
    const cages = form.cages.filter((c) => c.cage_no.trim() !== "" || c.birds > 0 || c.weight_kg > 0);
    if (cages.length === 0) {
      toast.error("Add at least one cage");
      return;
    }
    const id = await db.dcs.add({
      order_no: form.order_no!.trim(),
      trader_name: form.trader_name,
      order_date: form.order_date,
      lifting_date: form.lifting_date,
      vehicle_no: form.vehicle_no,
      driver_name: form.driver_name,
      driver_no: form.driver_no,
      farm: form.farm,
      lot_number: form.lot_number,
      supervisor: form.supervisor,
      raw_json: JSON.stringify(form),
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    await db.dc_cages.bulkAdd(
      cages.map((c) => ({
        dc_id: id,
        cage_no: String(c.cage_no).trim(),
        birds: Number(c.birds) || 0,
        weight_kg: Number(c.weight_kg) || 0,
        assigned_bill_id: null,
      })),
    );
    toast.success("DC saved");
    onSaved(id);
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Review &amp; Save DC</h2>
          <span className="text-xs text-muted-foreground">Verify all fields before saving</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Order No *" v={form.order_no ?? ""} onChange={(v) => set("order_no", v)} />
          <Field label="Trader Name" v={form.trader_name ?? ""} onChange={(v) => set("trader_name", v)} />
          <Field label="Order Date" v={form.order_date ?? ""} onChange={(v) => set("order_date", v)} />
          <Field label="Lifting Date" v={form.lifting_date ?? ""} onChange={(v) => set("lifting_date", v)} />
          <Field label="Vehicle No" v={form.vehicle_no ?? ""} onChange={(v) => set("vehicle_no", v)} />
          <Field label="Driver Name" v={form.driver_name ?? ""} onChange={(v) => set("driver_name", v)} />
          <Field label="Driver No" v={form.driver_no ?? ""} onChange={(v) => set("driver_no", v)} />
          <Field label="Farm" v={form.farm ?? ""} onChange={(v) => set("farm", v)} />
          <Field label="Lot Number" v={form.lot_number ?? ""} onChange={(v) => set("lot_number", v)} />
          <Field label="Supervisor" v={form.supervisor ?? ""} onChange={(v) => set("supervisor", v)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Cages</h3>
            <Button size="sm" variant="outline" onClick={addCage}><Plus className="h-3.5 w-3.5" /> Add cage</Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cage No</TableHead>
                  <TableHead>Birds</TableHead>
                  <TableHead>Weight (kg)</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.cages.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell><Input value={c.cage_no} onChange={(e) => setCage(i, "cage_no", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" value={c.birds} onChange={(e) => setCage(i, "birds", Number(e.target.value))} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={c.weight_kg} onChange={(e) => setCage(i, "weight_kg", Number(e.target.value))} /></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => delCage(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell></TableCell>
                  <TableCell className="font-medium">Total ({form.cages.length} cages)</TableCell>
                  <TableCell className="font-medium">{fmtInt(totalBirds)}</TableCell>
                  <TableCell className="font-medium">{fmt(totalWeight)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save}>Save DC</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, v, onChange }: { label: string; v: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}