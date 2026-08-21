import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const steps = [
  {
    title: "Option 1: Delete Data in MuseInbox",
    body: "While your Instagram professional account is connected, open Settings, find Delete MuseInbox data, choose Delete all my data, and confirm Delete my data. When the request succeeds, MuseInbox clears that Instagram account's active data record and signs the browser out.",
  },
  {
    title: "What the In-App Action Deletes",
    body: "The action removes saved automation rules, keywords, selected-media details, message and reply templates, links, recent activity and delivery results, stored comment or message text and external identifiers in that activity, processed comment IDs, fair-use counters, Instagram account identifiers and connection metadata, granted-permission records, and the encrypted access token from the active MuseInbox account record.",
  },
  {
    title: "Disconnecting Is Not Full Deletion",
    body: "Choosing Disconnect Instagram removes the saved access token and connection metadata and signs the browser out, but it does not delete saved automation rules or activity. Use Delete all my data if you want the full MuseInbox account record removed.",
  },
  {
    title: "Option 2: Request Deletion by Email",
    body: "If you cannot use the in-app control, email pranushathokala895@gmail.com with the subject “MuseInbox Instagram Data Deletion Request.” Include the Instagram username for the connected Business or Creator account, its numerical Instagram account ID if you know it, and a link to the Instagram profile. MuseInbox uses Instagram authorization rather than an email-and-password login, so the email address you send from does not need to match an account email.",
  },
  {
    title: "Verification and Timeline",
    body: "To prevent unauthorized deletion, we may ask for reasonable proof that you control the named Instagram account. Do not send your Instagram password or access token. We will complete a verified email request within 30 days and send confirmation to the email address used for the request. The in-app deletion takes effect on the active MuseInbox account record when the app confirms success.",
  },
  {
    title: "Data Outside MuseInbox",
    body: "Deleting MuseInbox data does not delete the original posts, reels, comments, profile information, or messages held by Instagram, and it cannot recall direct messages or public replies already delivered to recipients. Manage that information through Instagram. Limited copies may remain temporarily in routine provider backups or security logs until those systems rotate them, or longer only when required for security, dispute resolution, or law.",
  },
];

export default function DataDeletionPage() {
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
                Data deletion
              </small>
            </span>
          </Link>

          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            Effective 11 July 2026
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
                . Include only the account-identifying details described above;
                never send a password or access token.
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
