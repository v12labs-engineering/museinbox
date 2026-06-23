import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const sections = [
  {
    title: "Use of MuseInbox",
    body: "MuseInbox is provided to help Instagram Business and Creator accounts manage comment-to-direct-message workflows. You are responsible for the automations, links, and messages you create.",
  },
  {
    title: "Instagram Account Access",
    body: "You may connect only Instagram accounts that you own or are authorized to manage. You can disconnect the account from MuseInbox settings at any time.",
  },
  {
    title: "Messaging and Compliance",
    body: "You are responsible for making sure your automated replies follow Instagram rules, Meta Platform Terms, and any laws that apply to your messages.",
  },
  {
    title: "Free Forever and Fair Use",
    body: "MuseInbox is free forever, with fair-use limits that protect Instagram accounts and service reliability. The app may limit active automations, daily comment checks, daily DM send attempts, or pause automations after repeated Instagram send failures.",
  },
  {
    title: "Service Availability",
    body: "MuseInbox depends on Meta APIs and webhook delivery. Access may change if Meta changes permissions, review status, API behavior, or account eligibility.",
  },
  {
    title: "Limitation of Liability",
    body: "MuseInbox is provided as-is. We are not responsible for lost messages, failed automations, rejected API calls, account restrictions, or third-party platform changes.",
  },
];

export default function TermsPage() {
  return (
    <main className="muse-page-bg min-h-screen overflow-x-hidden p-4 text-foreground sm:p-8">
      <Card className="mx-auto max-w-3xl border-border/80 bg-card/92">
        <CardContent className="p-6 sm:p-10">
          <Link
            className="mb-10 flex min-w-0 items-center gap-3"
            href="/"
            aria-label="MuseInbox home"
          >
            <MuseInboxLogo />
            <span>
              <strong className="block text-lg font-black leading-none">
                MuseInbox
              </strong>
              <small className="mt-1 block text-xs font-bold text-muted-foreground">
                Terms of service
              </small>
            </span>
          </Link>

          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            Effective 13 June 2026
          </Badge>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            These terms describe the basic rules for using MuseInbox to manage
            Instagram comment automations.
          </p>

          <Separator className="my-8" />

          <div className="grid gap-7">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-black tracking-tight">
                  {section.title}
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">
                  {section.body}
                </p>
              </section>
            ))}

            <section>
              <h2 className="text-xl font-black tracking-tight">Contact</h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                For questions about these terms, contact{" "}
                <a
                  className="font-bold text-primary underline-offset-4 hover:underline"
                  href="mailto:pranushathokala895@gmail.com"
                >
                  pranushathokala895@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
