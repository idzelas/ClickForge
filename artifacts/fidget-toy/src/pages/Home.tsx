import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Box, Download, Upload, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="ClickForge" className="h-8 w-8" />
          <span className="font-bold text-lg tracking-tight">ClickForge</span>
        </div>
        <div className="flex gap-2">
          <Link href="/sign-in">
            <Button variant="ghost" data-testid="link-sign-in">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button data-testid="link-sign-up">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden px-6 py-24 md:py-36 text-center">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(248 90% 65% / 0.12), transparent 70%)",
            }}
          />
          <Badge className="mb-6 inline-flex" variant="secondary">
            <Zap className="mr-1 h-3 w-3" />
            SVG to 3D in one click
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
            Turn any SVG into a{" "}
            <span className="text-primary">3D fidget clicker</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Upload an SVG, watch it extrude into a printable fidget toy with keycap
            socket and connector peg. Export as STL or 3MF — ready for your printer.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="text-base px-8" data-testid="button-cta-signup">
                Start creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-cta-signin">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20 border-t border-border bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Upload,
                  step: "1",
                  title: "Upload your SVG",
                  desc: "Drop any SVG file — logos, icons, custom shapes. We parse the paths automatically.",
                },
                {
                  icon: Box,
                  step: "2",
                  title: "Preview in 3D",
                  desc: "See your shape extruded in real time with the keycap socket and connector peg included.",
                },
                {
                  icon: Download,
                  step: "3",
                  title: "Export & print",
                  desc: "Download as STL or 3MF. Both pieces export together, ready to slice.",
                },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="flex flex-col items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      Step {step}
                    </p>
                    <h3 className="font-semibold text-base">{title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Parts diagram */}
        <section className="px-6 py-20 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-4">Two-piece clicker mechanism</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Every fidget toy exports as two interlocking pieces — an outer shell with a
              keycap socket, and an inner clicker with a connecting peg.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Outer Shell",
                  color: "bg-primary/10 border-primary/20",
                  textColor: "text-primary",
                  desc: "Your SVG shape extruded with a square negative space in the center — this holds the keycap mechanism.",
                },
                {
                  title: "Inner Clicker",
                  color: "bg-accent border-accent-border",
                  textColor: "text-accent-foreground",
                  desc: "A smaller piece with the matching square socket plus a circular peg on the bottom — the tactile clicker connector.",
                },
              ].map(({ title, color, textColor, desc }) => (
                <div key={title} className={`rounded-xl border p-6 ${color}`}>
                  <h3 className={`font-semibold text-lg mb-2 ${textColor}`}>{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        ClickForge &mdash; SVG Fidget Toy Creator
      </footer>
    </div>
  );
}
