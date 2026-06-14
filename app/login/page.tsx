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
import { InstagramButtonIcon, MuseInboxLogo } from "../../src/App";

export default function LoginPage() {
  return (
    <main className="muse-page-bg grid min-h-screen overflow-x-hidden p-4 text-foreground sm:p-6">
      <section
        className="mx-auto grid w-full max-w-6xl gap-5 self-center lg:grid-cols-[0.9fr_1.1fr]"
        aria-label="Continue with Instagram"
      >
        <Card className="muse-panel-shadow border-border/80 bg-card/92">
          <CardContent className="flex min-h-[560px] flex-col justify-center p-6 sm:p-9">
            <Link
              className="mb-12 flex min-w-0 items-center gap-3"
              href="/"
              aria-label="MuseInbox home"
            >
              <MuseInboxLogo />
              <span className="min-w-0">
                <strong className="block text-lg font-black leading-none">
                  MuseInbox
                </strong>
                <small className="mt-1 block text-xs font-bold text-muted-foreground">
                  Business or creator
                </small>
              </span>
            </Link>

            <Badge className="mb-4 w-max bg-primary/10 text-primary hover:bg-primary/10">
              Instagram signup
            </Badge>
            <h1 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Run comment automations from your Instagram account.
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-7 text-muted-foreground">
              Connect a Business or Creator account. MuseInbox will ask for the
              Instagram permissions needed to read comments and send private
              comment replies.
            </p>

            <Button
              asChild
              className="instagram-cta mt-8 h-12 w-max px-5"
              size="lg"
            >
              <a href="/api/auth/instagram/start">
                <InstagramButtonIcon />
                Connect Instagram
                <ArrowRight className="size-4" />
              </a>
            </Button>

            <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <ShieldCheck className="size-4 text-primary" />
                Official Instagram permission flow
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <LockKeyhole className="size-4 text-primary" />
                Token stored encrypted
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="muse-panel-shadow overflow-hidden border-border/80 bg-card/80">
          <CardContent className="grid min-h-[560px] place-items-center p-6 sm:p-9">
            <div className="w-full max-w-[390px] rounded-[2rem] border border-border bg-background p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black">creator.studio</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      New reel
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Live</Badge>
              </div>

              <div className="aspect-square rounded-[1.4rem] bg-[linear-gradient(145deg,#e8f3f1,#0f766e)] p-4">
                <div className="flex h-full flex-col justify-end rounded-[1rem] bg-slate-950/10 p-4 text-white">
                  <p className="max-w-[230px] text-2xl font-black leading-tight">
                    Comment “LINK” and get the guide in DM
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="ml-8 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <MessageCircle className="size-4 text-primary" />
                  <span className="text-sm font-bold">link please</span>
                </div>
                <div className="muse-alert-success rounded-2xl border p-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="muse-text-success size-5" />
                    <div>
                      <strong className="block text-sm font-black">
                        Matched: Send product link
                      </strong>
                      <span className="text-sm font-medium">
                        DM reply is ready to send.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              <p className="text-center text-xs font-semibold text-muted-foreground">
                Built for creators who need fast comment-to-DM workflows.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
