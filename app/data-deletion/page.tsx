import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const steps = [
  {
    title: "Disconnect Instagram",
    body: "Open MuseInbox settings and choose Disconnect Instagram. This removes the stored Instagram connection token from MuseInbox.",
  },
  {
    title: "Delete your data in Settings",
    body: "When you are signed in, open MuseInbox settings and choose Delete all my data. This removes stored rules, activity, processed comment history, and integration data for that Instagram account.",
  },
  {
    title: "Request deletion by email",
    body: "If you cannot access the app, email us with the Instagram account ID or email address used with MuseInbox, and we will delete stored rules, activity, and integration data associated with that account.",
  },
  {
    title: "Confirmation",
    body: "After deletion is complete, we will send a confirmation email. Some server logs may remain temporarily for security and reliability purposes.",
  },
];

export default function DataDeletionPage() {
  return (
    <main className="muse-page-bg min-h-screen overflow-x-hidden p-4 text-foreground sm:p-8">
      <Card className="muse-panel-shadow mx-auto max-w-3xl border-border/80 bg-card/92">
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
                Data deletion
              </small>
            </span>
          </Link>

          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            Effective 13 June 2026
          </Badge>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Data Deletion Instructions
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            You can request deletion of MuseInbox data connected to your
            Instagram account at any time.
          </p>

          <Separator className="my-8" />

          <div className="grid gap-7">
            {steps.map((step) => (
              <section key={step.title}>
                <h2 className="text-xl font-black tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">
                  {step.body}
                </p>
              </section>
            ))}

            <section>
              <h2 className="text-xl font-black tracking-tight">
                Deletion Contact
              </h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                Send deletion requests to{" "}
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
