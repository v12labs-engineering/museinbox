import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { InstagramButtonIcon, MuseInboxLogo } from "../../src/App";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Continue with Instagram">
        <div className="login-panel">
          <Link className="brand-lockup login-brand" href="/" aria-label="MuseInbox home">
            <MuseInboxLogo />
            <span>
              <strong>MuseInbox</strong>
              <small>Business or creator</small>
            </span>
          </Link>

          <div className="login-copy">
            <p className="eyebrow">Instagram signup</p>
            <h1>Run comment automations from your Instagram account.</h1>
            <p>
              Continue with a Business or Creator account. MuseInbox will create or
              find your workspace, connect your posts and reels, and take you back
              to the dashboard.
            </p>
          </div>

          <a className="primary-action login-action" href="/api/auth/instagram/start">
            <InstagramButtonIcon />
            Continue with Instagram
            <ArrowRight size={18} aria-hidden="true" />
          </a>

          <div className="login-trust">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              Official Instagram permission flow
            </span>
            <span>
              <LockKeyhole size={16} aria-hidden="true" />
              Token stored encrypted
            </span>
          </div>
        </div>

        <div className="login-preview" aria-label="Automation preview">
          <div className="preview-phone">
            <div className="preview-post">
              <div />
              <span>Comment “LINK” and get the guide in DM</span>
            </div>
            <div className="preview-comment">
              <MessageCircle size={18} aria-hidden="true" />
              <span>link please</span>
            </div>
            <div className="preview-rule">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>Matched: Send product link</strong>
                <span>DM reply is ready to send.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
