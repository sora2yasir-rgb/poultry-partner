import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FileText,
  Receipt,
  BookOpen,
  BarChart3,
  Users,
  Smartphone,
  WifiOff,
  Share2,
  Check,
  ArrowRight,
  Menu,
  MessageCircle,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import heroImg from "@/assets/marketing-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Murgi Hisaab — Chicken Wholesaler Billing & DC Management" },
      {
        name: "description",
        content:
          "Offline-first software for chicken wholesalers. Scan DC chalans, assign cages, generate bills, share on WhatsApp, and track baki — all from your phone.",
      },
      { property: "og:title", content: "Murgi Hisaab — Chicken Wholesaler Billing & DC Management" },
      {
        property: "og:description",
        content:
          "Digitize your DC chalans, generate retailer bills in seconds, and send them on WhatsApp. Works offline.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

const WA_STORAGE_KEY = "mh:waNumber";
const WA_DEMO_MESSAGE = "Hi, I'd like a demo of Murgi Hisaab";

function sanitizeWaNumber(input: string): string {
  // Keep digits only; WhatsApp wa.me expects country code + number, no +.
  return input.replace(/\D/g, "").slice(0, 15);
}

function useWhatsAppNumber() {
  const [number, setNumber] = useState<string>("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WA_STORAGE_KEY);
      if (stored) setNumber(sanitizeWaNumber(stored));
    } catch {
      // ignore
    }
  }, []);
  const update = (val: string) => {
    const clean = sanitizeWaNumber(val);
    setNumber(clean);
    try {
      if (clean) localStorage.setItem(WA_STORAGE_KEY, clean);
      else localStorage.removeItem(WA_STORAGE_KEY);
    } catch {
      // ignore
    }
  };
  const link =
    (number ? `https://wa.me/${number}` : "https://wa.me/") +
    `?text=${encodeURIComponent(WA_DEMO_MESSAGE)}`;
  return { number, setNumber: update, link };
}

function LandingPage() {
  const wa = useWhatsAppNumber();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader waNumber={wa.number} setWaNumber={wa.setNumber} />
      <Hero waLink={wa.link} />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <BillPreview />
      <Pricing />
      <FAQ />
      <CTA />
      <MarketingFooter />
    </div>
  );
}

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function WhatsAppSettings({
  waNumber,
  setWaNumber,
}: {
  waNumber: string;
  setWaNumber: (v: string) => void;
}) {
  const [draft, setDraft] = useState(waNumber);
  useEffect(() => setDraft(waNumber), [waNumber]);
  const valid = draft.length === 0 || (draft.length >= 8 && draft.length <= 15);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="WhatsApp settings">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">WhatsApp number</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Country code + number, digits only (e.g. 919876543210).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-number" className="text-xs">Number</Label>
            <Input
              id="wa-number"
              inputMode="numeric"
              placeholder="919876543210"
              value={draft}
              maxLength={15}
              onChange={(e) => setDraft(sanitizeWaNumber(e.target.value))}
            />
            {!valid && (
              <p className="text-xs text-destructive">Enter 8–15 digits including country code.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft("");
                setWaNumber("");
              }}
            >
              Clear
            </Button>
            <Button size="sm" disabled={!valid} onClick={() => setWaNumber(draft)}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MarketingHeader({
  waNumber,
  setWaNumber,
}: {
  waNumber: string;
  setWaNumber: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground font-bold">
            M
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">Murgi Hisaab</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">Wholesaler Manager</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <WhatsAppSettings waNumber={waNumber} setWaNumber={setWaNumber} />
          <Button asChild variant="ghost"><Link to="/app">Sign in</Link></Button>
          <Button asChild><Link to="/app">Open app <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="md:hidden flex items-center gap-1">
          <WhatsAppSettings waNumber={waNumber} setWaNumber={setWaNumber} />
          <button className="p-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground">
                {l.label}
              </a>
            ))}
            <Button asChild className="mt-2"><Link to="/app">Open app</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ waLink }: { waLink: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24 grid gap-10 md:grid-cols-2 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary" /> Built for chicken wholesalers
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Bill faster.{" "}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">Track every baki.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            Murgi Hisaab digitizes your DC chalan, your daily register and your retailer bills — works offline, prints
            instantly, and shares straight to WhatsApp.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-[var(--shadow-elegant)]">
              <Link to="/app">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#128C7E]"
            >
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" /> Chat on WhatsApp
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No server needed", "Works offline", "Hindi/Urdu friendly"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div
            className="absolute -inset-6 rounded-3xl bg-[image:var(--gradient-primary)] opacity-20 blur-2xl"
            aria-hidden
          />
          <img
            src={heroImg}
            alt="Chicken wholesaler using Murgi Hisaab on a tablet inside a poultry warehouse"
            width={1536}
            height={1024}
            className="relative rounded-2xl border shadow-[var(--shadow-soft)] w-full h-auto"
          />
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  return (
    <section className="border-y bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Trusted by traders in</span>
        <span className="font-semibold text-foreground">Hyderabad</span>
        <span className="font-semibold text-foreground">Bengaluru</span>
        <span className="font-semibold text-foreground">Chennai</span>
        <span className="font-semibold text-foreground">Mumbai</span>
        <span className="font-semibold text-foreground">Lucknow</span>
      </div>
    </section>
  );
}

const features = [
  {
    icon: FileText,
    title: "Auto DC import",
    body: "Upload the company chalan PDF. AI reads order no, vehicle, farm, and the full cage table. Verify and save in seconds.",
  },
  {
    icon: Receipt,
    title: "One-tap bills",
    body: "Tick the cages going to a retailer. A bill is generated automatically with birds, weight, rate, P+B and total baki.",
  },
  {
    icon: Share2,
    title: "WhatsApp share",
    body: "Send the bill PDF directly on WhatsApp with a pre-filled message. Mobile uses native share, desktop opens WhatsApp Web.",
  },
  {
    icon: BookOpen,
    title: "Daily register",
    body: "Mirrors your physical book: # | Name | Nag | Weight | Rate | Amount | P+B | Total | Paid | Baki. Carries baki forward automatically.",
  },
  {
    icon: BarChart3,
    title: "Admin dashboard",
    body: "See today's birds out, weight, cash + online collection, and outstanding baki. Filter by date and export reports.",
  },
  {
    icon: WifiOff,
    title: "Offline first",
    body: "All data lives on your device. Works in the godown without signal. Syncs automatically when you're back online.",
  },
  {
    icon: Users,
    title: "Customer master",
    body: "Royal Chicken, Bismillah Bhai, Tabrez Bhai — add once, reuse forever, with phone numbers for instant WhatsApp.",
  },
  {
    icon: Smartphone,
    title: "Phone or laptop",
    body: "Same experience on any device. Take it to the farm on your phone, do reports on the laptop at night.",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Everything you need</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            From DC chalan to WhatsApp bill — in 60 seconds.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop juggling notebooks, calculator and PDFs. Murgi Hisaab does the math, keeps the cages straight, and
            remembers every customer's baki.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="border-border/60 hover:shadow-[var(--shadow-soft)] transition-shadow">
              <CardContent className="p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    n: "01",
    title: "Upload the DC",
    body: "Get the chalan from the farm? Snap or upload the PDF. The system reads every cage, weight and bird count.",
  },
  {
    n: "02",
    title: "Assign cages to retailers",
    body: "Open the DC, tick the cages for Royal Chicken or Bismillah Bhai, hit Send to. A bill is created instantly.",
  },
  {
    n: "03",
    title: "Edit rate & share",
    body: "Adjust the rate per kg if needed — totals recalculate live. Tap WhatsApp and the bill PDF flies to the customer.",
  },
  {
    n: "04",
    title: "Record payment, see baki",
    body: "Mark cash or online payment. Dashboard shows today's totals and every customer's outstanding baki.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28 bg-muted/40 border-y">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Your day, simplified.</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-card border p-6">
              <div className="text-3xl font-bold bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BillPreview() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 grid gap-12 md:grid-cols-2 items-center">
        <div>
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Looks just like your book</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">A bill your retailer already understands.</h2>
          <p className="mt-4 text-muted-foreground">
            We kept the layout your customers know — date, cage, birds, weight, rate, P+B and final total. Just digital,
            error-free and shareable.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Live calculation as you change the rate",
              "Previous baki carried forward automatically",
              "PDF generated locally — works offline",
              "One tap to WhatsApp with the customer's number",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card shadow-[var(--shadow-soft)] p-6 font-mono text-sm">
          <div className="flex justify-between items-baseline border-b pb-2">
            <span>DATE: 12.04.2026</span>
            <span className="text-muted-foreground">No. 69</span>
          </div>
          <div className="text-center font-bold text-lg py-3">JAVEED KG</div>
          <div className="grid grid-cols-3 text-xs uppercase text-muted-foreground border-b pb-1">
            <span>Cage</span><span className="text-center">Birds</span><span className="text-right">Weight</span>
          </div>
          {[["(28)", "15", "51.60"], ["(40)", "15", "51.50"], ["(42)", "15", "54.15"]].map((r, i) => (
            <div key={i} className="grid grid-cols-3 py-1">
              <span>{r[0]}</span><span className="text-center">{r[1]}</span><span className="text-right">{r[2]}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 border-t pt-1 font-semibold">
            <span>Total</span><span className="text-center">45</span><span className="text-right">157.25</span>
          </div>
          <div className="mt-3 space-y-1 text-right">
            <div>× 97 <span className="text-muted-foreground">/ kg</span></div>
            <div className="border-t pt-1">15,253</div>
            <div>P+ <span className="ml-2">34,316</span></div>
            <div className="border-t pt-1 font-bold text-lg text-primary">49,569</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Trial",
    price: "Free",
    sub: "for 14 days",
    features: ["Unlimited DCs", "Unlimited bills", "WhatsApp share", "Local data"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Lifetime",
    price: "₹4,999",
    sub: "one-time license",
    features: ["Everything in Trial", "Lifetime updates", "Priority support", "Multi-device sync"],
    cta: "Buy license",
    highlight: true,
  },
  {
    name: "Monthly",
    price: "₹299",
    sub: "per month",
    features: ["Everything in Trial", "Cancel anytime", "Email support", "Cloud backup"],
    cta: "Subscribe",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-muted/40 border-y">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Pricing</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">One small price. Unlimited bills.</h2>
          <p className="mt-4 text-muted-foreground">Try it free. Pay once, or pay monthly — your choice.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={
                "relative " +
                (p.highlight
                  ? "border-primary shadow-[var(--shadow-elegant)] md:-translate-y-2"
                  : "")
              }
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[image:var(--gradient-primary)] px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <CardContent className="p-7">
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.sub}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-7 w-full" variant={p.highlight ? "default" : "outline"}>
                  <Link to="/app">{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Does it really work without internet?",
    a: "Yes. Your DCs, bills, customers and payments are stored on your device. You can use the entire app offline — it syncs to the cloud whenever you're back online.",
  },
  {
    q: "Can I send bills on WhatsApp?",
    a: "Absolutely. We generate a PDF locally and open WhatsApp with the customer's number and a pre-filled message. On mobile it uses native share so the PDF attaches directly.",
  },
  {
    q: "Will the AI read every chalan correctly?",
    a: "We extract every field from the company DC PDF — order no, vehicle, farm, lot, and the full cage table. You always see a review screen to verify or fix anything before saving.",
  },
  {
    q: "How is baki tracked?",
    a: "Each customer's previous balance carries forward automatically. Every bill, cash payment and online payment updates their baki in real time.",
  },
  {
    q: "Do I need to install anything?",
    a: "No installation. It runs in your browser and on your phone like a normal website. You can also add it to your home screen as an app.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">FAQ</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Common questions</h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-3xl bg-[image:var(--gradient-primary)] p-10 md:p-16 text-primary-foreground text-center shadow-[var(--shadow-elegant)]">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ready to close the notebook?</h2>
          <p className="mt-3 max-w-xl mx-auto opacity-90">
            Start free today. Import your first DC in under a minute and send your first WhatsApp bill before the next
            cage rolls out.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/app">Open the app <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <a href="#pricing">See pricing</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[image:var(--gradient-primary)] text-primary-foreground font-bold">
              M
            </div>
            <span className="font-semibold">Murgi Hisaab</span>
          </div>
          <p className="mt-3 max-w-sm text-muted-foreground">
            Offline-first billing & DC management built for chicken wholesalers.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
            <li><a href="#how" className="hover:text-foreground">How it works</a></li>
            <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
            <li><Link to="/app" className="hover:text-foreground">Open app</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Contact</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="mailto:hello@murgihisaab.app" className="hover:text-foreground">hello@murgihisaab.app</a></li>
            <li><a href="https://wa.me/" className="hover:text-foreground">WhatsApp support</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Murgi Hisaab. All rights reserved.</span>
          <span>Made with ❤️ for poultry traders.</span>
        </div>
      </div>
    </footer>
  );
}
