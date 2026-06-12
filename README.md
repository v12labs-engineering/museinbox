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

## Important Deployment Note

This version still stores rules, activity, and OAuth state in a local JSON file. On Vercel it can run, but file storage is temporary and should be replaced with a real database before using it as a production SaaS.
