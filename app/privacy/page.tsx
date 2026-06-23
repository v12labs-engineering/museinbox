import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const sections = [
  {
    title: "Information We Collect",
    body: "When you connect Instagram, we store your Instagram account identifier, access token, selected post or reel details, automation rules, message templates, links, and local activity logs.",
  },
  {
    title: "How We Use Information",
    body: "We use this information only to display your Instagram content, match comments to your rules, and send the message you configured.",
  },
  {
    title: "Storage and Security",
    body: "Access tokens are encrypted before storage. We do not sell Instagram data, use it for advertising, or use it to train AI models.",
  },
  {
    title: "Disconnecting",
    body: "You can disconnect Instagram from the MuseInbox settings page. This removes the stored connection token from the app.",
  },
  {
    title: "Deleting Your Data",
    body: "You can delete MuseInbox data from Settings when signed in, or use the public data deletion instructions if you cannot access the app.",
  },
];

export default function PrivacyPage() {
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
                Privacy policy
              </small>
            </span>
          </Link>

          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            Effective 12 June 2026
          </Badge>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            MuseInbox helps Instagram Business and Creator accounts create
            comment automations that send manually configured direct-message
            replies.
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
                For privacy questions, contact us at{" "}
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
