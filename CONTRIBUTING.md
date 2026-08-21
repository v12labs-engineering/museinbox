# Contributing to MuseInbox

Thanks for taking the time to improve MuseInbox.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use an issue to discuss large behavior, architecture, or data-model changes.
- Never include real Meta, Instagram, Supabase, or user credentials in an issue,
  fixture, screenshot, log, commit, or pull request.
- Use accounts and applications you control when testing external integrations.

## Development workflow

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app is available at <http://127.0.0.1:5173>. Credentials are not required to
review the landing page and local automation UI. See `README.md` for Meta and
Supabase setup.

Before submitting a pull request, run:

```bash
npm run typecheck
npm run build
npm audit
```

There is no automated unit-test suite yet. Describe the manual paths you tested,
including whether Instagram actions were run in dry-run mode.

## Pull requests

- Keep the change focused and explain the user-visible result.
- Include setup or migration notes when environment variables or storage change.
- Update documentation for changed behavior.
- Include before-and-after screenshots for visible UI changes.
- Do not weaken webhook verification, cookie signing, token encryption, or the
  fair-use protections without documenting the security impact.

## Security reports

Do not disclose a suspected vulnerability in a public issue. Follow
`SECURITY.md` instead.
