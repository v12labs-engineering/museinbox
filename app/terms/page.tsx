import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MuseInboxLogo } from "../../src/App";

const sections = [
  {
    title: "Accepting These Terms",
    body: "By connecting an Instagram account to or using MuseInbox, you agree to these Terms of Service and the Privacy Policy. If you use MuseInbox for an organization, you confirm that you have authority to accept these terms for that organization. If you do not agree, do not connect an account or use the service.",
  },
  {
    title: "Eligibility and Instagram Account Access",
    body: "You must be legally able to enter into these terms and meet the minimum age required by Instagram and applicable law. You may connect only an Instagram Business or Creator account that you own or are authorized to manage. You must use Meta's official authorization flow and must not provide MuseInbox with an Instagram password or another person's access credentials.",
  },
  {
    title: "The Service",
    body: "MuseInbox lets an account owner create rules that evaluate Instagram comments and related webhook activity, then send an owner-configured direct message and, when selected, a public comment reply. You choose the trigger, media, message, link, and whether an automation is active. MuseInbox records recent processing and delivery outcomes so you can review them.",
  },
  {
    title: "Your Content and Instructions",
    body: "You retain responsibility for the automation rules, keywords, links, messages, replies, and other content you submit. You give MuseInbox the limited permission needed to store, process, display, and transmit that content solely to provide, secure, and support the service. You confirm that you have the rights needed to use that content and that it is accurate and lawful.",
  },
  {
    title: "Messaging and Platform Compliance",
    body: "You must use MuseInbox in accordance with Instagram's Terms of Use, Meta Platform Terms, Meta Developer Policies, applicable messaging and anti-spam rules, privacy and marketing laws, and the rights of commenters and message recipients. You are responsible for the substance, recipients, timing, and destination of your automations and for providing any notices or obtaining any consent required by law.",
  },
  {
    title: "Prohibited Use",
    body: "You may not use MuseInbox to send spam, scams, harassment, unlawful or deceptive content, malware, or content that infringes another person's rights; evade Instagram restrictions or fair-use controls; scrape or monitor accounts without authority; probe or disrupt the service; reverse engineer protected parts of it; share access tokens; impersonate another person; or use MuseInbox for an illegal purpose.",
  },
  {
    title: "Fair Use and Changes to Availability",
    body: "MuseInbox is currently offered without charge, subject to fair-use limits that protect Instagram accounts and service reliability. Current controls may limit active automations, daily comment checks, daily message-send attempts, or pause an automation after repeated Instagram failures. We may reasonably adjust limits, features, or pricing and will provide notice of material changes when reasonably possible.",
  },
  {
    title: "Meta, Vercel, Supabase, and Other Dependencies",
    body: "MuseInbox depends on services operated by Meta or Instagram, Vercel, and Supabase. API access, webhook delivery, message eligibility, hosting, storage, and account availability may be interrupted or changed by those providers. MuseInbox is not sponsored by or part of Meta or Instagram, and these terms do not replace any agreement you have with them.",
  },
  {
    title: "Privacy, Disconnecting, and Deletion",
    body: "Our Privacy Policy explains how MuseInbox handles Instagram and technical data. Disconnect Instagram removes the stored connection but does not erase saved automations or activity. Delete all my data in Settings clears the active MuseInbox account record. Public deletion instructions are available if you cannot use that control. Deletion does not recall messages already delivered or delete information held independently by Meta, Instagram, or recipients.",
  },
  {
    title: "Suspension and Termination",
    body: "You may stop using MuseInbox at any time. We may limit, suspend, or terminate access when reasonably necessary to protect users or the service, respond to legal or provider requirements, address security risk, or enforce these terms. Where practical, we will give notice and an opportunity to correct the issue.",
  },
  {
    title: "Service Disclaimer",
    body: "To the extent permitted by law, MuseInbox is provided on an as-is and as-available basis. We do not promise uninterrupted access, a particular delivery result, continued Meta permission approval, or that every eligible comment, webhook, reply, or message will be received or processed. Nothing in these terms excludes warranties or rights that cannot lawfully be excluded.",
  },
  {
    title: "Limitation of Liability",
    body: "To the extent permitted by law, MuseInbox will not be liable for indirect, incidental, special, consequential, or punitive losses, or for lost profits, data, goodwill, messages, or opportunities arising from use of the service, rejected API calls, account restrictions, or third-party changes. This limitation does not apply where liability cannot lawfully be limited.",
  },
  {
    title: "Changes to These Terms",
    body: "We may update these terms to reflect service, provider, or legal changes. The revised terms will be posted here with a new effective date. Continuing to use MuseInbox after revised terms take effect means you accept them, to the extent permitted by law.",
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
            Effective 11 July 2026
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
              <h2 className="text-xl font-black tracking-tight">
                Privacy and Deletion Resources
              </h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                Read the{" "}
                <Link
                  className="font-bold text-primary underline-offset-4 hover:underline"
                  href="/privacy"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  className="font-bold text-primary underline-offset-4 hover:underline"
                  href="/data-deletion"
                >
                  Data Deletion Instructions
                </Link>
                .
              </p>
            </section>

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
