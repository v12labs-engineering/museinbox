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
    <main className="grid min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(253,186,116,0.38),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(225,48,108,0.22),transparent_28%),linear-gradient(180deg,#fff7f4_0%,#fff_48%,#fafafa_100%)] p-4 text-foreground sm:p-6">
      <section
        className="mx-auto grid w-full max-w-6xl gap-5 self-center lg:grid-cols-[0.9fr_1.1fr]"
        aria-label="Continue with Instagram"
      >
        <Card className="border-border/80 bg-card/92 shadow-[0_24px_70px_rgba(225,48,108,0.12)]">
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
              Meta signup
            </Badge>
            <h1 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Run comment automations from your Instagram account.
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-7 text-muted-foreground">
              Connect the Facebook Page that owns your Business or Creator
              Instagram account. MuseInbox needs that Page connection to send
              private DM replies when someone comments.
            </p>

            <Button
              asChild
              className="mt-8 h-12 w-max bg-[linear-gradient(135deg,#f77737,#e1306c_55%,#833ab4)] px-5 !text-white shadow-[0_16px_40px_rgba(225,48,108,0.24)] hover:opacity-95"
              size="lg"
            >
              <a href="/api/auth/facebook/start">
                <MessageCircle className="size-4" />
                Connect Facebook Page
                <ArrowRight className="size-4" />
              </a>
            </Button>

            <Button
              asChild
              className="mt-3 h-11 w-max"
              size="lg"
              variant="outline"
            >
              <a href="/api/auth/instagram/start">
                <InstagramButtonIcon />
                Continue with Instagram
                <ArrowRight className="size-4" />
              </a>
            </Button>

            <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <ShieldCheck className="size-4 text-primary" />
                Official Meta permission flow
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <LockKeyhole className="size-4 text-primary" />
                Token stored encrypted
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-card/80 shadow-[0_24px_70px_rgba(131,58,180,0.12)]">
          <CardContent className="grid min-h-[560px] place-items-center p-6 sm:p-9">
            <div className="w-full max-w-[390px] rounded-[2rem] border border-border bg-background p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,#f77737,#e1306c_55%,#833ab4)] text-white">
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

              <div className="aspect-square rounded-[1.4rem] bg-[linear-gradient(145deg,#ffdc80,#f77737_34%,#e1306c_68%,#833ab4)] p-4">
                <div className="flex h-full flex-col justify-end rounded-[1rem] bg-black/10 p-4 text-white">
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
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <div>
                      <strong className="block text-sm font-black text-emerald-950">
                        Matched: Send product link
                      </strong>
                      <span className="text-sm font-medium text-emerald-800">
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
