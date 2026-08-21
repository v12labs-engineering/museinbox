# MuseInbox

Local-first Instagram automation dashboard for creating simple rules like:

- when someone comments a keyword, send this DM
- when someone comments anything, send this DM
- preview which rule would match before connecting live events

The current review-ready app supports Instagram OAuth for Business and Creator accounts, post/reel comment webhooks, mentions, and comment-triggered private replies.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Copy `.env.example` to `.env.local` and fill in the Instagram/Meta values.

When the Meta app is still in development mode, the Instagram account you use
to sign in must be added to the app's roles in the Meta App Dashboard and must
accept the invitation before OAuth will work. Otherwise Meta can redirect back
with `Insufficient developer role`.

The built-in Instagram Login flow should request only Instagram permissions.
Do not add `pages_read_engagement` or `pages_show_list` to
`INSTAGRAM_OAUTH_SCOPES`; those belong to the separate Facebook Login for
Business flow, not the Instagram OAuth URL used by this app.

For the current comment-automation flow, keep `INSTAGRAM_OAUTH_SCOPES` limited
to `instagram_business_basic` and `instagram_business_manage_comments`.
Comment-triggered private replies use the source comment ID and do not require
`instagram_business_manage_messages`. Incoming message and story-reply webhook
handlers remain dormant unless that separate messaging capability is added and
reviewed in a future release.

## Supabase Storage

Run `supabase/schema.sql` in the Supabase SQL editor, then set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY`
- `APP_SESSION_SECRET` optional; if omitted, `APP_ENCRYPTION_KEY` is used

When Supabase is configured, MuseInbox stores rules, activity, and Instagram OAuth state in Supabase. Instagram access tokens are encrypted before they are saved.

Instagram login is also the account signup flow. After a Business or Creator account approves Instagram access, MuseInbox creates or finds a Supabase state row for that Instagram account and signs the browser into that account with an HTTP-only session cookie.

Without Supabase variables, the app falls back to local JSON storage in `.museinbox/data.json`.
