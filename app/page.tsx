import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InstagramButtonIcon, MuseInboxLogo } from "../src/App";

const steps = [
  {
    title: "Connect Instagram",
    text: "Use Instagram's official permission flow for a Business or Creator account.",
  },
  {
    title: "Create a rule",
    text: "Pick a post or reel, choose a keyword, and write the direct message.",
  },
  {
    title: "Send safely",
    text: "Preview visible comments first, then send matched DMs within fair-use limits.",
  },
];

const trustItems = [
  "Free forever",
  "Instagram-only login",
  "Encrypted token storage",
  "Visible fair-use limits",
];

export default function HomePage() {
  return (
    <main className="muse-page-bg min-h-screen overflow-x-hidden text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link
          className="flex min-w-0 items-center gap-3"
          href="/"
          aria-label="MuseInbox home"
        >
          <MuseInboxLogo />
          <span className="min-w-0">
            <strong className="block text-lg font-black leading-none">
              MuseInbox
            </strong>
            <small className="mt-1 block text-xs font-bold text-muted-foreground">
              Free Instagram automations
            </small>
          </span>
        </Link>
        <Button asChild variant="outline">
          <a href="/api/auth/instagram/start">
            <InstagramButtonIcon />
            <span className="hidden sm:inline">Connect Instagram</span>
            <span className="sm:hidden">Connect</span>
          </a>
        </Button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-6xl content-center gap-8 px-4 pb-8 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="max-w-3xl">
          <Badge className="mb-5 bg-primary/10 text-primary hover:bg-primary/10">
            Free forever
          </Badge>
          <h1 className="text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Turn Instagram comments into DMs.
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-muted-foreground sm:text-lg">
            MuseInbox helps Instagram Business and Creator accounts send
            direct-message replies when comments match your rules. No email
            signup, no pricing page, no subscription.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="instagram-cta h-12 px-5"
              size="lg"
            >
              <a href="/api/auth/instagram/start">
                <InstagramButtonIcon />
                Connect Instagram
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild className="h-12 px-5" size="lg" variant="outline">
              <Link href="/privacy">Read privacy policy</Link>
            </Button>
          </div>
          <p className="mt-4 max-w-xl text-sm font-semibold text-muted-foreground">
            Uses Instagram's official permission flow and APIs. Fair-use limits
            help protect accounts from accidental spam.
          </p>
        </div>

        <Card className="border-border/80 bg-card/92">
          <CardContent className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Comment workflow
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Simple enough to run in minutes.
                </h2>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-6" />
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              {steps.map((step, index) => (
                <div
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-background p-4"
                  key={step.title}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <strong className="block font-black">{step.title}</strong>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {step.text}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="grid gap-2 sm:grid-cols-2">
              {trustItems.map((item) => (
                <div
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm font-bold"
                  key={item}
                >
                  {item === "Encrypted token storage" ? (
                    <LockKeyhole className="size-4 shrink-0 text-primary" />
                  ) : item === "Instagram-only login" ? (
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                  ) : item === "Free forever" ? (
                    <Sparkles className="size-4 shrink-0 text-primary" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/70 bg-background/80 px-4 py-5 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>MuseInbox is free forever with fair-use limits.</span>
          <nav className="flex flex-wrap gap-4">
            <Link className="hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-foreground" href="/data-deletion">
              Data deletion
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
