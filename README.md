# MuseInbox

Local-first Instagram automation dashboard for creating simple rules like:

- when someone comments a keyword, send this DM
- when someone comments anything, send this DM
- preview which rule would match before connecting live events

The current app supports Instagram OAuth, post/reel comment webhooks, mentions, and incoming message/story-reply style webhooks.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Copy `.env.example` to `.env.local` and fill in the Instagram/Meta values.

## Supabase Storage

Run `supabase/schema.sql` in the Supabase SQL editor, then set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY`

When Supabase is configured, MuseInbox stores rules, activity, and Instagram OAuth state in Supabase. Instagram access tokens are encrypted before they are saved.

Without Supabase variables, the app falls back to local JSON storage in `.museinbox/data.json`.
