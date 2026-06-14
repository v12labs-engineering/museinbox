# MuseInbox

Local-first Instagram automation dashboard for creating simple rules like:

- when someone comments a keyword, send this DM
- when someone comments anything, send this DM
- preview which rule would match before connecting live events

The current app supports Instagram OAuth for Business and Creator accounts, post/reel comment webhooks, mentions, and incoming message/story-reply style webhooks.

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

## Supabase Storage

Run `supabase/schema.sql` in the Supabase SQL editor, then set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY`
- `APP_SESSION_SECRET` optional; if omitted, `APP_ENCRYPTION_KEY` is used

When Supabase is configured, MuseInbox stores rules, activity, and Instagram OAuth state in Supabase. Instagram access tokens are encrypted before they are saved.

Instagram login is also the account signup flow. After a Business or Creator account approves Instagram access, MuseInbox creates or finds a Supabase state row for that Instagram account and signs the browser into that account with an HTTP-only session cookie.

Without Supabase variables, the app falls back to local JSON storage in `.museinbox/data.json`.
