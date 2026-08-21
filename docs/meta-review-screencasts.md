# Meta App Review Screencasts

This guide covers the developer evidence recorded for MuseInbox's Meta App Review.

Meta's [Private Replies guide](https://developers.facebook.com/documentation/instagram-platform/private-replies) lists `instagram_business_basic` and `instagram_business_manage_comments` for this Instagram Login flow.

Do not request or demonstrate `instagram_business_manage_messages` for this release.

## Required Done Criteria

These are requirements, not a statement that every current candidate meets them.

- The recording shows Instagram Login requesting only the two review permissions.
- The connected `momlife.with.pranu` professional account is visible inside MuseInbox.
- The `Meta review test` automation is active for the selected reel.
- `sourcefound200` posts a new, real comment containing `MUSEREVIEW2026`.
- MuseInbox shows the matching comment and a sent Activity result.
- The configured Private Reply is visibly delivered in `sourcefound200`'s native Instagram Inbox or Requests.
- Actual timecodes are copied from the final uploaded files into Meta's review notes.

## Recording Strategy

Record one clean, continuous master, typically two to four minutes. Create permission-specific trims only after the complete end-to-end flow is captured.

## Current Candidate Artifacts (2026-07-11)

Evidence audit: the basic candidate's Instagram screen is a generic reauthorization prompt and does not visibly enumerate or grant the two named scopes. It also begins after the user has already left MuseInbox, so it does not show the **Connect Instagram** button being used. Meta's current submission guidance asks for the login button, complete login flow, and visible permission grants. The comments candidate shows the rule, new comment, sent Activity row, and a reply present in the native inbox, but it does not include login and does not conclusively prove that the visible inbox message is fresh. Replace or remediate the candidates before upload if strict compliance with that guidance is required.

The basic candidate also shows only the connected username, not the numeric Instagram account ID. The comments candidate includes an earlier duplicate keyword comment and earlier sent Activity row. Its inbox message has no run-specific nonce and appears below an older `Sun 18:12` separator while the Activity row is dated 11 Jul at 15:11. Any replacement must keep the new `sourcefound200` comment, newest Activity row, and a unique fresh reply unambiguous.

### `instagram_business_basic`

File: `artifacts/meta-review/2026-07-11/instagram_business_basic.mp4`

- `0:00-0:13`: Instagram reauthorization shows the professional account and app, but not the named scopes.
- `0:20-0:34`: MuseInbox Dashboard shows media owned by the connected account.
- `0:35-0:45`: Settings shows `momlife.with.pranu` and the required permissions.

### `instagram_business_manage_comments`

File: `artifacts/meta-review/2026-07-11/instagram_business_manage_comments.mp4`

- `0:00-0:05`: The active `Meta review test` rule and exact `MUSEREVIEW2026` keyword are visible.
- `0:08-0:15`: `sourcefound200` enters the keyword and the new comment appears on the selected reel.
- `0:16-0:21`: MuseInbox Activity shows the latest match as `Instagram · sent`.
- `0:22-0:29`: `sourcefound200`'s native Instagram inbox shows a matching Private Reply from `momlife.with.pranu`; the clip does not conclusively establish that this message is fresh.

Both current files are H.264 MP4s. The developer recording uses only the two approved test accounts and does not expose credentials.

Use only these approved developer test accounts:

- Professional sender: `momlife.with.pranu`
- Commenter and Private Reply recipient: `sourcefound200`

The recordings are developer evidence. Reviewer instructions must instead let Meta use two reviewer-owned accounts without developer credentials.

## Master Screencast Outline

### 1. Start on the MuseInbox landing page

Show:

- The MuseInbox home page.
- The **Connect Instagram** button.

Say:

> This is MuseInbox. It lets Instagram Business and Creator accounts create comment-triggered Private Reply automations.

### 2. Connect Instagram

Show:

- Choose **Connect Instagram**.
- Show the Meta or Instagram permission screen.
- Approve only `instagram_business_basic` and `instagram_business_manage_comments`.
- Return to MuseInbox.

Say:

> The owner connects their Instagram professional account through Instagram Login. MuseInbox requests only the permissions required for account identity, owned media, comments, and Private Replies.

Permission proven:

- `instagram_business_basic`

### 3. Show the connected account and owned media

Show:

- Open **Settings** and show `momlife.with.pranu` as connected.
- Show the two listed Instagram permissions.
- Open **Dashboard** and show the account's owned media.

Say:

> MuseInbox shows the connected account and its owned media so the owner can confirm which account and content an automation will use.

Permission proven:

- `instagram_business_basic`

### 4. Show the automation rule

Show:

- Open the reel `https://www.instagram.com/reel/DZZ-cgRpg8i/` in MuseInbox.
- Show or create the active rule named `Meta review test`.
- Show the exact keyword `MUSEREVIEW2026`.
- Show the configured Private Reply text and destination link.

Say:

> The account owner controls the selected media, exact trigger keyword, reply text, destination link, and whether the rule is active.

Permission supported:

- `instagram_business_manage_comments`

### 5. Post a new matching comment

Show:

- Switch to the separate `sourcefound200` Instagram account.
- Open the selected reel.
- Post a new comment containing exactly `MUSEREVIEW2026`.

Say:

> This separate test account is posting a new comment that exactly matches the professional account owner's active rule.

Permission proven:

- `instagram_business_manage_comments`

### 6. Show processing and Activity

Show:

- Return to MuseInbox after the webhook processes the comment.
- Use **Read comments** if needed to show the exact matching comment and rule.
- Open **Activity** and show the new `Meta review test` result marked sent.

Say:

> MuseInbox reads the new comment, matches it to the owner's rule, sends one Private Reply using the source comment ID, and records the result.

Permission proven:

- `instagram_business_manage_comments`

### 7. Prove delivery in Instagram

Show:

- Switch back to `sourcefound200`.
- Open the native Instagram Inbox or Requests folder.
- Open the conversation from `momlife.with.pranu`.
- Keep the newly delivered, recognizable Private Reply visible long enough to read.

Say only after the message is visible:

> The comment-triggered Private Reply is now visibly delivered in the commenter's native Instagram inbox.

Permission proven:

- `instagram_business_manage_comments`

## Permission-Specific Upload Notes

### instagram_business_basic

Upload the master or a trim that includes Instagram Login, the two requested permissions, Settings, and owned media in Dashboard.

Paste this description:

> MuseInbox uses `instagram_business_basic` so an Instagram Business or Creator account owner can connect their own account, confirm its identity, and select its owned posts or reels for an automation.

Add exact timecodes from the final uploaded file for the connection screen, connected username, and owned media. Do not estimate them before recording.

### instagram_business_manage_comments

Upload the master or a trim that includes the rule, new comment, processing, sent Activity result, and actual delivery in the commenter's native Instagram inbox.

Paste this description:

> MuseInbox uses `instagram_business_manage_comments` to read comments on the connected account's media and match them to an owner-created rule. It then sends one Private Reply using the matching comment ID.

Meta documents this flow in its [Private Replies guide](https://developers.facebook.com/documentation/instagram-platform/private-replies).

Add exact timecodes from the final uploaded file for the rule, comment, Activity result, and native-inbox delivery. Do not estimate them before recording.

## Recording Checklist

- Use only `momlife.with.pranu` and `sourcefound200` for developer evidence.
- Use a clean browser window and hide unrelated tabs.
- Keep browser zoom at 100 percent.
- Show the product, Instagram permission screen, selected reel, Activity, and native Instagram inbox.
- Do not show passwords, tokens, environment variables, database screens, or other private data.
- Post a new `MUSEREVIEW2026` comment during the recording.
- Confirm the delivered reply is legible in `sourcefound200`'s native Inbox or Requests.
- If delivery is blocked or missing, troubleshoot and rerecord. Do not submit an Activity attempt as delivery evidence.
- Enter only timecodes observed in the final uploaded files.

## Short Narration Script

> This is MuseInbox, an Instagram comment-to-Private-Reply automation app for Business and Creator accounts.
>
> I connect the professional account through Instagram Login using only the two requested permissions.
>
> MuseInbox shows the connected account and its owned media.
>
> The active Meta review test rule listens for the exact keyword MUSEREVIEW2026 on this reel.
>
> From the separate sourcefound200 test account, I post a new matching comment.
>
> MuseInbox shows the match and sent result in Activity.
>
> Finally, I open sourcefound200's native Instagram inbox and show the Private Reply delivered from momlife.with.pranu.
