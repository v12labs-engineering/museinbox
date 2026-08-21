import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const sections = [
  {
    title: "Scope",
    body: "This policy explains how MuseInbox collects, uses, stores, and discloses information when an Instagram Business or Creator account connects to and uses the service. It does not govern Meta or Instagram, whose handling of information is covered by their own terms and privacy policies.",
  },
  {
    title: "Instagram Account and Authorization Data",
    body: "Through Instagram's OAuth flow, we receive professional-account identifiers, username, granted permissions, connection and token-expiry times, webhook account identifiers, and an access token. The access token lets MuseInbox perform only the actions the account owner approved. MuseInbox does not receive or store your Instagram password.",
  },
  {
    title: "Instagram Profile, Media, and Comment Data",
    body: "MuseInbox retrieves professional-profile information and media information made available by the Instagram API, including media IDs, captions, media type, owner ID, media or thumbnail URL, permalink, timestamp, and comment or like counts. To evaluate automations, we may receive comment IDs, commenter identifiers and usernames when Meta provides them, comment text, timestamps, media identifiers, and comment webhook event data. Selected media identifiers and details may be saved with an automation; other media and comment data may be displayed without being retained as a separate media library.",
  },
  {
    title: "Automation and Activity Data",
    body: "We store the rules you create, such as automation names, keywords, selected media, private-reply and public-reply templates, links, activation state, and timestamps. Recent activity may contain the triggering comment, the matching rule, the configured reply, delivery status, error or warning details, and diagnostic identifiers. We also keep a limited history of processed comment IDs to avoid sending the same automation twice, plus daily fair-use counters.",
  },
  {
    title: "Technical Data and Cookies",
    body: "MuseInbox uses strictly necessary, signed session and OAuth cookies to connect the correct Instagram account, keep the browser session active, and protect the authorization flow. Our hosting provider may process request information such as IP address, browser or device details, timestamps, requested routes, and security or error logs. We use this technical information to operate, secure, troubleshoot, and prevent abuse of the service, not for advertising.",
  },
  {
    title: "How We Use Information",
    body: "We use information to connect and identify the correct professional account; show its posts and reels; evaluate comments against user-created rules; send the private reply or public comment reply configured by the account owner; prevent duplicate sends; display recent activity and delivery outcomes; enforce fair-use limits; maintain security; troubleshoot failures; respond to support or privacy requests; and comply with applicable law. Where required, we rely on performance of the service requested by you, your consent to connect Instagram, our legitimate interests in security and reliability, and legal obligations.",
  },
  {
    title: "Service Providers and Disclosures",
    body: "MuseInbox runs on Vercel, which hosts the website and API and processes operational request logs. Account state is stored in Supabase. Meta and Instagram provide OAuth, Graph API and webhook data and deliver the replies you direct MuseInbox to send. These providers process information under their own contractual terms and privacy practices. We may also disclose information when required by law, to protect users or the service, or as part of a business reorganization with appropriate safeguards.",
  },
  {
    title: "No Sale, Advertising, or AI Training",
    body: "We do not sell or rent personal information or Instagram data. We do not share it for cross-context behavioral advertising, use it to build advertising profiles, or use comment, profile, or media data to train artificial-intelligence models.",
  },
  {
    title: "Retention",
    body: "Connection data and automation rules are retained while needed to provide MuseInbox or until you disconnect or delete them. The access token is retained until it expires, is replaced, you disconnect Instagram, or you delete your data. The in-app activity list retains up to 50 recent entries, and duplicate-prevention history retains up to 1,000 processed comment IDs; older entries are replaced as new ones arrive. A session cookie may remain for up to 60 days unless it is cleared earlier by disconnecting or deleting data. Verified email deletion requests are completed within 30 days. Limited information may remain temporarily in provider backups or security logs until routine rotation, or longer only when required for security, fraud prevention, dispute resolution, or law.",
  },
  {
    title: "Security",
    body: "Instagram access tokens are encrypted before they are stored in Supabase. MuseInbox also uses HTTPS in production, signed HTTP-only session cookies, OAuth state validation, and Meta webhook-signature verification. Access to production credentials is restricted to server-side systems. No transmission or storage system is completely secure, so we cannot guarantee absolute security.",
  },
  {
    title: "Your Choices and Rights",
    body: "You can disconnect Instagram at any time from Settings; this removes the stored connection and access token but does not delete saved automations or activity. Use Delete all my data in Settings for full deletion of MuseInbox records associated with the connected Instagram account. Depending on where you live, you may also request access, correction, deletion, restriction, portability, or objection, or withdraw consent and complain to a privacy regulator. We may need to verify that you control the Instagram account before fulfilling a request.",
  },
  {
    title: "International Processing and Children",
    body: "Vercel, Supabase, and Meta may process information in countries other than your own, subject to their applicable safeguards. MuseInbox is intended for people authorized to manage an Instagram professional account and is not directed to children under 13 or any higher minimum age required in their location.",
  },
  {
    title: "Changes to This Policy",
    body: "We may update this policy when the service, providers, or legal requirements change. We will publish the revised policy here and update the effective date. Material changes will be communicated in the service when reasonably possible.",
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
            Effective 11 July 2026
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
              <h2 className="text-xl font-black tracking-tight">
                Deleting Your Data
              </h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                Follow the public{" "}
                <Link
                  className="font-bold text-primary underline-offset-4 hover:underline"
                  href="/data-deletion"
                >
                  data deletion instructions
                </Link>{" "}
                to delete data in the app or submit a verified request by
                email. Deleting MuseInbox data does not delete content from
                Instagram or messages already delivered to recipients.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black tracking-tight">Contact</h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                MuseInbox is responsible for the MuseInbox account record
                described in this policy. For privacy questions or requests,
                contact us at{" "}
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
