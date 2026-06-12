import Link from "next/link";
import { MuseInboxLogo } from "../../src/App";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <Link className="brand-lockup legal-brand" href="/" aria-label="MuseInbox home">
          <MuseInboxLogo />
          <span>
            <strong>MuseInbox</strong>
            <small>Privacy policy</small>
          </span>
        </Link>

        <p className="eyebrow">Effective 12 June 2026</p>
        <h1>Privacy Policy</h1>
        <p>
          MuseInbox helps Instagram Business and Creator accounts create comment
          automations that send manually configured direct-message replies.
        </p>

        <h2>Information We Collect</h2>
        <p>
          When you connect Instagram, we store your Instagram account identifier,
          access token, selected post or reel details, automation rules, message
          templates, links, and local activity logs.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use this information only to display your Instagram content, match
          comments to your rules, and send the message you configured.
        </p>

        <h2>Storage and Security</h2>
        <p>
          Access tokens are encrypted before storage. We do not sell Instagram
          data, use it for advertising, or use it to train AI models.
        </p>

        <h2>Disconnecting</h2>
        <p>
          You can disconnect Instagram from the MuseInbox settings page. This
          removes the stored connection token from the app.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions, contact us at{" "}
          <a href="mailto:schalla200@gmail.com">schalla200@gmail.com</a>.
        </p>
      </article>
    </main>
  );
}
