import Link from "next/link";
import { Smartphone, Thermometer, Tag, QrCode, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { MonoLabel } from "@/components/ui/MonoLabel";

const FEATURES = [
  {
    icon: Smartphone,
    title: "Taste Match",
    body: "Swipe on ingredients, get dishes ranked across cafés by live availability.",
  },
  {
    icon: Thermometer,
    title: "Thermal Debt",
    body: "Tracks cumulative time–temperature exposure, not one snapshot reading.",
  },
  {
    icon: Tag,
    title: "Second Serve",
    body: "Manager-approved, safety-gated offers sent only to matched, opted-in customers.",
  },
];

const PILLS = ["SWIPE", "MATCH", "MONITOR", "RECOVER", "LEARN"];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Brand panel */}
        <Card tone="espresso" className="flex flex-col justify-between gap-10 p-8 lg:col-span-3 md:p-12">
          <div className="flex flex-col gap-8">
            <Logo size={40} />
            <div className="flex flex-col gap-5">
              <MonoLabel className="text-matcha/80">THE AI LAYER FOR CAFÉS</MonoLabel>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-oat md:text-5xl">
                Taste, matched.
                <br />
                Freshness, measured.
                <br />
                <span className="text-matcha">Nothing wasted.</span>
              </h1>
              <p className="max-w-md text-[0.95rem] leading-relaxed text-oat/70">
                Built on top of the QR menu, loyalty and CRM that four cafés already run on —
                now with taste matching, storage intelligence and safety-gated surplus offers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {PILLS.map((pill, i) => (
              <Chip key={pill} variant={i === PILLS.length - 1 ? "filled" : "outline"} tone="matcha" className={i < PILLS.length - 1 ? "border-oat/20 text-oat/70" : ""}>
                {pill}
              </Chip>
            ))}
          </div>
        </Card>

        {/* Feature cards */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} tone="oat" className="flex flex-col gap-2.5 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha/25 text-forest">
                <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
              </div>
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <p className="text-sm leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <Card tone="paper" className="flex flex-col gap-6 p-8 md:p-10">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">Try it now</h2>
          <p className="text-sm text-muted">Three ways to see the loop — pick one.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/demo">
            <Button variant="primary" size="lg" className="w-full justify-between">
              Open demo <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/app">
            <Button variant="outline" size="lg" className="w-full justify-between">
              Customer app <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/console">
            <Button variant="outline" size="lg" className="w-full justify-between">
              Manager console <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-oat px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-matcha">
            <QrCode size={20} aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-espresso">Open on your phone</span>
            <span className="text-sm text-muted">Scan the QR on screen, or visit this page&apos;s /app route directly.</span>
          </div>
        </div>
      </Card>
    </main>
  );
}
